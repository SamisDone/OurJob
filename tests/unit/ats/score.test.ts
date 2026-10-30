import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scoreCv } from "@/lib/ats/score";
import { profileSections } from "@/lib/ats/sections";
import { p1OutputSchema } from "@/lib/llm/prompts/p1-profile";
import { normalizeProfile } from "@/lib/profile/normalize";
import type { JobSpec } from "@/lib/profile/schema";
import { atsReports, cvChanges, jobMarks, profileAsResume } from "@/lib/tailor/report";

const profile = normalizeProfile(
  p1OutputSchema.parse(JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/nadia-chowdhury.json", "utf8")).output),
);
const kw = (term: string, importance: "must" | "nice", kind: JobSpec["keywords"][number]["kind"] = "hard_skill") => ({
  term,
  canonical: term,
  synonyms: [],
  importance,
  kind,
  evidenceQuote: term,
});
const spec: JobSpec = {
  title: "Senior Backend Engineer",
  company: "Lumen Labs",
  seniority: "senior",
  responsibilities: [],
  keywords: [
    kw("Go", "must"),
    kw("PostgreSQL", "must"),
    kw("Kafka", "must"),
    kw("Rust", "must"),
    kw("GraphQL", "nice"),
  ],
};
const now = new Date("2026-10-30T00:00:00Z");
const sections = profileSections(profile);
const input = { spec, sections, profile, masterSections: sections, pages: 1 };

describe("ATS score", () => {
  it("is deterministic: same inputs, same score, 100 runs", () => {
    const first = scoreCv(input, now);
    for (let i = 0; i < 100; i++) expect(scoreCv(input, now)).toEqual(first);
  }, 30_000);

  it("adds up its components and explains each one", () => {
    const r = scoreCv(input, now);
    expect(r.components.map((c) => c.id)).toEqual(["must", "nice", "placement", "title", "seniority", "parse"]);
    expect(r.components.find((c) => c.id === "must")).toMatchObject({ points: 33.8, max: 45, detail: "3 of 4 found" });
    expect(r.score).toBe(Math.round(r.components.reduce((n, c) => n + c.points, 0)));
    expect(r.missing.map((m) => m.term)).toEqual(["Rust", "GraphQL"]);
  });

  it("moves nice-to-have points to must-haves when the job lists none", () => {
    const r = scoreCv(
      { ...input, spec: { ...spec, keywords: spec.keywords.filter((k) => k.importance === "must") } },
      now,
    );
    expect(r.components.find((c) => c.id === "must")?.max).toBe(60);
    expect(r.components.some((c) => c.id === "nice")).toBe(false);
  });

  it("fails the length check when the CV runs over its page target", () => {
    const r = scoreCv({ ...input, pages: 2 }, now);
    expect(r.checks.find((c) => c.id === "length")?.pass).toBe(false);
  });

  it("scores the master and a tailored CV the same way", () => {
    const { master, tailored } = atsReports(spec, profile, profileAsResume(profile), now);
    expect(tailored.score).toBe(master.score);
  });
});

describe("tailoring report", () => {
  it("lists reworded and left-out bullets", () => {
    const t = profileAsResume(profile);
    t.experience[0].bullets[0] = { ...t.experience[0].bullets[0], text: "Built the rate-quote service in Go." };
    t.experience[1].bullets.pop();
    t.notes = ["Left out b_2_3: row-level security has nothing to do with this frontend job."];
    const changes = cvChanges(profile, t);
    expect(changes.filter((c) => c.kind === "rewritten")).toHaveLength(1);
    expect(changes.find((c) => c.kind === "dropped")).toMatchObject({
      where: "Taka Pay",
      reason: "row-level security has nothing to do with this frontend job.",
    });
  });

  it("marks matched and missing words in the job post, keeping Go's case", () => {
    const text = "We use Go and Kafka; you will go fast. Terraform is a plus.";
    const marks = jobMarks(text, [{ term: "Go" }, { term: "Kafka" }], [{ term: "Terraform" }]);
    expect(marks.map((m) => [text.slice(m.start, m.end), m.kind])).toEqual([
      ["Go", "matched"],
      ["Kafka", "matched"],
      ["Terraform", "missing"],
    ]);
  });
});
