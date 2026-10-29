import { ApiError, GoogleGenAI } from "@google/genai";
import { toGeminiSchema } from "./json-schema";
import { LLMError, type GenerateArgs, type LLMProvider } from "./types";
import { generateValidated } from "./validate";

/**
 * Gemini through the official @google/genai SDK (2.31): generateContent with
 * responseMimeType "application/json" and responseJsonSchema, checked against
 * a real response (tests/fixtures/llm/gemini/structured-response.json).
 * A small token bucket keeps under the free tier's per-minute limit; 429 and
 * 5xx back off and retry, then fall back to a second free-tier model when the
 * main one stays busy. Logs carry the prompt id, model, token counts and
 * latency, never the prompt text (it can contain CV text).
 */

type Models = Pick<GoogleGenAI["models"], "generateContent">;

export type GeminiOptions = {
  apiKey: string;
  model: string;
  /** Tried after the main model keeps answering 429 or 503. */
  fallbackModel?: string;
  /** Requests per minute to stay under. Free-tier limits are shown in AI Studio. */
  rpm?: number;
  retries?: number;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
  models?: Models;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (entry: { promptId: string; model: string; ms: number; inputTokens: number; outputTokens: number }) => void;
};

/**
 * A 429 for a per-day quota (quotaId "...PerDay...", 20 requests per model on
 * the free tier, seen 2026-10-29; tests/fixtures/llm/gemini/daily-quota-429.json).
 * Retrying cannot help, so it skips straight to the fallback. Returns the wait
 * in ms from RetryInfo, or 0 when it is not a daily quota.
 */
export function dailyQuotaWait(e: unknown): number {
  const text = e instanceof Error ? e.message : "";
  if (!/"quotaId":\s*"[^"]*PerDay/.test(text)) return 0;
  const delay = text.match(/"retryDelay":\s*"(\d+)s"/);
  return delay ? Number(delay[1]) * 1000 : 24 * 3_600_000;
}

function statusOf(e: unknown): number | undefined {
  return e instanceof ApiError ? e.status : (e as { status?: number } | null)?.status;
}

export function createGeminiProvider(opts: GeminiOptions): LLMProvider {
  // The SDK retries 408/429/5xx up to 5 times with delays up to 60 s by default;
  // a busy model then blocks for minutes. Retries and timeouts are ours instead.
  const models =
    opts.models ??
    new GoogleGenAI({
      apiKey: opts.apiKey,
      httpOptions: { timeout: opts.timeoutMs ?? 90_000, retryOptions: { attempts: 1 } },
    }).models;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const rpm = opts.rpm ?? 8;
  const retries = opts.retries ?? 3;
  const log =
    opts.log ??
    ((e) => console.info(`[llm] ${e.promptId} ${e.model} ${e.ms}ms in=${e.inputTokens} out=${e.outputTokens}`));
  const recent: number[] = [];

  async function waitForSlot() {
    for (;;) {
      const t = now();
      while (recent.length && t - recent[0] >= 60_000) recent.shift();
      if (recent.length < rpm) {
        recent.push(t);
        return;
      }
      await sleep(60_000 - (t - recent[0]) + 50);
    }
  }

  async function callModel<T>(model: string, args: GenerateArgs<T>, user: string) {
    const schema = toGeminiSchema(args.schema);
    for (let attempt = 0; ; attempt++) {
      await waitForSlot();
      const started = now();
      try {
        const res = await models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: user }] }],
          config: {
            systemInstruction: args.system,
            temperature: args.temperature,
            maxOutputTokens: args.maxOutputTokens,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
          },
        });
        const usage = {
          inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
        };
        log({ promptId: args.promptId, model, ms: now() - started, ...usage });
        return { text: res.text ?? "", usage };
      } catch (e) {
        const status = statusOf(e);
        if (status === 401 || status === 403) {
          throw new LLMError(
            "auth",
            "Gemini did not accept the API key. Check GEMINI_API_KEY in the deployment's settings.",
          );
        }
        const daily = status === 429 ? dailyQuotaWait(e) : 0;
        if (daily) {
          const hours = Math.max(1, Math.round(daily / 3_600_000));
          throw new LLMError(
            "rate_limited",
            `Gemini's free daily limit for this model is used up. It resets in about ${hours} ${hours === 1 ? "hour" : "hours"}.`,
            daily,
          );
        }
        const busy = status === 429 || (status !== undefined && status >= 500);
        if (busy && attempt < retries) {
          await sleep(Math.round(2000 * 2 ** attempt * (1 + Math.random() * 0.3)));
          continue;
        }
        if (status === 429) {
          throw new LLMError(
            "rate_limited",
            "Gemini's rate limit was reached. Wait about a minute, or try again now.",
            60_000,
          );
        }
        throw new LLMError("unavailable", "Gemini is busy and did not answer. Try again in a minute.");
      }
    }
  }

  async function callOnce<T>(args: GenerateArgs<T>, user: string) {
    try {
      return await callModel(opts.model, args, user);
    } catch (e) {
      const canFallBack =
        opts.fallbackModel &&
        opts.fallbackModel !== opts.model &&
        e instanceof LLMError &&
        (e.code === "unavailable" || e.code === "rate_limited");
      if (!canFallBack) throw e;
      console.info(`[llm] ${args.promptId}: ${opts.model} is busy, using ${opts.fallbackModel}`);
      return callModel(opts.fallbackModel!, args, user);
    }
  }

  return {
    name: "gemini",
    model: opts.model,
    generateJSON: (args) => generateValidated(args.schema, args.user, (user) => callOnce(args, user)),
  };
}
