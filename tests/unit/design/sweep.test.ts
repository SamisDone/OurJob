import { describe, expect, it } from "vitest";
import { sweepTiming } from "@/components/marks/sweep";

describe("sweepTiming", () => {
  it("uses a 30 ms stagger for a normal job post", () => {
    expect(sweepTiming(14).staggerMs).toBe(30);
  });

  it("finishes under 1.2 s however many keywords match", () => {
    for (const n of [0, 1, 5, 14, 30, 60, 200]) expect(sweepTiming(n).totalMs).toBeLessThan(1200);
  });

  it("lands the missing-keyword underlines after the last fill", () => {
    const t = sweepTiming(10);
    expect(t.underlineDelayMs).toBe(9 * 30 + t.fillMs);
  });
});
