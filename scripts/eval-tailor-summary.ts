/**
 * Summarizes a pnpm eval:tailor run: time, validator results and two quality
 * signals the validator cannot see (how much was reworded, and whether matched
 * keywords reached the bullets or only the skills list).
 *   pnpm exec tsx scripts/eval-tailor-summary.ts eval-output/run1
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchKeyword } from "../src/lib/ats/match";
import { p1OutputSchema } from "../src/lib/llm/prompts/p1-profile";
import { normalizeProfile } from "../src/lib/profile/normalize";
import type { TailoredResume } from "../src/lib/profile/schema";
import type { MatchedKeyword } from "../src/lib/tailor/keywords";

const dir = process.argv[2] ?? "eval-output/run1";
const profile = normalizeProfile(
  p1OutputSchema.parse(JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/nadia-chowdhury.json", "utf8")).output),
);
const sourceTexts = new Set(
  [...profile.experience, ...profile.projects].flatMap((x) => x.bullets.map((b) => norm(b.text))),
);
function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9%+]+/g, " ")
    .trim();
}

type Row = {
  model: string;
  jd: string;
  ok: boolean;
  error?: string;
  totalS?: number;
  parseS?: number;
  tailorS?: number;
  fixS?: number[];
  backoffs?: number;
  calls?: { model: string }[];
  firstPass?: { clean: boolean; fixIssues: Record<string, number> };
  final?: {
    gapLeaks: string[];
    unsupportedNumbers: string[];
    matched: number;
    matchedCovered: number;
    removed: number;
    rounds: number;
  };
};

const rows = JSON.parse(readFileSync(join(dir, "report.json"), "utf8")) as Row[];
const lines = [
  "| Model | Post | Time (s) | P2 / P3 / fixes (s) | First pass | Fix rounds | Removed | Gap leaks | Unsupported numbers | Matched used | In bullets | Reworded |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|",
];
const agg = new Map<
  string,
  {
    n: number;
    ok: number;
    times: number[];
    clean: number;
    leaks: number;
    nums: number;
    cov: [number, number];
    bul: [number, number];
    rew: [number, number];
    removed: number;
  }
>();

for (const r of rows) {
  const a = agg.get(r.model) ?? {
    n: 0,
    ok: 0,
    times: [],
    clean: 0,
    leaks: 0,
    nums: 0,
    cov: [0, 0],
    bul: [0, 0],
    rew: [0, 0],
    removed: 0,
  };
  agg.set(r.model, a);
  a.n++;
  const short = r.model.replace("gemini-", "");
  if (!r.ok || !r.final || !r.firstPass) {
    lines.push(`| ${short} | ${r.jd} | failed | | ${r.error ?? ""} | | | | | | | |`);
    continue;
  }
  a.ok++;
  const saved = JSON.parse(readFileSync(join(dir, `${r.model}--${r.jd}.json`), "utf8")) as {
    resume: TailoredResume;
    matched: MatchedKeyword[];
  };
  const bullets = [...saved.resume.experience, ...saved.resume.projects].flatMap((e) => e.bullets);
  const reworded = bullets.filter((b) => !sourceTexts.has(norm(b.text))).length;
  const bulletSections = {
    experience: saved.resume.experience.flatMap((e) => e.bullets.map((b) => b.text)),
    projects: saved.resume.projects.flatMap((p) => p.bullets.map((b) => b.text)),
  };
  const inBullets = saved.matched.filter(
    (m) => matchKeyword(m, bulletSections, { techTerms: profile.skills.map((s) => s.name) }).found,
  ).length;
  const fell = r.calls?.some((c) => c.model !== r.model) ? " (fallback)" : "";
  a.times.push(r.totalS!);
  if (r.firstPass.clean) a.clean++;
  a.leaks += r.final.gapLeaks.length;
  a.nums += r.final.unsupportedNumbers.length;
  a.cov[0] += r.final.matchedCovered;
  a.cov[1] += r.final.matched;
  a.bul[0] += inBullets;
  a.bul[1] += saved.matched.length;
  a.rew[0] += reworded;
  a.rew[1] += bullets.length;
  a.removed += r.final.removed;
  const first = r.firstPass.clean
    ? "clean"
    : Object.entries(r.firstPass.fixIssues)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ");
  lines.push(
    `| ${short}${fell} | ${r.jd} | ${r.totalS!.toFixed(1)} | ${r.parseS!.toFixed(1)} / ${r.tailorS!.toFixed(1)} / ${(r.fixS ?? []).map((s) => s.toFixed(1)).join(" + ") || "0"} | ${first} | ${r.final.rounds} | ${r.final.removed} | ${r.final.gapLeaks.length} | ${r.final.unsupportedNumbers.length} | ${r.final.matchedCovered}/${r.final.matched} | ${inBullets}/${saved.matched.length} | ${reworded}/${bullets.length} |`,
  );
}

console.log(lines.join("\n"));
console.log(
  "\n| Model | Runs ok | Median time (s) | Max time (s) | Under 45 s | First pass clean | Gap leaks | Unsupported numbers | Removed | Matched used | In bullets | Reworded |",
);
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const [model, a] of agg) {
  const sorted = [...a.times].sort((x, y) => x - y);
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : NaN;
  const pct = (x: [number, number]) => `${x[0]}/${x[1]}`;
  console.log(
    `| ${model} | ${a.ok}/${a.n} | ${median.toFixed(1)} | ${Math.max(...sorted).toFixed(1)} | ${sorted.filter((t) => t < 45).length}/${a.ok} | ${a.clean}/${a.ok} | ${a.leaks} | ${a.nums} | ${a.removed} | ${pct(a.cov)} | ${pct(a.bul)} | ${pct(a.rew)} |`,
  );
}
