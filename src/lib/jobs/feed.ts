import { and, desc, eq, gte, isNotNull, isNull, ne } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { countryName } from "@/lib/geo";
import { feedScore } from "@/lib/pipeline/rank";
import type { SearchPreferences } from "@/lib/profile/schema";
import type { Db } from "@/lib/profile/store";
import { ADAPTERS } from "@/lib/sources/boards";
import type { AtsType } from "@/lib/sources/types";
import type { RemoteScope, Salary, Workplace } from "./types";
import type { FeedJob } from "./view";

const DAY = 86_400_000;
const FRESH_DAYS = 7;

export type FeedRun = { finishedAt: string; companies: number };

/** "Remote, worldwide", "Remote, APAC, Bangladesh", "Remote, location not stated", or the office location. */
export function whereOf(workplace: Workplace, scope: RemoteScope | null, locationRaw: string): string {
  if (workplace !== "remote") return locationRaw || "Location not stated";
  if (!scope || scope.kind === "unknown") return "Remote, location not stated";
  if (scope.kind === "worldwide") return "Remote, worldwide";
  return ["Remote", ...(scope.regions ?? []), ...(scope.countries ?? []).map((c) => countryName(c))].join(", ");
}

/** Yearly USD for the table. Anything converted from another period or currency is marked approximate. */
export function payOf(salary: Salary | null): FeedJob["pay"] {
  const min = salary?.annualUsdMin ?? salary?.annualUsdMax;
  if (!salary || !min) return null;
  return {
    min,
    max: salary.annualUsdMax,
    approx: salary.currency !== "USD" || salary.period !== "year",
  };
}

/**
 * Today: his matches posted in the last 7 days that are still open, not
 * dismissed, and open to him or unclear, ranked by feed score. A staffing
 * agency, a muted company and pay under his minimum stay hidden when he
 * asked for that.
 */
export async function getFeed(
  db: Db,
  userId: string,
  prefs: SearchPreferences,
  now: Date,
): Promise<{ jobs: FeedJob[]; run: FeedRun | null }> {
  const [last] = await db
    .select()
    .from(schema.pipelineRuns)
    .where(isNotNull(schema.pipelineRuns.finishedAt))
    .orderBy(desc(schema.pipelineRuns.startedAt))
    .limit(1);
  const rows = await db
    .select({ m: schema.jobMatches, j: schema.jobs, c: schema.companies })
    .from(schema.jobMatches)
    .innerJoin(schema.jobs, eq(schema.jobs.id, schema.jobMatches.jobId))
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
    .where(
      and(
        eq(schema.jobMatches.userId, userId),
        ne(schema.jobMatches.status, "dismissed"),
        ne(schema.jobMatches.eligibility, "ineligible"),
        isNull(schema.jobs.closedAt),
        gte(schema.jobs.postedAt, new Date(now.getTime() - FRESH_DAYS * DAY)),
        eq(schema.companies.muted, false),
      ),
    );

  const excluded = new Set(prefs.excludedCompanies.map((c) => c.trim().toLowerCase()));
  const jobs = rows
    .filter(({ c }) => !excluded.has(c.name.toLowerCase()) && (prefs.showStaffingAgencies || !c.isStaffingAgency))
    .filter(({ j }) => {
      const max = j.salary?.annualUsdMax ?? j.salary?.annualUsdMin;
      if (prefs.hideBelowMinimum && prefs.minAnnualUsd && max && max < prefs.minAnnualUsd) return false;
      return prefs.showUnlistedPay || !!max;
    })
    .map(({ m, j, c }) => ({
      score: feedScore(
        {
          fit: m.fitScore,
          prefilter: m.prefilterScore,
          annualUsdMax: j.salary?.annualUsdMax ?? j.salary?.annualUsdMin,
          postedAt: j.postedAt,
          tier: j.tier,
          wellKnown: c.isWellKnown,
        },
        prefs,
        now,
      ),
      job: {
        id: j.id,
        title: j.title,
        company: c.name,
        newCompany: c.discoveredVia !== "seed" && now.getTime() - c.createdAt.getTime() < 14 * DAY,
        isNew: !!last && j.firstSeenAt.getTime() >= last.startedAt.getTime(),
        saved: m.status === "saved",
        source: ADAPTERS[j.source as AtsType]?.label ?? j.source,
        direct: j.tier === 1,
        where: whereOf(j.workplace, j.remoteScope, j.locationRaw),
        eligibility: m.eligibility,
        eligibilityNote: j.remoteScope?.confidence === "llm" ? j.remoteScope.evidenceQuote : undefined,
        pay: payOf(j.salary),
        postedAt: j.postedAt?.toISOString() ?? null,
        fit: m.fitScore,
        reasons: m.fitReasons,
        missing: m.gaps,
        url: j.applyUrl,
      } satisfies FeedJob,
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.job);

  return {
    jobs,
    run: last?.finishedAt
      ? { finishedAt: last.finishedAt.toISOString(), companies: last.stats?.companiesCrawled ?? 0 }
      : null,
  };
}

/** Saved or back to new: the Today star. The tracker builds on the same status. */
export async function setSaved(db: Db, userId: string, jobId: string, saved: boolean): Promise<boolean> {
  const rows = await db
    .update(schema.jobMatches)
    .set({ status: saved ? "saved" : "new", statusChangedAt: new Date() })
    .where(and(eq(schema.jobMatches.userId, userId), eq(schema.jobMatches.jobId, jobId)))
    .returning({ id: schema.jobMatches.id });
  return rows.length > 0;
}

/** The job post as text for the tailor paste box, when the job is one of his matches. */
export async function jobPostText(db: Db, userId: string, jobId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const [row] = await db
    .select({
      title: schema.jobs.title,
      company: schema.companies.name,
      location: schema.jobs.locationRaw,
      text: schema.jobs.descriptionText,
    })
    .from(schema.jobMatches)
    .innerJoin(schema.jobs, eq(schema.jobs.id, schema.jobMatches.jobId))
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
    .where(and(eq(schema.jobMatches.userId, userId), eq(schema.jobMatches.jobId, jobId)));
  return row ? `${row.title}\n${row.company}\n${row.location}\n\n${row.text}` : null;
}
