/**
 * Measures tailoring end to end (paste to validated CV) on the FICTIONAL job
 * posts in tests/fixtures/jds against Nadia Chowdhury's fictional profile,
 * once per model, with the real Gemini API.
 *   pnpm eval:tailor
 *   pnpm eval:tailor --models=gemini-3.5-flash-lite --only=03 --out=<dir>
 * Each model runs alone (no fallback), with an empty cache per run, so the
 * times are what a paste would cost. Results go to --out (default
 * eval-output/, git-ignored): a JSON report and each final CV.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { findKeyword } from "../src/lib/ats/match";
import type { CacheStore } from "../src/lib/llm/cache";
import { createGeminiProvider } from "../src/lib/llm/gemini";
import { p1OutputSchema } from "../src/lib/llm/prompts/p1-profile";
import { normalizeProfile } from "../src/lib/profile/normalize";
import type { TailoredResume } from "../src/lib/profile/schema";
import { tailorCv, type TailorResult } from "../src/lib/tailor/pipeline";
import { extractNumbers, unsupportedReason } from "../src/lib/tailor/numbers";
import type { Issue } from "../src/lib/tailor/validate";

config({ path: [".env.local", ".env"], quiet: true });

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const MODELS = (arg("models") ?? "gemini-3.5-flash-lite,gemini-3.8-flash").split(",");
const OUT = arg("out") ?? "eval-output";
const only = arg("only");
const PAUSE_MS = Number(arg("pause") ?? 15_000);

const profile = normalizeProfile(
  p1OutputSchema.parse(JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/nadia-chowdhury.json", "utf8")).output),
);

type Row = {
  model: string;
  jd: string;
  ok: boolean;
  error?: string;
  totalS?: number;
  parseS?: number;
  tailorS?: number;
  fixS?: number[];
  calls?: { promptId: string; model: string; ms: number; out: number }[];
  backoffs?: number;
  firstPass?: { clean: boolean; fixIssues: Record<string, number>; autoFixed: number };
  final?: {
    gapLeaks: string[];
    unsupportedNumbers: string[];
    matched: number;
    matchedCovered: number;
    removed: number;
    rounds: number;
    reported: string[];
  };
};

const count = (issues: Issue[], action: Issue["action"]) =>
  issues
    .filter((i) => i.action === action)
    .reduce<Record<string, number>>((m, i) => ((m[i.check] = (m[i.check] ?? 0) + 1), m), {});

/** Independent of the validator's own report: scan the final CV text again. */
function audit(res: TailorResult) {
  const r: TailoredResume = res.resume;
  const texts: { text: string; sourceIds: string[] }[] = [
    ...(r.summary ? [r.summary] : []),
    ...r.experience.flatMap((e) => e.bullets),
    ...r.projects.flatMap((p) => p.bullets),
  ];
  const all = [
    r.headline,
    ...texts.map((t) => t.text),
    ...r.skills.flatMap((g) => g.items.map((i) => i.name)),
    ...r.experience.flatMap((e) => e.tech),
    ...r.projects.flatMap((p) => p.tech),
  ].join("\n");
  const techTerms = profile.skills.flatMap((s) => [s.name, ...s.aliases]);
  const gapLeaks = res.gaps.filter((g) => findKeyword(g, all, false, { techTerms })).map((g) => g.term);
  // Numbers against the whole profile: a looser check than the validator's, so anything here is a real problem.
  const profileText = JSON.stringify(profile);
  const unsupportedNumbers = texts
    .flatMap((t) =>
      extractNumbers(t.text).map((n) => ({ n, reason: unsupportedReason(n, extractNumbers(profileText)) })),
    )
    .filter((x) => x.reason)
    .map((x) => x.n.raw.trim());
  return { gapLeaks, unsupportedNumbers };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env.local");
  mkdirSync(OUT, { recursive: true });
  const jds = readdirSync("tests/fixtures/jds")
    .filter((f) => f.endsWith(".txt") && (!only || f.startsWith(only)))
    .sort();
  const rows: Row[] = [];

  for (const model of MODELS) {
    for (const file of jds) {
      const calls: NonNullable<Row["calls"]> = [];
      let backoffs = 0;
      const provider = createGeminiProvider({
        apiKey,
        model,
        rpm: Number(process.env.LLM_RPM) || 8,
        log: (e) => calls.push({ promptId: e.promptId, model: e.model, ms: e.ms, out: e.outputTokens }),
        sleep: (ms) => {
          backoffs++;
          return new Promise((r) => setTimeout(r, ms));
        },
      });
      const memory = new Map<string, unknown>();
      const cache: CacheStore = { get: async (k) => memory.get(k), set: async (k, v) => void memory.set(k, v) };
      const jd = file.replace(/\.txt$/, "");
      process.stdout.write(`${model} ${jd} ... `);
      try {
        const res = await tailorCv(readFileSync(join("tests/fixtures/jds", file), "utf8"), profile, {
          provider,
          cache,
        });
        const { gapLeaks, unsupportedNumbers } = audit(res);
        const covered = res.matched.length - res.finalIssues.filter((i) => i.check === "coverage").length;
        const row: Row = {
          model,
          jd,
          ok: true,
          totalS: res.timings.totalMs / 1000,
          parseS: res.timings.parseMs / 1000,
          tailorS: res.timings.tailorMs / 1000,
          fixS: res.timings.fixMs.map((m) => m / 1000),
          calls,
          backoffs,
          firstPass: {
            clean: !res.firstIssues.some((i) => i.action === "fix"),
            fixIssues: count(res.firstIssues, "fix"),
            autoFixed: res.firstIssues.filter((i) => i.action === "fixed").length,
          },
          final: {
            gapLeaks,
            unsupportedNumbers,
            matched: res.matched.length,
            matchedCovered: covered,
            removed: res.removed.length,
            rounds: res.fixRounds,
            reported: res.finalIssues.filter((i) => i.action !== "fixed").map((i) => `${i.check}: ${i.message}`),
          },
        };
        rows.push(row);
        writeFileSync(
          join(OUT, `${model}--${jd}.json`),
          JSON.stringify(
            {
              spec: res.spec,
              matched: res.matched,
              gaps: res.gaps,
              resume: res.resume,
              firstIssues: res.firstIssues,
              finalIssues: res.finalIssues,
              removed: res.removed,
              timings: res.timings,
            },
            null,
            2,
          ),
        );
        console.log(
          `${row.totalS!.toFixed(1)} s, first pass ${row.firstPass!.clean ? "clean" : JSON.stringify(row.firstPass!.fixIssues)}, rounds ${row.final!.rounds}, removed ${row.final!.removed}, leaks ${gapLeaks.length}, coverage ${covered}/${res.matched.length}`,
        );
      } catch (e) {
        rows.push({ model, jd, ok: false, error: e instanceof Error ? e.message : String(e), calls, backoffs });
        console.log(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
      }
      writeFileSync(join(OUT, "report.json"), JSON.stringify(rows, null, 2));
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }
  console.log(`\nReport: ${join(OUT, "report.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
