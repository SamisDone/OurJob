import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADAPTERS, employmentType, splitLocations } from "@/lib/sources/boards";
import { htmlToText, sanitizeHtml } from "@/lib/sources/html";
import { normalizePosting } from "@/lib/sources/normalize";
import type { AtsType } from "@/lib/sources/types";

const fixture = (ats: AtsType, name: string) =>
  JSON.parse(readFileSync(`tests/fixtures/sources/${ats}/${name}.json`, "utf8")) as unknown;
const normalized = (ats: AtsType, slug: string, company: string) =>
  ADAPTERS[ats]
    .parse(fixture(ats, slug))
    .map((p) => normalizePosting(p, ADAPTERS[ats], { ats, slug, companyName: company }));

describe("Greenhouse (real response, gitlab)", () => {
  const jobs = normalized("greenhouse", "gitlab", "GitLab");

  it("reads every posting with first_published as the post date, never updated_at", () => {
    expect(jobs).toHaveLength(4);
    const kg = jobs.find((j) => j.title === "Backend Engineer, Knowledge Graph")!;
    expect(kg.postedAt?.toISOString()).toBe("2026-10-23T22:47:07.000Z");
    expect(kg.postedAtSource).toBe("source_field");
    expect(kg.applyUrl).toMatch(/^https:\/\/job-boards\.greenhouse\.io\/gitlab\/jobs\/\d+$/);
  });

  it("decodes the entity-encoded HTML, keeps only safe tags, and writes text", () => {
    const j = jobs[0];
    expect(j.descriptionHtml).not.toMatch(/&lt;|<div|style=|class=/);
    expect(j.descriptionText.length).toBeGreaterThan(200);
    expect(j.descriptionText).not.toMatch(/<[a-z]/i);
  });

  it("splits locations and reads remote scope from them", () => {
    const byLoc = Object.fromEntries(jobs.map((j) => [j.locationRaw, j]));
    expect(byLoc["Remote"].remoteScope.kind).toBe("unknown");
    expect(byLoc["Remote, United States"].remoteScope).toMatchObject({ kind: "countries", countries: ["US"] });
    expect(byLoc["Remote, Canada; Remote, United States"].remoteScope.countries?.sort()).toEqual(["CA", "US"]);
    expect(byLoc["Bangalore, India"]).toMatchObject({ workplace: "onsite", remoteScope: { countries: ["IN"] } });
  });
});

describe("Lever (real response, spotify)", () => {
  const jobs = normalized("lever", "spotify", "Spotify");

  it("reads createdAt (ms), workplaceType, commitment and the US pay range in the additional text", () => {
    expect(jobs.map((j) => j.workplace)).toEqual(["remote", "hybrid", "onsite"]);
    expect(jobs[0].postedAt).toBeInstanceOf(Date);
    expect(jobs[0].remoteScope).toMatchObject({ kind: "countries", countries: ["US"] });
    expect(jobs[1].remoteScope.countries).toEqual(["SE"]);
    const paid = jobs.find((j) => j.salary);
    expect(paid?.salary).toMatchObject({ currency: "USD", period: "year", source: "parsed_text" });
    expect(paid!.salary!.min).toBeLessThan(paid!.salary!.max!);
  });
});

describe("Ashby (real response, linear)", () => {
  const jobs = normalized("ashby", "linear", "Linear");

  it("reads publishedAt, workplace, employment type and region names from locations and addresses", () => {
    expect(jobs.map((j) => j.workplace)).toEqual(["remote", "hybrid", "remote"]);
    expect(jobs.every((j) => j.employmentType === "full_time")).toBe(true);
    const fullstack = jobs.find((j) => /Fullstack/.test(j.title))!;
    expect(fullstack.remoteScope).toMatchObject({ kind: "regions", regions: ["Europe"] });
    expect(fullstack.postedAt?.toISOString()).toBe("2021-04-27T20:13:45.158Z");
    expect(jobs[0].remoteScope.regions).toEqual(expect.arrayContaining(["North America", "Europe"]));
  });

  it("skips unlisted postings and postings it cannot read", () => {
    const raw = fixture("ashby", "linear") as { jobs: Record<string, unknown>[] };
    const extra = { jobs: [...raw.jobs, { ...raw.jobs[0], id: "x", isListed: false }, { title: 3 }] };
    expect(ADAPTERS.ashby.parse(extra)).toHaveLength(3);
  });
});

describe("not-found boards and helpers", () => {
  it("a not-found body has no postings", () => {
    expect(ADAPTERS.greenhouse.parse(fixture("greenhouse", "not-found"))).toEqual([]);
    expect(ADAPTERS.lever.parse(fixture("lever", "not-found"))).toEqual([]);
  });

  it("splits location lists and reads employment types", () => {
    expect(splitLocations("Remote, Canada; Remote, Poland | Berlin")).toEqual([
      "Remote, Canada",
      "Remote, Poland",
      "Berlin",
    ]);
    expect(splitLocations("Remote (United States | Canada)")).toEqual(["Remote (United States | Canada)"]);
    expect(["FullTime", "Permanent", "Intern", "Contract", "Part-time", ""].map(employmentType)).toEqual([
      "full_time",
      "full_time",
      "internship",
      "contract",
      "part_time",
      undefined,
    ]);
  });

  it("drops scripts, styles, attributes and unsafe links", () => {
    const html = sanitizeHtml(
      '<div class="x"><p style="color:red" onclick="x()">Hi <a href="javascript:alert(1)">bad</a> <a href="https://ok.example/a">ok</a></p><script>alert(1)</script><img src=x onerror=y></div>',
    );
    expect(html).not.toMatch(/script|style|onclick|javascript|onerror|<img|class=/);
    expect(html).toContain('href="https://ok.example/a"');
    expect(htmlToText("<p>One</p><ul><li>Two</li><li>Three</li></ul>")).toBe("One\n\n- Two\n\n- Three");
  });
});
