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

type Usage = { inputTokens: number; outputTokens: number };

type Models = Pick<GoogleGenAI["models"], "generateContent">;

export type GeminiOptions = {
  apiKey: string;
  model: string;
  /** Tried after the main model keeps answering 429 or 503. */
  fallbackModel?: string;
  /**
   * Asked as well when the main model is slow (slowMs). Default: the main
   * model again, a second request that often comes back sooner. Busy errors
   * (429, 503) still go to fallbackModel, since asking the same model again
   * cannot help there.
   */
  hedgeModel?: string;
  /** Requests per minute to stay under. Free-tier limits are shown in AI Studio. */
  rpm?: number;
  retries?: number;
  /** Per-request timeout in ms for the SDK's own HTTP layer. */
  timeoutMs?: number;
  /**
   * Our limit per model request in ms (default 35 s). A request that has not
   * answered by then is cancelled and the fallback model is asked.
   */
  callTimeoutMs?: number;
  /**
   * When the main model has not answered after this many ms, the fallback
   * model is asked too and the first answer wins (the other request is
   * cancelled). Default 10 s.
   */
  slowMs?: number;
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
  const slowMs = opts.slowMs ?? 10_000;
  const callTimeoutMs = opts.callTimeoutMs ?? 35_000;
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

  async function callModel<T>(model: string, args: GenerateArgs<T>, user: string, signal?: AbortSignal) {
    const schema = toGeminiSchema(args.schema);
    for (let attempt = 0; ; attempt++) {
      await waitForSlot();
      if (signal?.aborted) throw new LLMError("unavailable", "Cancelled: the other model answered first.");
      const started = now();
      // Our own limit per request: with an abortSignal passed, the SDK's timeout does not apply, and a request
      // that never answers once held a tailoring for 300 s until Vercel killed it (2026-11-02).
      const timeout = AbortSignal.timeout(callTimeoutMs);
      const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
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
            abortSignal,
          },
        });
        const usage = {
          inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
        };
        log({ promptId: args.promptId, model, ms: now() - started, ...usage });
        return { text: res.text ?? "", usage };
      } catch (e) {
        if (signal?.aborted) throw new LLMError("unavailable", "Cancelled: the other model answered first.");
        // Not retried: another 35 s on the same model would not help; the caller asks another model.
        if (timeout.aborted) throw new LLMError("unavailable", `Gemini did not answer in ${callTimeoutMs / 1000} s.`);
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

  const busyError = (e: unknown) => e instanceof LLMError && (e.code === "unavailable" || e.code === "rate_limited");

  /**
   * The main model, with two kinds of backup. When it has not answered after
   * slowMs, the hedge model (lite) is asked as well. When a call fails busy,
   * rate limited or timed out, the fallback model is asked, once, even if the
   * hedge is already running. The first answer wins and the others are
   * cancelled; the call fails only when every request has failed.
   */
  function callOnce<T>(args: GenerateArgs<T>, user: string): Promise<{ text: string; usage: Usage }> {
    const fallback = opts.fallbackModel && opts.fallbackModel !== opts.model ? opts.fallbackModel : null;
    const slowHedge = opts.hedgeModel ?? opts.model;
    return new Promise((resolve, reject) => {
      let done = false;
      let running = 0;
      let hedged = false;
      let fellBack = false;
      const controllers: AbortController[] = [];
      const errors: unknown[] = [];
      const finish = (winner?: AbortController) => {
        done = true;
        clearTimeout(timer);
        controllers.filter((c) => c !== winner).forEach((c) => c.abort());
      };
      const run = (model: string, why?: string) => {
        if (done) return;
        if (why) console.info(`[llm] ${args.promptId}: ${why}, also asking ${model}`);
        const c = new AbortController();
        controllers.push(c);
        running++;
        callModel(model, args, user, c.signal).then(
          (v) => {
            if (done) return;
            finish(c);
            resolve(v);
          },
          (e) => {
            errors.push(e);
            if (!done && !fellBack && fallback && model !== fallback && busyError(e)) {
              fellBack = true;
              run(
                fallback,
                `${model} ${e instanceof LLMError && e.message.startsWith("Gemini did not answer") ? "timed out" : "is busy"}`,
              );
            }
            if (done || --running > 0) return;
            finish();
            // The last error says most: a daily limit or a timeout of the model asked last.
            reject(errors.at(-1));
          },
        );
      };
      const timer = setTimeout(() => {
        if (hedged) return;
        hedged = true;
        run(slowHedge, `${opts.model} has not answered in ${slowMs / 1000} s`);
      }, slowMs);
      run(opts.model);
    });
  }

  return {
    name: "gemini",
    model: opts.model,
    generateJSON: (args) => generateValidated(args.schema, args.user, (user) => callOnce(args, user)),
  };
}
