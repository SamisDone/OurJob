import { describe, expect, it } from "vitest";
import { penCirclePaths, penUnderlinePath } from "@/components/marks/pen";
import { penTiming } from "@/components/marks/sweep";

describe("penTiming", () => {
  it("uses a 30 ms stagger for a normal job post", () => {
    expect(penTiming(14).staggerMs).toBe(30);
  });

  it("finishes under 1.2 s however many keywords match", () => {
    for (const n of [0, 1, 5, 14, 30, 60, 200]) expect(penTiming(n).totalMs).toBeLessThan(1200);
  });

  it("lands the red underlines after the last circle is drawn", () => {
    const t = penTiming(10);
    expect(t.underlineDelayMs).toBe(9 * 30 + t.circleMs);
  });
});

describe("pen paths", () => {
  it("gives each word its own circle, and the same word the same circle", () => {
    expect(penCirclePaths("React:10")).toEqual(penCirclePaths("React:10"));
    expect(penCirclePaths("React:10").stroke).not.toBe(penCirclePaths("React:52").stroke);
  });

  it("draws an open loop that overshoots its start, and a closed fill", () => {
    const { stroke, fill } = penCirclePaths("TypeScript:3");
    expect(stroke.startsWith("M")).toBe(true);
    expect(stroke.endsWith("Z")).toBe(false);
    expect(fill.endsWith("Z")).toBe(true);
  });

  it("keeps the underline inside its 100 x 6 box", () => {
    const nums = penUnderlinePath("GraphQL").match(/-?\d+(\.\d+)?/g)!.map(Number);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(6);
  });
});
