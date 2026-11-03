import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PoliteClient } from "@/lib/http/polite";
import { himalayas, jobicy, remotive } from "@/lib/sources/feeds";

const read = (p: string) => JSON.parse(readFileSync(`tests/fixtures/sources/${p}`, "utf8"));

/** Answers each URL from a fixture by host and path, and records the URLs asked for. */
function fakeHttp(bodies: Record<string, (url: URL) => unknown>) {
  const asked: string[] = [];
  const http = {
    async getJson(raw: string) {
      asked.push(raw);
      const url = new URL(raw);
      const body = bodies[`${url.host}${url.pathname}`];
      if (!body) throw new Error(`no fixture for ${raw}`);
      return body(url);
    },
  } as unknown as PoliteClient;
  return { http, asked };
}

describe("Himalayas (real search response, country BD)", () => {
  const page1 = read("himalayas/search-bd.json");
  const now = new Date("2026-11-03T00:00:00Z");
  const { http, asked } = fakeHttp({
    "himalayas.app/jobs/api/search": (u) => (u.searchParams.get("page") === "1" ? page1 : { jobs: [] }),
  });

  it("searches his country, keeps jobs updated in the last 7 days, and never treats the update date as a post date", async () => {
    const jobs = await himalayas.fetch({ http, countries: ["BD"], now });
    expect(asked[0]).toMatch(/country=BD/);
    expect(asked[0]).toMatch(/sort=recent/);
    // The 17 October job was last updated more than 7 days before; the 2 November one is kept.
    expect(jobs.map((j) => j.title)).toEqual(["Web3 Engineer (Contract Role)"]);
    const [j] = jobs;
    expect(j).toMatchObject({
      source: "himalayas",
      tier: 2,
      companyName: "Asset Bridge",
      workplace: "remote",
      postedAt: undefined,
      postedAtSource: "unknown",
      employmentType: "contract",
      attribution: { label: "Himalayas" },
    });
    // Their terms: Apply uses applicationLink unchanged; the job leaves the feed at its expiry date.
    expect(j.applyUrl).toBe(page1.jobs[1].applicationLink);
    expect(j.closesAt?.toISOString()).toBe("2027-01-01T14:30:45.000Z");
    expect(j.remoteScope.countries).toContain("BD");
  });

  it("an empty restriction list is anywhere, and hourly USD pay becomes yearly", async () => {
    const old = { ...page1.jobs[0], pubDate: now.getTime() / 1000 - 3600 };
    const one = fakeHttp({
      "himalayas.app/jobs/api/search": (u) => (u.searchParams.get("page") === "1" ? { jobs: [old] } : { jobs: [] }),
    });
    const [j] = await himalayas.fetch({ http: one.http, countries: ["BD"], now });
    expect(j.remoteScope.kind).toBe("worldwide");
    expect(j.salary).toMatchObject({ min: 100, currency: "USD", period: "hour", annualUsdMin: 208000 });
  });
});

describe("Remotive (real response)", () => {
  const { http } = fakeHttp({ "remotive.com/api/remote-jobs": () => read("remotive/all.json") });

  it("reads the UTC post date, the location text, the pay text, and links back to Remotive", async () => {
    const jobs = await remotive.fetch({ http, countries: [], now: new Date() });
    expect(jobs).toHaveLength(4);
    const fs = jobs.find((j) => j.sourceJobId === "2091165")!;
    expect(fs.postedAt?.toISOString()).toBe("2026-10-29T18:22:41.000Z");
    expect(fs.remoteScope.kind).toBe("worldwide");
    expect(fs.salary).toMatchObject({ min: 3500, max: 5000, period: "month", annualUsdMax: 60000 });
    expect(fs.applyUrl).toBe("https://remotive.com/remote-jobs/software-development/full-stack-developer-2091165");
    expect(fs.attribution).toEqual({ label: "Remotive", url: fs.applyUrl });
    const apac = jobs.find((j) => j.sourceJobId === "2091133")!;
    expect(apac.remoteScope.regions).toContain("APAC");
  });
});

describe("Jobicy (real response)", () => {
  const { http, asked } = fakeHttp({ "jobicy.com/api/jobs": () => read("jobicy/engineering.json") });

  it("asks for engineering and DevOps, reads post date, geo and pay, and links to the Jobicy page", async () => {
    const jobs = await jobicy.fetch({ http, countries: [], now: new Date() });
    expect(asked.map((u) => new URL(u).searchParams.get("industry"))).toEqual(["engineering", "admin"]);
    expect(jobs).toHaveLength(5);
    const reddit = jobs.find((j) => j.sourceJobId === "158567")!;
    expect(reddit).toMatchObject({
      companyName: "Reddit",
      employmentType: "full_time",
      postedAtSource: "source_field",
    });
    expect(reddit.remoteScope.countries).toEqual(["US"]);
    expect(reddit.salary).toMatchObject({ annualUsdMin: 165000, annualUsdMax: 229000, source: "structured" });
    expect(reddit.applyUrl).toMatch(/^https:\/\/jobicy\.com\/jobs\//);
    expect(jobs.find((j) => j.sourceJobId === "158531")!.remoteScope.countries?.sort()).toEqual(["AU", "NZ"]);
    expect(jobs.find((j) => j.sourceJobId === "158549")!.remoteScope.countries?.sort()).toEqual(["CA", "GB", "US"]);
  });
});
