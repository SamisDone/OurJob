import { describe, expect, it } from "vitest";
import { canonicalUrl, dedupeJobs, normalizeCompanyName, normalizeTitle } from "@/lib/pipeline/dedupe";
import { eligibilityOf } from "@/lib/pipeline/eligibility";
import { countriesIn, locate } from "@/lib/pipeline/location";
import { parseSalaryText } from "@/lib/pipeline/salary";
import type { NormalizedJob } from "@/lib/sources/types";

describe("location rules", () => {
  const scopeOf = (...locs: string[]) => locate(locs).remoteScope;

  it("reads worldwide, countries and regions from location strings", () => {
    expect(scopeOf("Remote (Worldwide)").kind).toBe("worldwide");
    expect(scopeOf("Anywhere").kind).toBe("worldwide");
    expect(scopeOf("Remote - US")).toMatchObject({ kind: "countries", countries: ["US"] });
    expect(scopeOf("Remote, Bangladesh")).toMatchObject({ countries: ["BD"] });
    expect(scopeOf("Remote - APAC")).toMatchObject({ kind: "regions", regions: ["APAC"] });
    expect(scopeOf("Remote, South Asia")).toMatchObject({ kind: "regions", regions: ["Asia"] });
    expect(scopeOf("Remote (EMEA)").regions).toEqual(["EMEA"]);
  });

  it("keeps plain Remote unknown: it does not say where", () => {
    expect(scopeOf("Remote")).toEqual({ kind: "unknown", confidence: "parsed" });
    expect(locate(["Remote"]).workplace).toBe("remote");
  });

  it("only remote segments count for a remote job, and offices are onsite", () => {
    expect(scopeOf("Remote, Canada", "Toronto, ON")).toMatchObject({ countries: ["CA"] });
    expect(locate(["New York, NY"]).workplace).toBe("onsite");
    expect(locate(["Hybrid - Berlin, Germany"]).workplace).toBe("hybrid");
    // A bare city is an office (seen on 2026-11-03: "Gurugram", "Toronto", "Hong Kong, Hong Kong SAR").
    expect(locate(["Gurugram"]).workplace).toBe("onsite");
    expect(locate(["San Francisco; Seattle"]).workplace).toBe("onsite");
    expect(locate(["TBD"]).workplace).toBe("unknown");
    expect(locate(["N/A"]).workplace).toBe("unknown");
    expect(scopeOf("Remote, AMER").regions).toEqual(["Americas"]);
    // "Global" with named places is those places (Aptos Labs, 2026-11-03).
    expect(scopeOf("Remote Global (US, EU)")).toMatchObject({
      kind: "regions",
      regions: ["Europe"],
      countries: ["US"],
    });
    expect(scopeOf("Global Remote").kind).toBe("worldwide");
  });

  it("does not read states or words as countries", () => {
    expect(countriesIn("Indianapolis, Indiana")).toEqual([]);
    expect(countriesIn("Newark, New Jersey")).toEqual(["US"]);
    expect(countriesIn("Albuquerque, New Mexico")).toEqual(["US"]);
    expect(countriesIn("Remote, United Kingdom")).toEqual(["GB"]);
    expect(countriesIn("Remote - UK")).toEqual(["GB"]);
  });

  it("uses the source's structured workplace and country when the strings name no place", () => {
    expect(locate(["Remote"], { workplace: "remote", countries: ["US"] }).remoteScope).toMatchObject({
      kind: "countries",
      countries: ["US"],
      confidence: "structured",
    });
    expect(locate(["Europe"], { workplace: "remote" }).remoteScope).toMatchObject({ regions: ["Europe"] });
  });
});

describe("eligibility from Bangladesh", () => {
  const prefs = { country: "BD", remoteScopes: { worldwide: true, regions: [], countries: [], onsiteCities: [] } };
  const job = (locs: string[]) => {
    const { workplace, remoteScope } = locate(locs);
    return eligibilityOf({ workplace, remoteScope, locationRaw: locs.join("; ") }, prefs);
  };

  it("worldwide, his country and his regions are eligible", () => {
    expect(job(["Remote (Worldwide)"])).toBe("eligible");
    expect(job(["Remote, Bangladesh"])).toBe("eligible");
    expect(job(["Remote - APAC"])).toBe("eligible");
    expect(job(["Remote, Asia"])).toBe("eligible");
  });

  it("other countries and regions are not; plain Remote is unclear", () => {
    expect(job(["Remote - US"])).toBe("ineligible");
    expect(job(["Remote (EMEA)"])).toBe("ineligible");
    expect(job(["Remote"])).toBe("unclear");
    expect(job(["London, United Kingdom"])).toBe("ineligible");
  });

  it("a country he says he can work in, and his office cities, count", () => {
    const wider = {
      country: "BD",
      remoteScopes: { worldwide: true, regions: [], countries: ["US"], onsiteCities: ["Dhaka"] },
    };
    const { workplace, remoteScope } = locate(["Remote - US"]);
    expect(eligibilityOf({ workplace, remoteScope, locationRaw: "Remote - US" }, wider)).toBe("eligible");
    const office = locate(["Dhaka, Bangladesh"]);
    expect(eligibilityOf({ ...office, locationRaw: "Dhaka, Bangladesh" }, wider)).toBe("eligible");
  });
});

describe("salary text", () => {
  it("reads dollar ranges with k, commas, words and periods", () => {
    expect(parseSalaryText("The base range is $87,069-$130,000 per year.")).toMatchObject({
      min: 87069,
      max: 130000,
      period: "year",
      annualUsdMax: 130000,
    });
    expect(parseSalaryText("Pay: $120k to $150k")).toMatchObject({ min: 120000, max: 150000 });
    expect(parseSalaryText("USD 6,000 - 8,000 per month")).toMatchObject({ period: "month", annualUsdMin: 72000 });
    expect(parseSalaryText("$45 - $60 an hour")).toMatchObject({ period: "hour", annualUsdMin: 93600 });
  });

  it("leaves other dollars, single numbers and nonsense unknown", () => {
    expect(parseSalaryText("CA$120,000 - CA$150,000")).toBeUndefined();
    expect(parseSalaryText("We raised $20 million")).toBeUndefined();
    expect(parseSalaryText("Up to $150,000")).toBeUndefined();
    expect(parseSalaryText("between $5 and $10 billion")).toBeUndefined();
  });
});

describe("dedupe", () => {
  const base: NormalizedJob = {
    source: "greenhouse",
    tier: 1,
    sourceJobId: "1",
    companyName: "Acme, Inc.",
    title: "Backend Engineer (Remote)",
    descriptionHtml: "",
    descriptionText: "",
    applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
    canonicalUrl: "https://boards.greenhouse.io/acme/jobs/1",
    locationRaw: "Remote",
    workplace: "remote",
    remoteScope: { kind: "unknown", confidence: "parsed" },
    postedAt: new Date("2026-11-01"),
    postedAtSource: "source_field",
  };

  it("strips tracking parameters and normalizes names", () => {
    expect(canonicalUrl("https://Jobs.Lever.co/acme/1?lever-source=x&utm_source=y#apply")).toBe(
      "https://jobs.lever.co/acme/1",
    );
    expect(canonicalUrl("https://acme.com/careers?gh_jid=42&utm_medium=z")).toBe("https://acme.com/careers?gh_jid=42");
    expect(normalizeCompanyName("Acme, Inc.")).toBe("acme");
    expect(normalizeTitle("Backend Engineer (Remote)")).toBe("backend engineer");
    expect(normalizeTitle("Senior Engineer - Remote, Worldwide")).toBe("senior engineer");
  });

  it("keeps one record per job, the higher tier first, and fills a missing salary", () => {
    const board: NormalizedJob = {
      ...base,
      source: "remotive",
      tier: 2,
      sourceJobId: "r9",
      companyName: "Acme",
      title: "Backend Engineer",
      applyUrl: "https://remotive.com/x",
      canonicalUrl: "https://remotive.com/x",
      salary: { min: 1, max: 2, currency: "USD", period: "year", source: "parsed_text" },
    };
    const out = dedupeJobs([board, base, { ...base, sourceJobId: "1" }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: "greenhouse", salary: { source: "board" } });
    expect(out[0].alsoSeenIn).toEqual([{ source: "remotive", url: "https://remotive.com/x" }]);
  });

  it("keeps the same title in another location or posted weeks apart", () => {
    const other = { ...base, sourceJobId: "2", canonicalUrl: "u2", locationRaw: "Remote, Europe" };
    const later = { ...base, sourceJobId: "3", canonicalUrl: "u3", postedAt: new Date("2026-12-01") };
    expect(dedupeJobs([base, other, later])).toHaveLength(3);
  });
});
