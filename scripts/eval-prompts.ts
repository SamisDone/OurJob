/**
 * Runs the prompts against the real model on FICTIONAL fixtures and reports
 * how close each answer is to the hand-written expected facts.
 *   pnpm eval:prompts            P1 and P5 on tests/fixtures
 *   pnpm eval:prompts --record   also save each answer as an exact-hash mock fixture
 * Never point this at real CV data unless it lives in tests/private/ (git-ignored),
 * and never use --record with real data.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { extractUpload } from "../src/lib/ingest/files";
import type { CacheStore } from "../src/lib/llm/cache";
import { createGeminiProvider } from "../src/lib/llm/gemini";
import { createRecordingProvider } from "../src/lib/llm/mock";
import { buildProfile, suggestSearchPreferences } from "../src/lib/profile/build";
import { compareProfile, type ExpectedFacts } from "../src/lib/profile/compare";

config({ path: [".env.local", ".env"], quiet: true });

const FIXTURES: { name: string; files: [string, boolean][] }[] = [
  {
    name: "nadia-chowdhury",
    files: [
      ["cvs/nadia-chowdhury.md", false],
      ["linkedin/nadia-chowdhury-linkedin.pdf", true],
    ],
  },
  { name: "tomas-herrera", files: [["cvs/tomas-herrera.docx", false]] },
  { name: "mei-lin-tan", files: [["cvs/mei-lin-tan.pdf", false]] },
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env.local");
  const model = process.env.LLM_MODEL || "gemini-3.8-flash";
  const used: string[] = [];
  let provider = createGeminiProvider({
    apiKey,
    model,
    fallbackModel: process.env.LLM_FALLBACK_MODEL || "gemini-3.5-flash-lite",
    rpm: Number(process.env.LLM_RPM) || 8,
    log: (e) => used.push(`${e.promptId} ${e.model} ${e.ms}ms in=${e.inputTokens} out=${e.outputTokens}`),
  });
  if (process.argv.includes("--record")) provider = createRecordingProvider(provider);
  const memory = new Map<string, unknown>();
  const cache: CacheStore = { get: async (k) => memory.get(k), set: async (k, v) => void memory.set(k, v) };

  const rows: string[] = [];
  for (const fx of FIXTURES) {
    const sources = [];
    for (const [file, linkedin] of fx.files) {
      const r = await extractUpload(file.split("/").pop()!, new Uint8Array(readFileSync(`tests/fixtures/${file}`)), {
        linkedin,
      });
      sources.push({ kind: r.kind, text: r.text });
    }
    const expected = JSON.parse(readFileSync(`tests/fixtures/expected/${fx.name}.json`, "utf8")) as ExpectedFacts;
    try {
      const started = Date.now();
      const { profile } = await buildProfile(sources, { provider, cache });
      const missing = compareProfile(profile, expected);
      const prefs = await suggestSearchPreferences(profile, { provider, cache });
      rows.push(
        `\n## ${fx.name}  (${Math.round((Date.now() - started) / 1000)} s)\n` +
          `P1: ${missing.length === 0 ? "all expected facts present" : `${missing.length} missing`}\n` +
          missing.map((m) => `  - ${m}`).join("\n") +
          `\n  roles ${profile.experience.length}, bullets ${profile.experience.reduce((n, e) => n + e.bullets.length, 0)}, projects ${profile.projects.length}, skills ${profile.skills.length}, conflicts ${profile.conflicts.map((c) => c.field).join(", ") || "none"}` +
          `\nP5: titles ${prefs.targetTitles.join(" / ")}; core skills ${prefs.coreSkills.join(", ")}; seniority ${prefs.seniority.join(", ")}`,
      );
    } catch (e) {
      rows.push(`\n## ${fx.name}\nFAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(rows.join("\n"));
  console.log(`\nCalls:\n${used.map((u) => `  ${u}`).join("\n")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
