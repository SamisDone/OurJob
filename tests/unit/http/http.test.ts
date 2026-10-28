import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPoliteClient, PoliteHttpError, retryAfterMs } from "@/lib/http/polite";
import { assertFetchableUrl, guardedLookup, isPublicAddress, safeFetch } from "@/lib/http/ssrf";
import { USER_AGENT } from "@/lib/http/user-agent";

/** A fake clock: sleep advances time instantly and records each wait. */
function fakeTime() {
  let t = 0;
  const waits: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      waits.push(ms);
      t += ms;
    },
    waits,
  };
}

function fakeFetch(responses: (Response | Error)[]) {
  const calls: { url: string; at?: number; headers: Record<string, string> }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers as Record<string, string> });
    const next = responses.shift() ?? new Response("{}", { status: 200 });
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("polite client", () => {
  it("sends the OurJob User-Agent", async () => {
    const f = fakeFetch([new Response("ok")]);
    const time = fakeTime();
    await createPoliteClient({ fetch: f.fn, ...time }).get("https://api.example.com/a");
    expect(f.calls[0].headers["user-agent"]).toBe(USER_AGENT);
    expect(USER_AGENT).toMatch(/^OurJob\/\d+\.\d+\.\d+ \(\+https:\/\/github\.com\/SamisDone\/OurJob\)$/);
  });

  it("waits at least 1 s between requests to the same host, not across hosts", async () => {
    const f = fakeFetch([]);
    const time = fakeTime();
    const c = createPoliteClient({ fetch: f.fn, ...time });
    await c.get("https://a.example.com/1");
    await c.get("https://a.example.com/2");
    await c.get("https://b.example.com/1");
    await c.get("https://a.example.com/3");
    expect(time.waits).toEqual([1000, 1000]);
  });

  it("uses a stricter interval where a source asks for one", async () => {
    const time = fakeTime();
    const c = createPoliteClient({ fetch: fakeFetch([]).fn, ...time, hostIntervalMs: { "apply.workable.com": 3000 } });
    await c.get("https://apply.workable.com/api/1");
    await c.get("https://apply.workable.com/api/2");
    expect(time.waits).toEqual([3000]);
  });

  it("retries 429 using Retry-After, then succeeds", async () => {
    const f = fakeFetch([
      new Response("", { status: 429, headers: { "retry-after": "7" } }),
      new Response("done", { status: 200 }),
    ]);
    const time = fakeTime();
    const res = await createPoliteClient({ fetch: f.fn, ...time }).get("https://x.example.com/");
    expect(res.text).toBe("done");
    expect(time.waits).toContain(7000);
  });

  it("backs off exponentially on 5xx and gives up after 3 retries", async () => {
    const f = fakeFetch(Array.from({ length: 4 }, () => new Response("", { status: 503 })));
    const time = fakeTime();
    const c = createPoliteClient({ fetch: f.fn, ...time, random: () => 0 });
    await expect(c.get("https://x.example.com/")).rejects.toBeInstanceOf(PoliteHttpError);
    expect(f.calls).toHaveLength(4);
    // Backoff waits are 1 s, 2 s, 4 s; host-interval waits are folded into them.
    expect(time.waits.filter((w) => [1000, 2000, 4000].includes(w))).toEqual([1000, 2000, 4000]);
  });

  it("does not retry a 404", async () => {
    const f = fakeFetch([new Response("", { status: 404 })]);
    await expect(createPoliteClient({ fetch: f.fn, ...fakeTime() }).get("https://x.example.com/")).rejects.toMatchObject({
      status: 404,
    });
    expect(f.calls).toHaveLength(1);
  });

  it("fetches the same URL only once per run", async () => {
    const f = fakeFetch([new Response('{"a":1}')]);
    const c = createPoliteClient({ fetch: f.fn, ...fakeTime() });
    const [a, b] = await Promise.all([c.getJson("https://x.example.com/j"), c.getJson("https://x.example.com/j")]);
    expect(a).toEqual({ a: 1 });
    expect(b).toEqual({ a: 1 });
    expect(f.calls).toHaveLength(1);
  });

  it("parses Retry-After as seconds or a date, capped at 60 s", () => {
    expect(retryAfterMs("3", 0)).toBe(3000);
    expect(retryAfterMs("999", 0)).toBe(60_000);
    expect(retryAfterMs(new Date(5000).toUTCString(), 0)).toBe(5000);
    expect(retryAfterMs(null, 0)).toBeNull();
  });
});

describe("SSRF guard", () => {
  it.each([
    ["8.8.8.8", true],
    ["2606:4700:4700::1111", true],
    ["127.0.0.1", false],
    ["10.1.2.3", false],
    ["172.16.0.1", false],
    ["192.168.1.1", false],
    ["169.254.169.254", false],
    ["100.64.0.1", false],
    ["0.0.0.0", false],
    ["::1", false],
    ["fc00::1", false],
    ["fe80::1", false],
    ["::ffff:127.0.0.1", false],
    ["::ffff:10.0.0.1", false],
    ["224.0.0.1", false],
  ])("isPublicAddress(%s) is %s", (ip, ok) => {
    expect(isPublicAddress(ip)).toBe(ok);
  });

  it.each([
    "ftp://example.com/file",
    "file:///etc/passwd",
    "http://user:pass@example.com/",
    "http://example.com:22/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:3000/",
    "http://printer.local/",
    "not a url",
  ])("refuses %s", (url) => {
    expect(() => assertFetchableUrl(url)).toThrow(expect.objectContaining({ code: "blocked_url" }));
  });

  it("accepts ordinary public addresses", () => {
    expect(assertFetchableUrl("https://example.com/portfolio").hostname).toBe("example.com");
    expect(assertFetchableUrl("http://example.com:8080/").port).toBe("8080");
  });

  it("refuses a hostname that resolves to a private address at connect time", async () => {
    const err = await new Promise<Error | null>((resolve) => guardedLookup("localhost", {}, (e) => resolve(e)));
    expect(err).toMatchObject({ code: "blocked_url" });
  });

  describe("against a real local server", () => {
    let server: http.Server;
    let port = 0;
    beforeAll(async () => {
      server = http.createServer((_, res) => res.end("secret"));
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      port = (server.address() as AddressInfo).port;
    });
    afterAll(() => new Promise<void>((r) => server.close(() => r())));

    it("never reaches a loopback server", async () => {
      await expect(safeFetch(`http://127.0.0.1:${port}/`)).rejects.toMatchObject({ code: "blocked_url" });
    });
  });
});
