import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, isNotNull, isNull, ne, notInArray, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { PoliteHttpError, type PoliteClient } from "@/lib/http/polite";
import type { PipelineStats, RemoteScope } from "@/lib/jobs/types";
import type { Eligibility } from "@/lib/jobs/view";
import { cachedGenerate, type CacheStore } from "@/lib/llm/cache";
import {
  checkAssessments,
  P4_BATCH,
  P4_PROMPT_ID,
  P4_PROMPT_VERSION,
  p4OutputSchema,
  p4Prompt,
  type P4Job,
} from "@/lib/llm/prompts/p4-fit";
import { LLMError, type LLMProvider } from "@/lib/llm/types";
import { draftSearchPreferences } from "@/lib/profile/build";
import { searchPreferencesSchema, type MasterProfile, type SearchPreferences } from "@/lib/profile/schema";
import type { Db } from "@/lib/profile/store";
import { ADAPTERS } from "@/lib/sources/boards";
import { normalizePosting } from "@/lib/sources/normalize";
import type { AtsType, NormalizedJob } from "@/lib/sources/types";
import { dedupeJobs, normalizeTitle } from "./dedupe";
import { eligibilityOf } from "./eligibility";
import { prefilterScore } from "./prefilter";
import { parseSalaryText } from "./salary";

/**
 * The daily run (docs/ARCHITECTURE.md section 8): fetch every tracked
 * company's board, normalize and dedupe, keep the jobs that fit his kind of
 * role, place and the last 7 days, close jobs that left their board, match
 * them to each user with a confirmed profile, score the best new ones with P4
 * within the call budget, and log the run.
 */

const DAY = 86_400_000;
export const FRESH_DAYS = 7;
const FAILURES_BEFORE_PAUSE = 5;

export type Company = { id: string; name: string; ats: AtsType; slug: string; crawlCount: number };
export type Seeker = { userId: string; profile: MasterProfile; prefs: SearchPreferences };

export type RunDeps = {
  /** null only for a dry run without a database. */
  db: Db | null;
  http: PoliteClient;
  provider: LLMProvider | null;
  cache: CacheStore;
  now?: () => Date;
  log?: (line: string) => void;
};

export type RunOptions = {
  trigger: "schedule" | "manual";
  dryRun?: boolean;
  limitCompanies?: number;
  source?: AtsType;
  /** P4 calls this run may make (LLM_DAILY_CALL_BUDGET). */
  llmBudget: number;
  /** New jobs scored per user per run. */
  maxScore?: number;
  maxCompanies?: number;
};

export type RunSummary = PipelineStats & {
  runId: string | null;
  status: "succeeded" | "partial" | "failed";
  errors: { source?: string; company?: string; message: string }[];
  /** Dry runs: the best matches by prefilter, for the log. */
  preview: { title: string; company: string; location: string; prefilter: number; eligibility: Eligibility }[];
};

type Fetched = { company: Company; jobs: NormalizedJob[] } | { company: Company; error: string };

export async function runDailyPipeline(
  deps: RunDeps,
  opts: RunOptions,
  dryRunCompanies?: Company[],
): Promise<RunSummary> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});
  const started = now();
  const db = opts.dryRun ? null : deps.db;
  const errors: RunSummary["errors"] = [];
  const stats: PipelineStats = {
    sources: {},
    companiesCrawled: 0,
    jobsScored: 0,
    llmCalls: 0,
    jobsStored: 0,
    jobsClosed: 0,
  };
  const sourceStats = (s: string) => (stats.sources[s] ??= { fetched: 0, new: 0, errors: 0 });

  const [run] = db
    ? await db.insert(schema.pipelineRuns).values({ trigger: opts.trigger, startedAt: started }).returning()
    : [null];

  try {
    /* 1. Who to match, and which companies to crawl. */
    const seekers = deps.db ? await loadSeekers(deps.db) : [];
    let companies = dryRunCompanies ?? (deps.db ? await loadCompanies(deps.db) : []);
    if (opts.source) companies = companies.filter((c) => c.ats === opts.source);
    companies = companies.slice(0, opts.limitCompanies ?? opts.maxCompanies ?? 400);
    log(`${companies.length} companies, ${seekers.length} people with a confirmed profile`);

    /* 2. Fetch: one queue per ATS host, hosts in parallel; the polite client spaces requests 1 s apart per host. */
    const fetched = await fetchAll(companies, deps.http);
    const ok = fetched.filter((f): f is Extract<Fetched, { jobs: NormalizedJob[] }> => "jobs" in f);
    stats.companiesCrawled = ok.length;
    for (const f of fetched) {
      if ("error" in f) {
        sourceStats(f.company.ats).errors++;
        errors.push({ source: f.company.ats, company: f.company.name, message: f.error });
      } else sourceStats(f.company.ats).fetched += f.jobs.length;
    }
    const firstCrawl = new Set(ok.filter((f) => f.company.crawlCount === 0).map((f) => f.company.id));
    const companyOf = new Map<string, Company>();
    for (const f of ok) for (const j of f.jobs) companyOf.set(`${j.source}:${j.sourceJobId}`, f.company);

    /* 3. Dedupe, then keep only what someone could see: his kind of role, a place he can work from, the last 7 days. */
    const all = dedupeJobs(ok.flatMap((f) => f.jobs));
    const fresh = (j: NormalizedJob) => !j.postedAt || started.getTime() - j.postedAt.getTime() <= FRESH_DAYS * DAY;
    const prefsList = seekers.length ? seekers : [];
    const relevant = all.filter(
      (j) =>
        fresh(j) &&
        prefsList.some((s) => prefilterScore(j, s.profile, s.prefs) > 0 && eligibilityOf(j, s.prefs) !== "ineligible"),
    );
    stats.jobsStored = relevant.length;
    log(`${all.length} jobs after dedupe, ${relevant.length} kept (role, place, last ${FRESH_DAYS} days)`);

    if (!db) {
      const preview = seekers.flatMap((s) =>
        relevant
          .map((j) => ({
            title: j.title,
            company: j.companyName,
            location: j.locationRaw,
            prefilter: prefilterScore(j, s.profile, s.prefs),
            eligibility: eligibilityOf(j, s.prefs),
          }))
          .sort((a, b) => b.prefilter - a.prefilter)
          .slice(0, 15),
      );
      return finish(null, stats, errors, preview, companies.length);
    }

    /* 4. Companies: crawl bookkeeping; five failures in a row pause a company. */
    for (const f of fetched) {
      const c = f.company;
      await db
        .update(schema.companies)
        .set(
          "jobs" in f
            ? {
                lastCrawledAt: started,
                crawlCount: c.crawlCount + 1,
                consecutiveFailures: 0,
                openRolesCount: f.jobs.length,
              }
            : {
                consecutiveFailures: sql`${schema.companies.consecutiveFailures} + 1`,
                paused: sql`${schema.companies.consecutiveFailures} + 1 >= ${FAILURES_BEFORE_PAUSE}`,
              },
        )
        .where(eq(schema.companies.id, c.id));
    }

    /* 5. Store jobs. A job with no real post date counts from today, but not on a company's first crawl. */
    const stored = await storeJobs(db, relevant, companyOf, firstCrawl, started);
    for (const s of stored) if (s.isNew) sourceStats(s.source).new++;

    /* 6. Jobs that left a board this run are closed. */
    for (const f of ok) {
      const ids = f.jobs.map((j) => j.sourceJobId);
      const closed = await db
        .update(schema.jobs)
        .set({ closedAt: started })
        .where(
          and(
            eq(schema.jobs.companyId, f.company.id),
            eq(schema.jobs.source, f.company.ats),
            isNull(schema.jobs.closedAt),
            ids.length ? notInArray(schema.jobs.sourceJobId, ids) : undefined,
          ),
        )
        .returning({ id: schema.jobs.id });
      stats.jobsClosed! += closed.length;
    }

    /* 7. Matches per person: prefilter and eligibility now; a changed post is scored again. */
    for (const s of seekers) await upsertMatches(db, s, stored);

    /* 7b. A job from a checked board that no longer passes the rules leaves the feed, unless he saved or applied. */
    const crawledIds = ok.map((f) => f.company.id);
    if (crawledIds.length) {
      const keep = stored.map((s) => s.id);
      const leaving = db
        .select({ id: schema.jobs.id })
        .from(schema.jobs)
        .where(
          and(inArray(schema.jobs.companyId, crawledIds), keep.length ? notInArray(schema.jobs.id, keep) : undefined),
        );
      await db
        .delete(schema.jobMatches)
        .where(and(inArray(schema.jobMatches.status, ["new", "seen"]), inArray(schema.jobMatches.jobId, leaving)));
    }

    /* 8. P4 on the best unscored fresh matches, within the call budget. */
    if (deps.provider) {
      let budget = opts.llmBudget;
      for (const s of seekers) {
        if (budget <= 0) break;
        const r = await scoreMatches(db, deps.provider, deps.cache, s, {
          budget,
          maxScore: opts.maxScore ?? 60,
          since: new Date(started.getTime() - FRESH_DAYS * DAY),
          now: started,
        });
        budget -= r.calls;
        stats.llmCalls += r.calls;
        stats.jobsScored += r.scored;
        if (r.error) errors.push({ source: "p4", message: r.error });
      }
    }

    return finish(run?.id ?? null, stats, errors, [], companies.length);
  } catch (e) {
    errors.push({ message: e instanceof Error ? e.message : String(e) });
    if (db && run) {
      await db
        .update(schema.pipelineRuns)
        .set({ finishedAt: now(), status: "failed", stats, errors })
        .where(eq(schema.pipelineRuns.id, run.id));
    }
    throw e;
  }

  async function finish(
    runId: string | null,
    s: PipelineStats,
    errs: RunSummary["errors"],
    preview: RunSummary["preview"],
    tried: number,
  ): Promise<RunSummary> {
    s.durationMs = now().getTime() - started.getTime();
    const status = tried > 0 && s.companiesCrawled === 0 ? "failed" : errs.length ? "partial" : "succeeded";
    if (db && runId)
      await db
        .update(schema.pipelineRuns)
        .set({ finishedAt: now(), status, stats: s, errors: errs })
        .where(eq(schema.pipelineRuns.id, runId));
    return { ...s, runId, status, errors: errs, preview };
  }
}

export async function loadSeekers(db: Db): Promise<Seeker[]> {
  const rows = await db
    .select({
      userId: schema.masterProfiles.userId,
      data: schema.masterProfiles.data,
      prefs: schema.searchPreferences.data,
    })
    .from(schema.masterProfiles)
    .leftJoin(schema.searchPreferences, eq(schema.searchPreferences.userId, schema.masterProfiles.userId))
    .where(and(eq(schema.masterProfiles.isCurrent, true), isNotNull(schema.masterProfiles.confirmedAt)));
  // No saved preferences yet: the same draft from his profile that the app shows him.
  return rows.map((r) => ({
    userId: r.userId,
    profile: r.data,
    prefs: searchPreferencesSchema.parse(r.prefs ?? draftSearchPreferences(r.data)),
  }));
}

async function loadCompanies(db: Db): Promise<Company[]> {
  const rows = await db
    .select()
    .from(schema.companies)
    .where(
      and(
        inArray(schema.companies.atsType, Object.keys(ADAPTERS)),
        isNotNull(schema.companies.atsSlug),
        eq(schema.companies.paused, false),
        eq(schema.companies.muted, false),
      ),
    )
    // Least recently crawled first, so a capped run still reaches everyone over a few days.
    .orderBy(sql`${schema.companies.lastCrawledAt} asc nulls first`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ats: r.atsType as AtsType,
    slug: r.atsSlug!,
    crawlCount: r.crawlCount,
  }));
}

async function fetchAll(companies: Company[], http: PoliteClient): Promise<Fetched[]> {
  const byAts = new Map<AtsType, Company[]>();
  for (const c of companies) byAts.set(c.ats, [...(byAts.get(c.ats) ?? []), c]);
  const out: Fetched[] = [];
  await Promise.all(
    [...byAts].map(async ([ats, list]) => {
      const adapter = ADAPTERS[ats];
      for (const company of list) {
        try {
          const json = await http.getJson<unknown>(adapter.url(company.slug));
          const board = { ats, slug: company.slug, companyName: company.name };
          out.push({ company, jobs: adapter.parse(json).map((p) => normalizePosting(p, adapter, board)) });
        } catch (e) {
          const error =
            e instanceof PoliteHttpError && e.status === 404
              ? `The ${adapter.label} board "${company.slug}" was not found.`
              : e instanceof Error
                ? e.message
                : String(e);
          out.push({ company, error });
        }
      }
    }),
  );
  return out;
}

const hashOf = (j: NormalizedJob) =>
  createHash("sha256")
    .update(JSON.stringify([j.title, j.locationRaw, j.descriptionText]))
    .digest("hex");

type StoredJob = {
  id: string;
  source: string;
  isNew: boolean;
  changed: boolean;
  job: NormalizedJob;
  remoteScope: RemoteScope | null;
  postedAt: Date | null;
};

async function storeJobs(
  db: Db,
  jobs: (NormalizedJob & { alsoSeenIn: { source: string; url: string }[] })[],
  companyOf: Map<string, Company>,
  firstCrawl: Set<string>,
  now: Date,
): Promise<StoredJob[]> {
  const out: StoredJob[] = [];
  for (let i = 0; i < jobs.length; i += 50) {
    const chunk = jobs.slice(i, i + 50);
    const before = new Map(
      (
        await db
          .select({ source: schema.jobs.source, id: schema.jobs.sourceJobId, hash: schema.jobs.contentHash })
          .from(schema.jobs)
          .where(
            sql`(${schema.jobs.source}, ${schema.jobs.sourceJobId}) in (${sql.join(
              chunk.map((j) => sql`(${j.source}, ${j.sourceJobId})`),
              sql`, `,
            )})`,
          )
      ).map((r) => [`${r.source}:${r.id}`, r.hash]),
    );
    const values = chunk.map((j) => {
      const company = companyOf.get(`${j.source}:${j.sourceJobId}`)!;
      const isNew = !before.has(`${j.source}:${j.sourceJobId}`);
      const undatedButSeen = !j.postedAt && isNew && !firstCrawl.has(company.id);
      return {
        companyId: company.id,
        source: j.source,
        tier: j.tier,
        sourceJobId: j.sourceJobId,
        title: j.title,
        normalizedTitle: normalizeTitle(j.title),
        descriptionHtml: j.descriptionHtml,
        descriptionText: j.descriptionText,
        applyUrl: j.applyUrl,
        canonicalUrl: j.canonicalUrl,
        locationRaw: j.locationRaw,
        workplace: j.workplace,
        remoteScope: j.remoteScope,
        employmentType: j.employmentType ?? null,
        salary: j.salary ?? null,
        postedAt: j.postedAt ?? (undatedButSeen ? now : null),
        postedAtSource: j.postedAt ? j.postedAtSource : undatedButSeen ? ("first_seen" as const) : ("unknown" as const),
        firstSeenAt: now,
        lastSeenAt: now,
        closedAt: null,
        attribution: j.attribution ?? null,
        alsoSeenIn: j.alsoSeenIn,
        contentHash: hashOf(j),
      };
    });
    const rows = await db
      .insert(schema.jobs)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.jobs.source, schema.jobs.sourceJobId],
        set: {
          title: sql`excluded.title`,
          normalizedTitle: sql`excluded.normalized_title`,
          descriptionHtml: sql`excluded.description_html`,
          descriptionText: sql`excluded.description_text`,
          applyUrl: sql`excluded.apply_url`,
          canonicalUrl: sql`excluded.canonical_url`,
          locationRaw: sql`excluded.location_raw`,
          workplace: sql`excluded.workplace`,
          // A scope P4 read from the description (with a quote) stays when the rules still know nothing.
          remoteScope: sql`case when excluded.remote_scope->>'kind' = 'unknown' and ${schema.jobs.remoteScope}->>'confidence' = 'llm' then ${schema.jobs.remoteScope} else excluded.remote_scope end`,
          employmentType: sql`excluded.employment_type`,
          salary: sql`coalesce(excluded.salary, ${schema.jobs.salary})`,
          postedAt: sql`coalesce(${schema.jobs.postedAt}, excluded.posted_at)`,
          postedAtSource: sql`case when ${schema.jobs.postedAt} is null then excluded.posted_at_source else ${schema.jobs.postedAtSource} end`,
          lastSeenAt: sql`excluded.last_seen_at`,
          closedAt: null,
          alsoSeenIn: sql`excluded.also_seen_in`,
          contentHash: sql`excluded.content_hash`,
          updatedAt: now,
        },
      })
      .returning({
        id: schema.jobs.id,
        source: schema.jobs.source,
        sourceJobId: schema.jobs.sourceJobId,
        remoteScope: schema.jobs.remoteScope,
        postedAt: schema.jobs.postedAt,
        contentHash: schema.jobs.contentHash,
      });
    for (const r of rows) {
      const key = `${r.source}:${r.sourceJobId}`;
      const job = chunk.find((j) => `${j.source}:${j.sourceJobId}` === key)!;
      out.push({
        id: r.id,
        source: r.source,
        isNew: !before.has(key),
        changed: before.has(key) && before.get(key) !== r.contentHash,
        job,
        remoteScope: r.remoteScope,
        postedAt: r.postedAt,
      });
    }
  }
  return out;
}

async function upsertMatches(db: Db, s: Seeker, stored: StoredJob[]) {
  const rows = stored.flatMap((st) => {
    const prefilter = prefilterScore(st.job, s.profile, s.prefs);
    if (prefilter <= 0) return [];
    const eligibility = eligibilityOf({ ...st.job, remoteScope: st.remoteScope }, s.prefs);
    return [{ st, prefilter, eligibility }];
  });
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await db
      .insert(schema.jobMatches)
      .values(
        chunk.map((r) => ({
          userId: s.userId,
          jobId: r.st.id,
          prefilterScore: r.prefilter,
          eligibility: r.eligibility,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.jobMatches.userId, schema.jobMatches.jobId],
        set: {
          prefilterScore: sql`excluded.prefilter_score`,
          eligibility: sql`excluded.eligibility`,
          updatedAt: new Date(),
        },
      });
    const changed = chunk.filter((r) => r.st.changed).map((r) => r.st.id);
    if (changed.length)
      await db
        .update(schema.jobMatches)
        .set({ fitScore: null, scoredAt: null, fitReasons: [], gaps: [] })
        .where(and(eq(schema.jobMatches.userId, s.userId), inArray(schema.jobMatches.jobId, changed)));
  }
}

async function scoreMatches(
  db: Db,
  provider: LLMProvider,
  cache: CacheStore,
  s: Seeker,
  o: { budget: number; maxScore: number; since: Date; now: Date },
): Promise<{ calls: number; scored: number; error?: string }> {
  const rows = await db
    .select({
      matchId: schema.jobMatches.id,
      jobId: schema.jobs.id,
      title: schema.jobs.title,
      company: schema.companies.name,
      companyId: schema.companies.id,
      location: schema.jobs.locationRaw,
      text: schema.jobs.descriptionText,
      workplace: schema.jobs.workplace,
      remoteScope: schema.jobs.remoteScope,
      salary: schema.jobs.salary,
    })
    .from(schema.jobMatches)
    .innerJoin(schema.jobs, eq(schema.jobs.id, schema.jobMatches.jobId))
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
    .where(
      and(
        eq(schema.jobMatches.userId, s.userId),
        isNull(schema.jobMatches.scoredAt),
        isNull(schema.jobs.closedAt),
        gte(schema.jobs.postedAt, o.since),
        ne(schema.jobMatches.eligibility, "ineligible"),
      ),
    )
    .orderBy(desc(schema.jobMatches.prefilterScore))
    .limit(Math.min(o.maxScore, o.budget * P4_BATCH));

  let calls = 0;
  let scored = 0;
  for (let i = 0; i < rows.length && calls < o.budget; i += P4_BATCH) {
    const batch = rows.slice(i, i + P4_BATCH);
    const jobs: P4Job[] = batch.map((r) => ({
      id: r.jobId,
      title: r.title,
      company: r.company,
      location: r.location,
      text: r.text,
    }));
    let assessments;
    try {
      const res = await cachedGenerate(provider, cache, P4_PROMPT_VERSION, {
        promptId: P4_PROMPT_ID,
        ...p4Prompt(s.profile, s.prefs, jobs),
        schema: p4OutputSchema,
        temperature: 0.2,
      });
      if (!res.cached) calls++;
      assessments = checkAssessments(res.data, jobs);
    } catch (e) {
      // Out of quota or Gemini down: the rest keep their prefilter score and are scored first next run.
      const message = e instanceof LLMError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e);
      return { calls: calls + 1, scored, error: `Scoring stopped: ${message}` };
    }
    for (const a of assessments) {
      const r = batch.find((x) => x.jobId === a.jobId)!;
      let eligibility: Eligibility | undefined;
      if (a.remoteScope && (!r.remoteScope || r.remoteScope.kind === "unknown")) {
        await db.update(schema.jobs).set({ remoteScope: a.remoteScope }).where(eq(schema.jobs.id, r.jobId));
        eligibility = eligibilityOf(
          { workplace: r.workplace, remoteScope: a.remoteScope, locationRaw: r.location },
          s.prefs,
        );
      }
      const salary = !r.salary && a.salaryQuote ? parseSalaryText(a.salaryQuote) : undefined;
      if (salary) await db.update(schema.jobs).set({ salary }).where(eq(schema.jobs.id, r.jobId));
      if (a.isStaffingAgency)
        await db.update(schema.companies).set({ isStaffingAgency: true }).where(eq(schema.companies.id, r.companyId));
      await db
        .update(schema.jobMatches)
        .set({
          fitScore: a.fitScore,
          fitReasons: a.reasons,
          gaps: a.gaps,
          scoredAt: o.now,
          model: provider.model,
          ...(eligibility ? { eligibility } : {}),
        })
        .where(eq(schema.jobMatches.id, r.matchId));
      scored++;
    }
  }
  return { calls, scored };
}
