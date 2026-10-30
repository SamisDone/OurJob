import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LLMError, type GenerateArgs, type LLMProvider } from "./types";
import { generateValidated } from "./validate";

/**
 * Mock provider for tests, e2e and local work without a key. For each call
 * it looks in <dir>/<promptId>/ for:
 *   1. <hash>.json, an exact recording ({ output }) of this system + user prompt;
 *   2. otherwise the first *.json whose `match` strings all appear in the user
 *      prompt ({ match: ["Nadia Chowdhury"], output }).
 * Match-based fixtures survive prompt wording changes; hash files are what
 * the recording provider writes. The output still goes through the same Zod
 * validation as a real model's.
 */

export function promptHash(system: string, user: string): string {
  return createHash("sha256").update(system).update("\u0000").update(user).digest("hex").slice(0, 16);
}

type Fixture = { match?: string[]; output: unknown };

export function createMockProvider(dir = process.env.LLM_FIXTURES_DIR ?? "tests/fixtures/llm"): LLMProvider {
  function find<T>(args: GenerateArgs<T>): unknown {
    const folder = join(dir, args.promptId);
    const exact = join(folder, `${promptHash(args.system, args.user)}.json`);
    if (existsSync(exact)) return (JSON.parse(readFileSync(exact, "utf8")) as Fixture).output;
    if (existsSync(folder)) {
      for (const file of readdirSync(folder)
        .filter((f) => f.endsWith(".json"))
        .sort()) {
        const fx = JSON.parse(readFileSync(join(folder, file), "utf8")) as Fixture;
        if (fx.match?.length && fx.match.every((m) => args.user.includes(m))) return fx.output;
      }
    }
    throw new LLMError(
      "missing_fixture",
      `No mock answer for ${args.promptId}. Add ${exact}, or a fixture in ${folder} with "match" strings from the prompt.`,
    );
  }

  // LLM_MOCK_DELAY_MS: wait before each answer, so e2e can watch progress that a real model shows.
  const delay = Number(process.env.LLM_MOCK_DELAY_MS ?? 0);

  return {
    name: "mock",
    model: "mock",
    generateJSON: (args) =>
      generateValidated(args.schema, args.user, async () => {
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        return { text: JSON.stringify(find(args)), usage: { inputTokens: 0, outputTokens: 0 } };
      }),
  };
}

/**
 * Wraps a real provider and saves each validated answer as an exact-hash
 * fixture. Used by `pnpm eval:prompts --record`; never in the app. Recordings
 * of fictional fixtures only: never record real CV data.
 */
export function createRecordingProvider(real: LLMProvider, dir = "tests/fixtures/llm"): LLMProvider {
  return {
    name: `${real.name}+recording`,
    model: real.model,
    async generateJSON(args) {
      const res = await real.generateJSON(args);
      const folder = join(dir, args.promptId);
      mkdirSync(folder, { recursive: true });
      writeFileSync(
        join(folder, `${promptHash(args.system, args.user)}.json`),
        JSON.stringify({ model: real.model, output: res.data }, null, 2) + "\n",
      );
      return res;
    },
  };
}
