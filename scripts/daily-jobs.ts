/**
 * The daily job pipeline (docs/ARCHITECTURE.md section 8).
 *
 *   pnpm jobs:daily                                  full run: DATABASE_URL and GEMINI_API_KEY from env or .env.local
 *   pnpm jobs:daily --dry-run --limit-companies=5    fetch and filter, print the best matches, write nothing
 *   pnpm jobs:daily --source=greenhouse --no-llm     one ATS, no scoring
 *
 * GitHub Actions runs it every morning (.github/workflows/daily-jobs.yml).
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { createPoliteClient } from "../src/lib/http/polite";
import type { CacheStore } from "../src/lib/llm/cache";
import { createGeminiProvider } from "../src/lib/llm/gemini";
import { runDailyPipeline, type Company } from "../src/lib/pipeline/run";
import { loadSeed, loadWellKnown, upsertSeed } from "../src/lib/pipeline/seed";
import type { Db } from "../src/lib/profile/store";
import type { FeedId } from "../src/lib/sources/feeds";
import type { AtsType } from "../src/lib/sources/types";

config({ path: [".env.local", ".env"], quiet: true });

const flag = (name: string) => process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name: string) => flag(name)?.split("=")[1];
const dryRun = !!flag("dry-run");
const noLlm = !!flag("no-llm") || dryRun;
const limitCompanies = Number(value("limit-companies")) || undefined;
const source = value("source") as AtsType | FeedId | undefined;
if (source && !["greenhouse", "lever", "ashby", "himalayas", "remotive", "jobicy"].includes(source)) {
  console.error(`Unknown --source=${source}. Use greenhouse, lever, ashby, himalayas, remotive or jobicy.`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url && !dryRun) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local, or run with --dry-run.");
  process.exit(1);
}
const sql = url ? postgres(url, { max: 3, prepare: false }) : null;
const db = sql ? (drizzle(sql, { schema }) as unknown as Db) : null;

// The same defaults as src/lib/llm/index.ts (lite for everything; its free quota is large).
const apiKey = process.env.GEMINI_API_KEY;
const provider =
  noLlm || !apiKey
    ? null
    : createGeminiProvider({
        apiKey,
        model: process.env.LLM_MODEL || "gemini-3.5-flash-lite",
        // Lite only, one request per batch: no Flash fallback (its 20 free requests a day are the tailoring
        // backup) and no second request when an answer is slow. A batch that fails waits for the next run.
        fallbackModel: undefined,
        slowMs: 10 * 60_000,
        rpm: Number(process.env.LLM_RPM) || undefined,
        log: () => {},
      });
if (!noLlm && !apiKey) console.warn("GEMINI_API_KEY is not set: jobs are stored with prefilter scores only.");

const cache: CacheStore = db
  ? {
      async get(key) {
        const [row] = await db
          .select({ output: schema.llmCache.output })
          .from(schema.llmCache)
          .where(eq(schema.llmCache.key, key));
        return row?.output;
      },
      async set(key, output) {
        await db
          .insert(schema.llmCache)
          .values({ key, output })
          .onConflictDoUpdate({ target: schema.llmCache.key, set: { output } });
      },
    }
  : { get: async () => undefined, set: async () => {} };

async function main() {
  const seed = loadSeed();
  const started = Date.now();
  try {
    if (db && !dryRun) {
      const added = await upsertSeed(db, seed, loadWellKnown());
      if (added) console.log(`Added ${added} companies from data/companies.seed.json`);
    }
    // A dry run reads the seed file, so it works without a database.
    const seedCompanies: Company[] | undefined = dryRun
      ? seed.map((c, i) => ({ id: `seed-${i}`, name: c.name, ats: c.ats, slug: c.slug, crawlCount: 0 }))
      : undefined;
    const summary = await runDailyPipeline(
      {
        db,
        // Remotive blocks more than 2 requests a minute; the run makes one.
        http: createPoliteClient({ hostIntervalMs: { "remotive.com": 30_000 } }),
        provider,
        cache,
        log: (l) => console.log(l),
      },
      {
        trigger: process.env.GITHUB_EVENT_NAME === "workflow_dispatch" ? "manual" : "schedule",
        dryRun,
        limitCompanies,
        source,
        llmBudget: Number(process.env.LLM_DAILY_CALL_BUDGET) || 40,
        maxCompanies: Number(process.env.PIPELINE_MAX_COMPANIES) || 400,
      },
      seedCompanies,
    );
    console.log(
      `\n${summary.status}: ${summary.companiesCrawled} companies checked, ${summary.jobsStored} jobs kept, ` +
        `${summary.jobsClosed} closed, ${summary.jobsScored} scored in ${summary.llmCalls} model calls, ` +
        `${Math.round((Date.now() - started) / 1000)} s`,
    );
    for (const [s, n] of Object.entries(summary.sources))
      console.log(`  ${s}: ${n.fetched} fetched, ${n.new} new, ${n.errors} errors`);
    for (const e of summary.errors) console.log(`  error${e.company ? ` (${e.company})` : ""}: ${e.message}`);
    if (summary.preview.length) {
      console.log("\nBest matches by prefilter:");
      for (const p of summary.preview)
        console.log(
          `  ${p.prefilter.toFixed(2)}  ${p.eligibility.padEnd(10)}  ${p.title} at ${p.company} (${p.location})`,
        );
    }
    process.exitCode = summary.status === "failed" ? 1 : 0;
  } finally {
    await sql?.end();
  }
}

void main();
