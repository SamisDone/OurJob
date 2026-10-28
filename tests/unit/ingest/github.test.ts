import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createPoliteClient } from "@/lib/http/polite";
import { githubToSourceText, importGitHub, parseGitHubUsername } from "@/lib/ingest/github";

const DIR = "tests/fixtures/sources/github/octocat";

/** Serves the saved real GitHub responses (API version 2026-03-10) by URL. */
function fixtureFetch(overrides: Record<string, Response> = {}) {
  const calls: string[] = [];
  const fn = (async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    calls.push(url.pathname + url.search);
    const headers = init?.headers as Record<string, string>;
    if (overrides[url.pathname]) return overrides[url.pathname].clone();
    const p = url.pathname;
    if (p === "/users/octocat") return new Response(readFileSync(`${DIR}/user.json`));
    if (p === "/users/octocat/repos") return new Response(readFileSync(`${DIR}/repos.json`));
    let m = /^\/repos\/octocat\/([^/]+)\/languages$/.exec(p);
    if (m) return new Response(readFileSync(`${DIR}/languages/${m[1]}.json`));
    m = /^\/repos\/octocat\/([^/]+)\/readme$/.exec(p);
    if (m) {
      expect(headers.accept).toBe("application/vnd.github.raw+json");
      if (existsSync(`${DIR}/readme/${m[1]}.md`)) return new Response(readFileSync(`${DIR}/readme/${m[1]}.md`));
      return new Response(readFileSync(`${DIR}/readme/${m[1]}.404.json`), { status: 404 });
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const client = (fetchFn: typeof fetch) =>
  createPoliteClient({ fetch: fetchFn, sleep: async () => {}, defaultIntervalMs: 0 });

describe("parseGitHubUsername", () => {
  it.each([
    ["octocat", "octocat"],
    ["@octocat", "octocat"],
    ["https://github.com/octocat", "octocat"],
    ["github.com/octo-cat/", "octo-cat"],
    ["  www.github.com/octocat?tab=repositories ", "octocat"],
  ])("reads %s", (input, expected) => expect(parseGitHubUsername(input)).toBe(expected));

  it.each(["", "-octocat", "octo--cat", "octo cat", "a".repeat(40), "https://gitlab.com/x/y z"])(
    "rejects %j",
    (input) => expect(parseGitHubUsername(input)).toBeNull(),
  );
});

describe("importGitHub against saved real responses", () => {
  it("keeps own repos only, newest push first, with languages and READMEs", async () => {
    const f = fixtureFetch();
    const g = await importGitHub("octocat", { client: client(f.fn), token: "" });
    expect(g.user).toMatchObject({ login: "octocat", name: "The Octocat", location: "San Francisco" });
    expect(g.repos.map((r) => r.name)).toEqual([
      "Spoon-Knife",
      "Hello-World",
      "octocat.github.io",
      "git-consortium",
      "hello-worId",
      "test-repo1",
    ]);
    expect(g.repos[0].languages).toEqual(["HTML", "CSS"]);
    expect(g.repos.find((r) => r.name === "octocat.github.io")?.languages).toEqual(["CSS", "HTML", "JavaScript"]);
    expect(g.repos[0].readme).toMatch(/Spoon-Knife|fork/i);
    expect(g.repos.find((r) => r.name === "test-repo1")?.readme).toBeNull();
    expect(g.counts).toEqual({ publicRepos: 8, ownRepos: 6, withReadme: 4 });
  });

  it("never asks for forks' languages or READMEs", async () => {
    const f = fixtureFetch();
    await importGitHub("octocat", { client: client(f.fn), token: "" });
    expect(f.calls.some((c) => c.includes("/linguist/") || c.includes("boysenberry"))).toBe(false);
  });

  it("sends the API version header and a token only when one is set", async () => {
    const seen: Record<string, string>[] = [];
    const base = fixtureFetch().fn;
    const spy = ((url: string, init?: RequestInit) => {
      seen.push(init?.headers as Record<string, string>);
      return base(url, init);
    }) as unknown as typeof fetch;
    await importGitHub("octocat", { client: client(spy), token: "test-token" });
    expect(seen[0]["x-github-api-version"]).toBe("2026-03-10");
    expect(seen[0].authorization).toBe("Bearer test-token");
  });

  it("explains an unknown user and a rate limit in plain words", async () => {
    const missing = fixtureFetch({ "/users/octocat": new Response('{"message":"Not Found"}', { status: 404 }) });
    await expect(importGitHub("octocat", { client: client(missing.fn), token: "" })).rejects.toMatchObject({
      code: "not_found",
      message: "No GitHub account is named octocat.",
    });
    const limited = fixtureFetch({ "/users/octocat": new Response("{}", { status: 403 }) });
    await expect(importGitHub("octocat", { client: client(limited.fn), token: "" })).rejects.toMatchObject({
      code: "fetch_failed",
    });
  });

  it("renders source text for P1 with descriptions, languages and README", async () => {
    const g = await importGitHub("octocat", { client: client(fixtureFetch().fn), token: "" });
    const text = githubToSourceText(g);
    expect(text).toContain("## Repository: Spoon-Knife");
    expect(text).toContain("Description: This repo is for demonstration purposes only.");
    expect(text).toContain("Languages: HTML, CSS");
    expect(text).toContain("README:");
  });
});
