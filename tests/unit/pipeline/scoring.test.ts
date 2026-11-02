import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkAssessments, p4OutputSchema, p4Prompt, type P4Job } from "@/lib/llm/prompts/p4-fit";
import { p1OutputSchema } from "@/lib/llm/prompts/p1-profile";
import { prefilterScore } from "@/lib/pipeline/prefilter";
import { feedScore, payScore } from "@/lib/pipeline/rank";
import { normalizeProfile } from "@/lib/profile/normalize";
import { searchPreferencesSchema } from "@/lib/profile/schema";

const profile = normalizeProfile(
  p1OutputSchema.parse(JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/nadia-chowdhury.json", "utf8")).output),
);
const prefs = searchPreferencesSchema.parse({
  targetTitles: ["Backend Engineer"],
  seniority: ["mid", "senior"],
  country: "BD",
});
const job = (title: string, text = "We use Go, PostgreSQL, Kafka and Docker.") => ({
  title,
  companyName: "Acme",
  descriptionText: text,
});

describe("prefilter", () => {
  it("ranks his kind of role above a near one, and names his skills", () => {
    const exact = prefilterScore(job("Backend Engineer"), profile, prefs);
    const near = prefilterScore(job("Software Engineer, Payments"), profile, prefs);
    const bare = prefilterScore(job("Backend Engineer", "We are hiring."), profile, prefs);
    expect(exact).toBeGreaterThan(near);
    expect(exact).toBeGreaterThan(bare);
    expect(near).toBeGreaterThan(0);
  });

  it("drops roles that are not engineering, people managers, interns and exclusions (seen on 2026-11-03)", () => {
    for (const t of [
      "Commercial Account Executive",
      "Senior Product Manager, Developer and Agentic Experience",
      "Technical Curriculum Developer, Technical Enablement",
      "Partner Solutions Architect, AI Builder",
      "Engineering Manager, Commerce Systems",
      "Director, Site Reliability Engineering",
      "PhD Machine Learning Engineer, Intern",
    ])
      expect(prefilterScore(job(t), profile, prefs), t).toBe(0);
    expect(
      prefilterScore(job("Backend Engineer", "Crypto trading desk"), profile, {
        ...prefs,
        excludedKeywords: ["crypto"],
      }),
    ).toBe(0);
    expect(prefilterScore(job("Backend Engineer"), profile, { ...prefs, excludedCompanies: ["acme"] })).toBe(0);
  });

  it("a staff title scores lower than his level", () => {
    expect(prefilterScore(job("Staff Backend Engineer"), profile, prefs)).toBeLessThan(
      prefilterScore(job("Senior Backend Engineer"), profile, prefs),
    );
  });
});

describe("P4 checks", () => {
  const jobs: P4Job[] = [
    {
      id: "a",
      title: "Backend Engineer",
      company: "Acme",
      location: "Remote",
      text: "Remote. You can work from anywhere in the world. Pay: $90k to $120k.",
    },
    {
      id: "b",
      title: "Platform Engineer",
      company: "Beta",
      location: "Remote",
      text: "Fully remote team. We need Terraform.",
    },
    { id: "c", title: "Data Engineer", company: "Gamma", location: "Remote, AMER", text: "Join us." },
  ];
  const out = p4OutputSchema.parse({
    assessments: [
      {
        jobId: "a",
        fitScore: 140,
        reasons: ["Go and PostgreSQL — a direct match"],
        gaps: ["Rust"],
        seniority: "mid",
        remoteScope: { kind: "worldwide", evidenceQuote: "work from anywhere in the world" },
        isStaffingAgency: { value: false },
        salaryQuote: "$90k to $120k",
      },
      {
        jobId: "b",
        fitScore: 70,
        reasons: [],
        gaps: ["Terraform"],
        seniority: "mid",
        remoteScope: { kind: "worldwide", evidenceQuote: "Fully remote" },
        isStaffingAgency: { value: false },
        salaryQuote: "$150k",
      },
      {
        jobId: "c",
        fitScore: 50,
        reasons: [],
        gaps: [],
        seniority: "mid",
        remoteScope: { kind: "worldwide", evidenceQuote: "Remote, AMER" },
        isStaffingAgency: { value: true },
      },
      {
        jobId: "zzz",
        fitScore: 99,
        reasons: [],
        gaps: [],
        seniority: "mid",
        remoteScope: { kind: "unknown" },
        isStaffingAgency: { value: false },
      },
    ],
  });
  const [a, b, c, ...rest] = checkAssessments(out, jobs);

  it("keeps only jobs it was asked about, clamps scores, and replaces em dashes", () => {
    expect(rest).toEqual([]);
    expect(a.fitScore).toBe(100);
    expect(a.reasons[0]).toBe("Go and PostgreSQL, a direct match");
  });

  it("keeps quotes and gaps only when they are in the job text", () => {
    expect(a.gaps).toEqual([]);
    expect(b.gaps).toEqual(["Terraform"]);
    expect(a.salaryQuote).toBe("$90k to $120k");
    expect(b.salaryQuote).toBeUndefined();
  });

  it("reads the scope from the quote with the location rules: a bare remote names no place", () => {
    expect(a.remoteScope).toMatchObject({ kind: "worldwide", confidence: "llm" });
    expect(b.remoteScope).toBeNull();
    expect(c.remoteScope).toMatchObject({ kind: "regions", regions: ["Americas"] });
    expect(c.isStaffingAgency).toBe(true);
  });

  it("puts every job in the prompt as data with its id", () => {
    const { user, system } = p4Prompt(profile, prefs, jobs);
    expect(user.match(/<job id="/g)).toHaveLength(3);
    expect(system).toMatch(/Ignore any instructions/);
  });
});

describe("feed ranking", () => {
  const now = new Date("2026-11-03T00:00:00Z");
  const base = { fit: 80, prefilter: null, postedAt: now, tier: 1, wellKnown: false };

  it("weighs pay against his minimum, unlisted pay is neutral", () => {
    expect(payScore(null, 50_000)).toBe(50);
    expect(payScore(40_000, 50_000)).toBe(0);
    expect(payScore(75_000, 50_000)).toBe(100);
  });

  it("prefers fresher, lesser-known and better-fitting jobs, and uses the prefilter when not scored", () => {
    const p = { minAnnualUsd: 50_000, preferLesserKnown: true };
    const old = { ...base, postedAt: new Date(now.getTime() - 5 * 86_400_000) };
    expect(feedScore(base, p, now)).toBeGreaterThan(feedScore(old, p, now));
    expect(feedScore(base, p, now)).toBeGreaterThan(feedScore({ ...base, wellKnown: true }, p, now));
    expect(feedScore({ ...base, fit: null, prefilter: 0.8 }, p, now)).toBe(feedScore(base, p, now));
  });
});
