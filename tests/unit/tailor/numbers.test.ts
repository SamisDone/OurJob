import { describe, expect, it } from "vitest";
import { extractNumbers, unsupportedReason } from "@/lib/tailor/numbers";

const one = (text: string) => {
  const found = extractNumbers(text);
  expect(found, text).toHaveLength(1);
  return found[0];
};
const check = (claim: string, source: string) => {
  const reasons = extractNumbers(claim).map((n) => unsupportedReason(n, extractNumbers(source)));
  return reasons.find((r) => r !== null) ?? null;
};

describe("extractNumbers: every form in AI_PROMPTS.md check 3", () => {
  it("reads plain digits and thousands separators", () => {
    expect(one("used by 40 teams")).toMatchObject({ value: 40, unit: "", atLeast: false });
    expect(one("about 1,200 requests")).toMatchObject({ value: 1200, hedged: true });
    expect(one("1,000,000 rows")).toMatchObject({ value: 1_000_000 });
  });

  it("reads percentages, k, M and multipliers", () => {
    expect(one("cut costs by 35%")).toMatchObject({ value: 35, unit: "%" });
    expect(one("cut costs by 35 %")).toMatchObject({ value: 35, unit: "%" });
    expect(one("10k users")).toMatchObject({ value: 10_000 });
    expect(one("2M events a day")).toMatchObject({ value: 2_000_000 });
    expect(one("3x faster")).toMatchObject({ value: 3, unit: "x" });
    expect(one("an estimated ~10x speedup")).toMatchObject({ value: 10, unit: "x", hedged: true });
  });

  it("reads lower bounds", () => {
    expect(one("20+ merchants")).toMatchObject({ value: 20, atLeast: true });
    expect(one("5+ years of experience")).toMatchObject({ value: 5, atLeast: true });
    expect(one("over 300 clinics")).toMatchObject({ value: 300, atLeast: true });
  });

  it("reads percentile latency as two numbers", () => {
    expect(extractNumbers("p99 under 105 ms").map((n) => [n.value, n.unit])).toEqual([
      [99, "p"],
      [105, ""],
    ]);
  });

  it("reads spelled numbers one to twenty, as whole words", () => {
    expect(one("Mentor three junior engineers")).toMatchObject({ value: 3 });
    expect(one("a team of twenty")).toMatchObject({ value: 20 });
    expect(extractNumbers("someone often attends")).toHaveLength(0);
    expect(extractNumbers("Went on to build")).toHaveLength(0);
  });

  it("ignores digits inside names like Python3 or S3 and words like Web3", () => {
    expect(extractNumbers("Stored files in S3 with Python3 for Web3")).toHaveLength(0);
  });
});

describe("unsupportedReason", () => {
  it("accepts a number its source has", () => {
    expect(check("answers 1,200 requests per second", "answers about 1,200 requests per second")).toMatch(/hedge/);
    expect(check("answers about 1,200 requests per second", "answers about 1,200 requests per second")).toBeNull();
    expect(check("Mentor 3 engineers", "Mentor three engineers")).toBeNull();
  });

  it("refuses a number that is not in the source, or a stronger claim", () => {
    expect(check("used by 3,000 merchants", "used by 2,000+ merchants")).toMatch(/not in its source/);
    expect(check("used by 30+ teams", "used by 20+ teams")).toMatch(/not in its source/);
    expect(check("used by 2,000 merchants", "used by 2,000+ merchants")).toMatch(/drops the "\+"/);
    expect(check("cut failed runs by 60%", "cut failed runs by roughly 60%")).toMatch(/hedge/);
    expect(check("3x faster", "3% faster")).toMatch(/not in its source/);
  });

  it("allows a weaker lower bound", () => {
    expect(check("used by 1,000+ merchants", "used by 2,000+ merchants")).toBeNull();
    expect(check("5+ years", "5+ years")).toBeNull();
  });
});
