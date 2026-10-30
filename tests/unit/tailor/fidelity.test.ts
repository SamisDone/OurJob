import { describe, expect, it } from "vitest";
import { addedDetails, droppedDetails } from "@/lib/tailor/fidelity";

// Fictional bullets shaped like the problems seen in a real run (2026-10-30).
const vocab = [
  ["Firebase"],
  ["Firebase Auth"],
  ["PostgreSQL", "Postgres"],
  ["PHP"],
  ["Kafka"],
  ["Gemini API"],
  ["React"],
];
const job = "We need auth and role-based access control, LLM APIs, Kafka and billing experience.";

describe("droppedDetails", () => {
  it("catches a shortened bullet that loses the words the job asks for", () => {
    const missing = droppedDetails(
      "Built three-role access (admin, nurse, visitor) on Firebase Auth",
      "Built three-role access on Firebase",
      job,
      vocab,
    );
    expect(missing).toContain("Firebase Auth");
    expect(missing).toEqual(expect.arrayContaining(["admin", "nurse", "visitor"]));
  });

  it("keeps parentheses, number words and possessives", () => {
    expect(
      droppedDetails("Shipped the app in two languages (EN/FR)", "Shipped the app in two languages", "", vocab),
    ).toEqual(expect.arrayContaining(["EN", "FR"]));
    expect(
      droppedDetails("Supports six input methods for scoring", "Supports input methods for scoring", "", vocab),
    ).toContain("six");
    expect(
      droppedDetails("Reviewed peers’ tasks every sprint", "Reviewed peers tasks every sprint", "", vocab),
    ).toContain("peers'");
  });

  it("allows rewording that keeps every detail", () => {
    expect(
      droppedDetails(
        "Cut failed invoice runs by roughly 60% by moving billing jobs to Kafka",
        "Moved billing jobs to Kafka, cutting failed invoice runs by roughly 60%",
        job,
        vocab,
      ),
    ).toEqual([]);
  });

  it("does not count curly and straight apostrophes as different", () => {
    expect(droppedDetails("Reviewed peers’ tasks", "Reviewed peers' tasks", "", vocab)).toEqual([]);
  });
});

describe("addedDetails", () => {
  it("catches numbers and tools pulled in from outside the bullet", () => {
    const added = addedDetails(
      "Wrote integration tests for the billing module",
      "Wrote 68 integration tests run in CI on PHP 8.1 to 8.4 using PostgreSQL",
      vocab,
    );
    expect(added).toEqual(expect.arrayContaining(["68", "PHP", "PostgreSQL"]));
  });

  it("accepts a synonym of a tool the bullet names", () => {
    expect(addedDetails("Tuned slow PostgreSQL queries", "Tuned slow Postgres queries", vocab)).toEqual([]);
  });
});

describe("placeTerm (check 2g)", () => {
  it("replaces the words that prove the term, joined hyphenated words included", async () => {
    const { placeTerm } = await import("@/lib/tailor/fidelity");
    const { keywordForms } = await import("@/lib/ats/match");
    const k = { term: "role-based access control", canonical: "Role-based access control" };
    const src = "Built three-role access (admin, editor, viewer) on Firebase Auth, with per-role routes and reads.";
    const out = placeTerm(src, k.term, "role access", keywordForms(k));
    expect(out).toBe(
      "Built role-based access control (admin, editor, viewer) on Firebase Auth, with per-role routes and reads.",
    );
    // The count survives as the list it counts, so nothing is lost.
    expect(droppedDetails(src, out!, "role-based access control", vocab)).toEqual([]);
  });

  it("names the term once after a tool, in its shortest form", async () => {
    const { placeTerm } = await import("@/lib/tailor/fidelity");
    const { keywordForms } = await import("@/lib/ats/match");
    const k = { term: "LLM APIs", canonical: "Large language models" };
    const src = "Integrated the Gemini API to summarize meeting notes into action items.";
    expect(placeTerm(src, k.term, "Gemini API", keywordForms(k))).toBe(
      "Integrated the Gemini API (LLM) to summarize meeting notes into action items.",
    );
  });
});
