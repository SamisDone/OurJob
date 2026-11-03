import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { PoliteHttpError, type PoliteClient } from "@/lib/http/polite";
import type { CacheStore } from "@/lib/llm/cache";
import type { P4Output } from "@/lib/llm/prompts/p4-fit";
import type { GenerateArgs, LLMProvider } from "@/lib/llm/types";
import { p1OutputSchema } from "@/lib/llm/prompts/p1-profile";
import { normalizeProfile } from "@/lib/profile/normalize";
import { searchPreferencesSchema } from "@/lib/profile/schema";
import { confirmProfile, savePreferences, saveProfileVersion, type Db } from "@/lib/profile/store";
import { getFeed, setSaved } from "@/lib/jobs/feed";
import { runDailyPipeline } from "@/lib/pipeline/run";
import { upsertSeed } from "@/lib/pipeline/seed";

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const NOW = new Date("2026-10-25T00:30:00Z");

// Real board responses; one Linear posting is made fresh and worldwide so the run has a job open from anywhere.
const gitlab = read("tests/fixtures/sources/greenhouse/gitlab.json");
const linear = read("tests/fixtures/sources/ashby/linear.json");
const fresh = {
  ...linear.jobs[2],
  id: "fresh-1",
  jobUrl: "https://jobs.ashbyhq.com/linear/fresh-1",
  applyUrl: "https://jobs.ashbyhq.com/linear/fresh-1/application",
  title: "Backend Engineer",
  location: "Remote (Worldwide)",
  secondaryLocations: [],
  address: null,
  publishedAt: "2026-10-24T09:00:00.000+00:00",
};
let boards: Record<string, unknown> = {};
const resetBoards = () => {
  boards = {
    "boards-api.greenhouse.io/v1/boards/gitlab/jobs": gitlab,
    "api.ashbyhq.com/posting-api/job-board/linear": { ...linear, jobs: [...linear.jobs, fresh] },
    "api.lever.co/v0/postings/spotify": read("tests/fixtures/sources/lever/spotify.json"),
    // Job boards answer with nothing unless a test gives them jobs.
    "himalayas.app/jobs/api/search": { jobs: [] },
    "remotive.com/api/remote-jobs": { jobs: [] },
    "jobicy.com/api/jobs": { jobs: [] },
  };
};

const http = {
  async getJson(url: string) {
    const u = new URL(url);
    const body = boards[`${u.host}${u.pathname}`];
    if (!body) throw new PoliteHttpError(404, url, "not found");
    return body;
  },
} as unknown as PoliteClient;

let calls = 0;
const provider: LLMProvider = {
  name: "fake",
  model: "fake-lite",
  async generateJSON<T>(args: GenerateArgs<T>) {
    calls++;
    const ids = [...args.user.matchAll(/<job id="([^"]+)">/g)].map((m) => m[1]);
    const out: P4Output = {
      assessments: ids.map((id) => ({
        jobId: id,
        fitScore: 88,
        reasons: ["Built Go services with PostgreSQL like this team does"],
        gaps: ["Made-up requirement"],
        seniority: "mid",
        remoteScope: { kind: "worldwide", evidenceQuote: "not in the text" },
        isStaffingAgency: { value: false },
      })),
    };
    return { data: args.schema.parse(out), usage: { inputTokens: 1, outputTokens: 1 } };
  },
};
const memory = new Map<string, unknown>();
const cache: CacheStore = { get: async (k) => memory.get(k), set: async (k, v) => void memory.set(k, v) };

let db: Db;
let userId: string;

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "./drizzle" });
  db = pg as unknown as Db;
  const [u] = await pg.insert(schema.users).values({ email: "nadia@example.com" }).returning();
  userId = u.id;
  const profile = normalizeProfile(
    p1OutputSchema.parse(read("tests/fixtures/llm/p1-profile/nadia-chowdhury.json").output),
  );
  await saveProfileVersion(db, userId, profile, { note: "test" });
  await confirmProfile(db, userId);
  await savePreferences(
    db,
    userId,
    searchPreferencesSchema.parse({ targetTitles: ["Backend Engineer"], country: "PT", seniority: ["mid", "senior"] }),
  );
  await upsertSeed(
    db,
    [
      { name: "GitLab", website: "https://gitlab.com", ats: "greenhouse", slug: "gitlab" },
      { name: "Linear", website: "https://linear.app", ats: "ashby", slug: "linear" },
      { name: "Spotify", website: "https://spotify.com", ats: "lever", slug: "spotify" },
      { name: "Gone Co", website: "https://gone.example", ats: "lever", slug: "gone" },
    ],
    new Set(["gitlab"]),
  );
}, 30_000);

const run = (now = NOW) =>
  runDailyPipeline({ db, http, provider, cache, now: () => now }, { trigger: "manual", llmBudget: 40 });

describe("daily run (PGlite, real migrations, real board fixtures, fake model)", () => {
  it("stores only fresh software jobs he can work from, matches and scores them, and logs the run", async () => {
    resetBoards();
    const r = await run();
    expect(r.status).toBe("partial"); // the gone board answers 404
    expect(r.errors).toEqual([
      expect.objectContaining({ company: "Gone Co", message: expect.stringMatching(/not found/) }),
    ]);
    expect(r.companiesCrawled).toBe(3);

    const jobs = await db.select().from(schema.jobs);
    // GitLab's backend role is Canada and US only, Spotify's is in a Stockholm office, Linear's are years old.
    expect(jobs.map((j) => j.title)).toEqual(["Backend Engineer"]);
    expect(r.sources.ashby).toMatchObject({ new: 1 });

    const [m] = await db.select().from(schema.jobMatches).where(eq(schema.jobMatches.userId, userId));
    expect(m).toMatchObject({ eligibility: "eligible", fitScore: 88, model: "fake-lite" });
    // A gap that is not in the job text and a quote that is not in it are dropped.
    expect(m.gaps).toEqual([]);
    expect(jobs[0].remoteScope).toMatchObject({ kind: "worldwide", confidence: "structured" });

    const [row] = await db.select().from(schema.pipelineRuns);
    expect(row).toMatchObject({ status: "partial", trigger: "manual" });
    expect(row.stats).toMatchObject({ companiesCrawled: 3, jobsScored: 1, llmCalls: 1, jobsStored: 1 });
    const [gone] = await db.select().from(schema.companies).where(eq(schema.companies.atsSlug, "gone"));
    expect(gone.consecutiveFailures).toBe(1);
  });

  it("Today shows the scored job with its source and place, and Save sticks", async () => {
    const prefs = searchPreferencesSchema.parse({ country: "PT" });
    const { jobs, run: last } = await getFeed(db, userId, prefs, NOW);
    expect(last).toMatchObject({ companies: 3 });
    expect(jobs).toEqual([
      expect.objectContaining({
        title: "Backend Engineer",
        company: "Linear",
        source: "Careers page (Ashby)",
        direct: true,
        where: "Remote, worldwide",
        eligibility: "eligible",
        fit: 88,
        isNew: true,
        saved: false,
      }),
    ]);
    expect(await setSaved(db, userId, jobs[0].id, true)).toBe(true);
    expect((await getFeed(db, userId, prefs, NOW)).jobs[0].saved).toBe(true);
    expect(await getFeed(db, userId, prefs, new Date(NOW.getTime() + 9 * 86_400_000))).toMatchObject({ jobs: [] });
  });

  it("a second run finds nothing new and does not score again", async () => {
    const before = calls;
    const r = await run(new Date(NOW.getTime() + 3_600_000));
    expect(r.sources.ashby.new).toBe(0);
    expect(r.llmCalls).toBe(0);
    expect(calls).toBe(before);
  });

  it("closes a job that left its board", async () => {
    boards["api.ashbyhq.com/posting-api/job-board/linear"] = linear;
    const r = await run(new Date(NOW.getTime() + 7_200_000));
    expect(r.jobsClosed).toBe(1);
    const [job] = await db.select().from(schema.jobs);
    expect(job.closedAt).not.toBeNull();
  });

  it("a dry run writes nothing", async () => {
    resetBoards();
    const runs = (await db.select().from(schema.pipelineRuns)).length;
    const r = await runDailyPipeline(
      { db, http, provider, cache, now: () => NOW },
      { trigger: "manual", llmBudget: 40, dryRun: true },
    );
    expect(r.runId).toBeNull();
    expect(r.preview.map((p) => p.title)).toEqual(["Backend Engineer"]);
    expect((await db.select().from(schema.pipelineRuns)).length).toBe(runs);
  });

  it("job boards: credited, deduped against the company's own posting, and undated jobs count only from a board's second run", async () => {
    resetBoards();
    const rem = read("tests/fixtures/sources/remotive/all.json");
    const him = read("tests/fixtures/sources/himalayas/search-bd.json");
    const at = (d: Date) => d.toISOString().slice(0, 19); // Remotive writes UTC without a zone
    const t1 = new Date(NOW.getTime() + 3 * 3_600_000);
    const remotiveJob = (id: number, title: string, company: string) => ({
      ...rem.jobs[0],
      id,
      title,
      company_name: company,
      url: `https://remotive.com/remote-jobs/software-development/x-${id}`,
      publication_date: at(new Date(NOW.getTime() - 3_600_000)),
      candidate_required_location: "Worldwide",
    });
    const himJob = (guid: string, title: string, when: Date) => ({
      ...him.jobs[1],
      guid: `https://himalayas.app/companies/bolt-labs/jobs/${guid}`,
      applicationLink: `https://himalayas.app/companies/bolt-labs/jobs/${guid}?utm_source=api`,
      title,
      companyName: "Bolt Labs",
      locationRestrictions: [],
      pubDate: when.getTime() / 1000 - 600,
      expiryDate: when.getTime() / 1000 + 30 * 86_400,
    });
    // The Remotive copy of Linear's own posting is the same job: the company's version is kept.
    boards["remotive.com/api/remote-jobs"] = {
      jobs: [remotiveJob(1, "Backend Engineer", "Linear"), remotiveJob(2, "Senior Backend Developer", "Acme Remote")],
    };
    boards["himalayas.app/jobs/api/search"] = { jobs: [himJob("platform-engineer", "Platform Engineer", t1)] };
    await run(t1);

    const remotiveRows = await db.select().from(schema.jobs).where(eq(schema.jobs.source, "remotive"));
    expect(remotiveRows.map((j) => j.title)).toEqual(["Senior Backend Developer"]);
    expect(remotiveRows[0].attribution).toEqual({
      label: "Remotive",
      url: "https://remotive.com/remote-jobs/software-development/x-2",
    });
    const [linearJob] = await db.select().from(schema.jobs).where(eq(schema.jobs.sourceJobId, "fresh-1"));
    expect(linearJob.alsoSeenIn).toEqual([
      { source: "remotive", url: "https://remotive.com/remote-jobs/software-development/x-1" },
    ]);
    const [h1] = await db.select().from(schema.jobs).where(eq(schema.jobs.source, "himalayas"));
    expect(h1).toMatchObject({ postedAt: null, postedAtSource: "unknown" });
    expect(h1.closedAt!.getTime()).toBeGreaterThan(t1.getTime()); // closes on its expiry date

    const prefs = searchPreferencesSchema.parse({ country: "PT" });
    let feed = await getFeed(db, userId, prefs, t1);
    const acme = feed.jobs.find((j) => j.company === "Acme Remote")!;
    expect(acme).toMatchObject({ source: "Remotive", direct: false, sourceUrl: remotiveRows[0].applyUrl });
    expect(feed.jobs.some((j) => j.company === "Bolt Labs")).toBe(false); // first Himalayas run: no date to trust

    const t2 = new Date(t1.getTime() + 3_600_000);
    boards["himalayas.app/jobs/api/search"] = {
      jobs: [
        himJob("platform-engineer", "Platform Engineer", t2),
        himJob("platform-engineer-2", "Platform Engineer II", t2),
      ],
    };
    await run(t2);
    feed = await getFeed(db, userId, prefs, t2);
    const bolt = feed.jobs.filter((j) => j.company === "Bolt Labs");
    expect(bolt.map((j) => j.title)).toEqual(["Platform Engineer II"]);
    expect(bolt[0]).toMatchObject({ source: "Himalayas", postedAt: t2.toISOString() });
  });
});
