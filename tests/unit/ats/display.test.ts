import { describe, expect, it } from "vitest";
import { wholePoints } from "@/lib/ats/display";

describe("wholePoints", () => {
  it("shows whole numbers that add up to the shown total", () => {
    const { parts, total } = wholePoints([31.5, 7.5, 8.8, 6, 5, 15]);
    expect(total).toBe(74);
    expect(parts.every(Number.isInteger)).toBe(true);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(74);
    expect(parts).toEqual([32, 7, 9, 6, 5, 15]);
  });

  it("leaves whole inputs alone", () => {
    expect(wholePoints([45, 15, 10, 10, 5, 15])).toEqual({ parts: [45, 15, 10, 10, 5, 15], total: 100 });
  });

  it("is deterministic and never goes below the floor", () => {
    for (let n = 0; n < 200; n++) {
      const pts = Array.from({ length: 6 }, (_, i) => ((n * 7 + i * 13) % 100) / 7);
      const a = wholePoints(pts);
      expect(wholePoints(pts)).toEqual(a);
      expect(a.parts.reduce((x, y) => x + y, 0)).toBe(a.total);
      a.parts.forEach((p, i) => expect(p).toBeGreaterThanOrEqual(Math.floor(pts[i])));
    }
  });
});
