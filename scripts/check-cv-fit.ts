/**
 * Compiles tailored CVs with pdflatex (the engine Overleaf uses for this
 * template) and reports how many pages each one takes.
 *   pnpm exec tsx scripts/check-cv-fit.ts eval-output/kept2
 *   pnpm exec tsx scripts/check-cv-fit.ts eval-output/rich --profile=tests/fixtures/llm/p1-profile/tomas-varga.json
 *   pnpm exec tsx scripts/check-cv-fit.ts --master        (the master CV only)
 * Needs pdflatex on PATH (MiKTeX or TeX Live). Writes .tex, .log and .pdf to
 * <dir>/latex (git-ignored with eval-output).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCvDocument } from "../src/lib/cv/build";
import { renderLatex } from "../src/lib/latex/render";
import { p1OutputSchema } from "../src/lib/llm/prompts/p1-profile";
import { normalizeProfile } from "../src/lib/profile/normalize";
import type { TailoredResume } from "../src/lib/profile/schema";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const profilePath = arg("profile") ?? "tests/fixtures/llm/p1-profile/nadia-chowdhury.json";
const profile = normalizeProfile(p1OutputSchema.parse(JSON.parse(readFileSync(profilePath, "utf8")).output));
const master = process.argv.includes("--master");
const dir = master ? "eval-output/master" : (process.argv[2] ?? "eval-output/kept2");
const outDir = join(dir, "latex");
mkdirSync(outDir, { recursive: true });

/** pdflatex twice is not needed: no references. Returns the page count from the log. */
export function compile(tex: string, name: string): { pages: number | null; error?: string } {
  writeFileSync(join(outDir, `${name}.tex`), tex);
  try {
    execFileSync("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", `${name}.tex`], {
      cwd: outDir,
      stdio: "pipe",
      timeout: 120_000,
    });
  } catch {
    const log = readFileSync(join(outDir, `${name}.log`), "utf8");
    return { pages: null, error: log.split("\n").find((l) => l.startsWith("!")) ?? "pdflatex failed" };
  }
  const log = readFileSync(join(outDir, `${name}.log`), "utf8");
  const m = log.match(/Output written on .*?\((\d+) pages?/);
  return { pages: m ? Number(m[1]) : null };
}

const jobs: { name: string; tex: string; bullets: number }[] = [];
if (master) {
  jobs.push({ name: "master", tex: renderLatex(buildCvDocument(profile)), bullets: 0 });
} else {
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && x !== "report.json").sort()) {
    const saved = JSON.parse(readFileSync(join(dir, f), "utf8")) as { resume: TailoredResume };
    const name = f.replace(/\.json$/, "").replace(/^gemini-[^-]+(-[^-]+)*--/, "");
    const bullets = saved.resume.experience.reduce((n, e) => n + e.bullets.length, 0);
    jobs.push({ name, tex: renderLatex(buildCvDocument(profile, saved.resume)), bullets });
  }
}

console.log(`| Post | Role bullets | Pages |\n|---|---|---|`);
let over = 0;
for (const j of jobs) {
  const r = compile(j.tex, j.name);
  if (r.pages !== 1) over++;
  console.log(`| ${j.name} | ${j.bullets} | ${r.pages ?? `failed: ${r.error}`} |`);
}
console.log(`\n${jobs.length - over} of ${jobs.length} fit on one page.`);
