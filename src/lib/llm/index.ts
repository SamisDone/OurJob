import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { CacheStore } from "./cache";
import { createGeminiProvider } from "./gemini";
import { createMockProvider } from "./mock";
import { LLMError, type LLMProvider } from "./types";

export { cachedGenerate } from "./cache";
export { LLMError } from "./types";
export type { LLMProvider } from "./types";

/** Default model: the newest Flash model Google lists as free-tier eligible (checked 2026-10-29). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
/** Sam's choice for when the main model stays busy (503) or rate limited. Also free-tier eligible. */
export const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

let provider: LLMProvider | undefined;

/** LLM_PROVIDER=gemini (default) or mock. Gemini needs GEMINI_API_KEY. */
export function getLLMProvider(): LLMProvider {
  if (provider) return provider;
  const kind = process.env.LLM_PROVIDER || "gemini";
  if (kind === "mock") {
    provider = createMockProvider();
  } else if (kind === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new LLMError("auth", "No Gemini API key is set. Add GEMINI_API_KEY to the deployment's environment.");
    }
    provider = createGeminiProvider({
      apiKey,
      model: process.env.LLM_MODEL || DEFAULT_GEMINI_MODEL,
      fallbackModel: process.env.LLM_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL,
      rpm: Number(process.env.LLM_RPM) || undefined,
    });
  } else {
    throw new LLMError("auth", `Unknown LLM_PROVIDER "${kind}". Use gemini or mock.`);
  }
  return provider;
}

/** llm_cache table as the cache store. */
export const dbCacheStore: CacheStore = {
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
};
