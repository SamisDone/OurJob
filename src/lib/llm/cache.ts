import { createHash } from "node:crypto";
import type { GenerateArgs, LLMProvider, Usage } from "./types";

/**
 * llm_cache: the same prompt (id, version, model, input) is never paid for
 * twice. The store is injected so tests run without a database.
 */
export type CacheStore = {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, output: unknown): Promise<void>;
};

export function cacheKey(args: {
  promptId: string;
  promptVersion: string;
  model: string;
  system: string;
  user: string;
}) {
  return createHash("sha256")
    .update(JSON.stringify([args.promptId, args.promptVersion, args.model, args.system, args.user]))
    .digest("hex");
}

export async function cachedGenerate<T>(
  provider: LLMProvider,
  store: CacheStore,
  promptVersion: string,
  args: GenerateArgs<T>,
): Promise<{ data: T; usage: Usage; cached: boolean }> {
  const key = cacheKey({ ...args, promptVersion, model: `${provider.name}:${provider.model}` });
  const hit = await store.get(key);
  if (hit !== undefined) {
    const parsed = args.schema.safeParse(hit);
    if (parsed.success) return { data: parsed.data, usage: { inputTokens: 0, outputTokens: 0 }, cached: true };
  }
  const res = await provider.generateJSON(args);
  await store.set(key, res.data);
  return { ...res, cached: false };
}
