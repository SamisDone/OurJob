import { describe, expect, it } from "vitest";
import { findKeyword, keywordForms, matchKeyword } from "@/lib/ats/match";

const k = (term: string, synonyms: string[] = []) => ({ term, canonical: term, synonyms });
const has = (term: string, text: string, inSkills = false) => findKeyword(k(term), text, inSkills) !== null;

describe("keyword matcher (ATS_SCORING section 2 and 6)", () => {
  it("keeps Java and JavaScript apart", () => {
    expect(has("Java", "Built services in JavaScript")).toBe(false);
    expect(has("Java", "Java and Kotlin services")).toBe(true);
    expect(has("JavaScript", "Java services")).toBe(false);
  });

  it("keeps React, React Native and Reactive apart", () => {
    expect(has("React", "Reactive streams in Kotlin")).toBe(false);
    expect(has("React", "Shipped the app in React Native")).toBe(false);
    expect(has("React Native", "Shipped the app in React Native")).toBe(true);
    expect(has("React", "Dashboards in React and TypeScript")).toBe(true);
    expect(has("React", "Built with ReactJS")).toBe(true);
  });

  it("matches Go only as the language", () => {
    expect(has("Go", "Owned the go to market plan")).toBe(false);
    expect(has("Go", "Go to market plan for the launch")).toBe(false);
    expect(has("Go", "Go, Python", true)).toBe(true);
    expect(has("Go", "Wrote Go microservices behind gRPC")).toBe(true);
    expect(has("Go", "Designed the rate-quote service in Go that answers 1,200 requests per second")).toBe(false);
    expect(has("Go", "Built it in Golang")).toBe(true);
    expect(has("Go", "Services in Go (Golang)")).toBe(true);
  });

  it("uses the profile's own skills as tech nearby", () => {
    const text = "Designed the rate-quote service in Go that answers 1,200 requests per second";
    expect(findKeyword(k("Go"), text, false, { techTerms: ["rate-quote service"] })).toBe("Go");
  });

  it("tokenizes C++ and C#", () => {
    expect(has("C++", "Game engine work in C++ and Lua")).toBe(true);
    expect(has("C", "Game engine work in C++ and Lua")).toBe(false);
    expect(has("C#", "Unity tools in C# with .NET")).toBe(true);
    expect(has("C", "Unity tools in C# with .NET")).toBe(false);
    expect(has("C++", "Unity tools in C# with .NET")).toBe(false);
  });

  it("matches Node.js variants", () => {
    for (const text of ["APIs in Node.js", "APIs in NodeJS", "APIs in node js", "APIs in Node.JS"]) {
      expect(has("Node.js", text), text).toBe(true);
    }
  });

  it("matches CI/CD and CI and CD", () => {
    expect(has("CI/CD", "Set up CI/CD with GitHub Actions")).toBe(true);
    expect(has("CI/CD", "Set up CI and CD with GitHub Actions")).toBe(true);
    expect(has("CI/CD", "Set up CI / CD")).toBe(true);
  });

  it("finds Postgres for PostgreSQL through the synonym map", () => {
    expect(has("PostgreSQL", "Tuned Postgres queries")).toBe(true);
    expect(keywordForms(k("Postgres"))).toContain("PostgreSQL");
  });

  it("matches simple plurals but not other word forms", () => {
    expect(has("API", "Public APIs for merchants")).toBe(true);
    expect(has("test", "Wrote unit testing guides")).toBe(false);
    expect(has("webhook", "Signed webhooks")).toBe(true);
  });

  it("matches multi-word terms with spaces or hyphens between the words, in order", () => {
    expect(has("continuous integration", "Moved builds to continuous-integration")).toBe(true);
    expect(has("event-driven", "An event driven pipeline")).toBe(true);
    expect(has("load testing", "testing under load")).toBe(false);
  });

  it("does not take the word next or rest as a skill", () => {
    expect(has("Next.js", "Planned the next release")).toBe(false);
    expect(has("REST APIs", "the rest of the team")).toBe(false);
    expect(has("Next.js", "Moved the site to Next.js")).toBe(true);
  });

  it("reports every section a keyword is found in", () => {
    const r = matchKeyword(k("Kafka"), {
      skills: ["Backend: gRPC, Kafka"],
      experience: ["Moved billing to a Kafka-based event pipeline"],
      summary: ["Backend engineer"],
    });
    expect(r).toEqual({ found: true, locations: ["skills", "experience"], matchedForm: "Kafka" });
    expect(matchKeyword(k("Terraform"), { skills: ["Docker"] }).found).toBe(false);
  });
});
