import { describe, expect, it } from "vitest";
import { boldSegments, segmentsText } from "@/lib/cv/document";

describe("boldSegments", () => {
  const text = "Built the real-time shipment dashboard used by 40 client teams; cut bundle size by 35%.";

  it("bolds exact substrings in order", () => {
    const segs = boldSegments(text, ["40 client teams", "real-time shipment dashboard"]);
    expect(segs.filter((s) => s.bold).map((s) => s.text)).toEqual(["real-time shipment dashboard", "40 client teams"]);
    expect(segmentsText(segs)).toBe(text);
  });

  it("ignores phrases that are not in the text", () => {
    expect(boldSegments(text, ["GraphQL"])).toEqual([{ text }]);
  });

  it("prefers the longer phrase when two overlap", () => {
    const segs = boldSegments(text, ["shipment", "real-time shipment dashboard"]);
    expect(segs.filter((s) => s.bold).map((s) => s.text)).toEqual(["real-time shipment dashboard"]);
  });

  it("bolds a phrase at the very start and end", () => {
    const segs = boldSegments("React and TypeScript", ["React", "TypeScript"]);
    expect(segs).toEqual([{ text: "React", bold: true }, { text: " and " }, { text: "TypeScript", bold: true }]);
  });

  it("handles special characters without regex surprises", () => {
    const segs = boldSegments("Cut costs by 35% (approx.) with C++", ["35% (approx.)", "C++"]);
    expect(segs.filter((s) => s.bold).map((s) => s.text)).toEqual(["35% (approx.)", "C++"]);
  });

  it("skips empty phrases", () => {
    expect(boldSegments("abc", ["", "  "])).toEqual([{ text: "abc" }]);
  });
});
