import { USER_AGENT } from "./user-agent";

/**
 * Polite HTTP for the fixed hosts we call (GitHub API, ATS boards, job
 * boards): at most one request per interval per host (1 s by default,
 * stricter where a source asks), retries with exponential backoff and jitter
 * on 429 and 5xx that honor Retry-After, a descriptive User-Agent, and a
 * per-run cache so the same URL is not fetched twice. User-supplied URLs go
 * through safeFetch in ./ssrf instead.
 */

export type PoliteOptions = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  /** Minimum gap between requests to the same host, in ms. */
  hostIntervalMs?: Record<string, number>;
  defaultIntervalMs?: number;
  retries?: number;
  timeoutMs?: number;
};

export class PoliteHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = "PoliteHttpError";
  }
}

const RETRYABLE = (status: number) => status === 429 || (status >= 500 && status < 600);

/** Parses Retry-After (seconds or an HTTP date) into ms, capped at 60 s. */
export function retryAfterMs(header: string | null, now: number): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.min(60_000, Math.max(0, secs * 1000));
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.min(60_000, Math.max(0, at - now));
}

export function createPoliteClient(options: PoliteOptions = {}) {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const nextSlot = new Map<string, number>();
  const cache = new Map<string, Promise<{ status: number; headers: Headers; text: string }>>();

  const intervalFor = (host: string) => options.hostIntervalMs?.[host] ?? options.defaultIntervalMs ?? 1000;

  /** Reserves the next free slot for a host and waits for it. */
  async function waitTurn(host: string) {
    const t = now();
    const slot = Math.max(t, nextSlot.get(host) ?? 0);
    nextSlot.set(host, slot + intervalFor(host));
    if (slot > t) await sleep(slot - t);
  }

  async function attempt(url: string, headers: Record<string, string>) {
    const host = new URL(url).host;
    for (let i = 0; ; i++) {
      await waitTurn(host);
      let res: Response;
      try {
        res = await doFetch(url, {
          headers: { "user-agent": USER_AGENT, ...headers },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        if (i >= retries) throw e;
        await sleep(backoff(i));
        continue;
      }
      if (RETRYABLE(res.status) && i < retries) {
        const wait = retryAfterMs(res.headers.get("retry-after"), now()) ?? backoff(i);
        await sleep(wait);
        continue;
      }
      return { status: res.status, headers: res.headers, text: await res.text() };
    }
  }

  /** 1 s, 2 s, 4 s... with up to 30% jitter. */
  function backoff(i: number) {
    return Math.round(1000 * 2 ** i * (1 + random() * 0.3));
  }

  return {
    /** GET with caching per client. Throws PoliteHttpError on a final non-2xx. */
    async get(url: string, headers: Record<string, string> = {}) {
      const key = `${url}\n${JSON.stringify(headers)}`;
      let pending = cache.get(key);
      if (!pending) {
        pending = attempt(url, headers);
        cache.set(key, pending);
        pending.catch(() => cache.delete(key));
      }
      const res = await pending;
      if (res.status < 200 || res.status >= 300) {
        cache.delete(key);
        throw new PoliteHttpError(res.status, url, `GET ${url} answered ${res.status}`);
      }
      return res;
    },
    async getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
      const res = await this.get(url, { accept: "application/json", ...headers });
      return JSON.parse(res.text) as T;
    },
  };
}

export type PoliteClient = ReturnType<typeof createPoliteClient>;
