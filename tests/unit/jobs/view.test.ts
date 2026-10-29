import { describe, expect, it } from "vitest";
import { feedFilters, formatPay, formatPosted, isSearchLate, matchLabel, type FeedJob } from "@/lib/jobs/view";

const now = new Date("2026-10-29T03:10:00Z");

describe("matchLabel", () => {
  it("says the score and what it means", () => {
    expect(matchLabel(88)).toEqual({ text: "88, Strong match", label: "Strong match", tone: "success" });
    expect(matchLabel(80).tone).toBe("success");
    expect(matchLabel(79)).toMatchObject({ text: "79, Partial match", tone: "warning" });
    expect(matchLabel(60).tone).toBe("warning");
    expect(matchLabel(59)).toMatchObject({ text: "59, Weak match", tone: "secondary" });
  });

  it("never guesses a score that does not exist", () => {
    expect(matchLabel(null)).toMatchObject({ text: "Not scored yet", tone: "outline" });
  });
});

describe("formatPay", () => {
  it("shows yearly USD ranges in thousands", () => {
    expect(formatPay({ min: 95_000, max: 130_000, approx: false })).toBe("$95k to $130k");
    expect(formatPay({ min: 64_000, approx: true })).toBe("approx. $64k");
    expect(formatPay({ min: 90_000, max: 90_000, approx: false })).toBe("$90k");
  });

  it("says when pay is not listed", () => {
    expect(formatPay(null)).toBe("Not listed");
  });
});

describe("formatPosted", () => {
  it("counts whole days", () => {
    expect(formatPosted("2026-10-29T01:00:00Z", now)).toBe("Today");
    expect(formatPosted("2026-10-28T23:00:00Z", now)).toBe("Yesterday");
    expect(formatPosted("2026-10-25T10:00:00Z", now)).toBe("4 days ago");
  });

  it("says when the date is unknown", () => {
    expect(formatPosted(null, now)).toBe("Date unknown");
  });
});

describe("isSearchLate", () => {
  it("is late after 30 hours", () => {
    expect(isSearchLate("2026-10-27T21:00:00Z", now)).toBe(true);
    expect(isSearchLate("2026-10-28T00:32:00Z", now)).toBe(false);
  });
});

describe("feed filters", () => {
  const job = (over: Partial<FeedJob>) => ({ fit: 70, pay: null, saved: false, ...over }) as FeedJob;
  const test = (v: string) => feedFilters.find((f) => f.value === v)!.test;

  it("filters strong matches, listed pay and saved jobs", () => {
    expect(test("strong")(job({ fit: 85 }))).toBe(true);
    expect(test("strong")(job({ fit: null }))).toBe(false);
    expect(test("pay")(job({ pay: { min: 1, approx: false } }))).toBe(true);
    expect(test("saved")(job({ saved: true }))).toBe(true);
    expect(test("all")(job({}))).toBe(true);
  });
});
