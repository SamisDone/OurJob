import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./marks.css";

/**
 * Ballpoint marks: a blue pen circle around matched keywords and a red pen
 * underline under missing ones. Paths are seeded so each word gets its own
 * slightly irregular stroke, and the same word always gets the same one.
 * Both use pathLength=1, so a stroke-dashoffset transition draws them.
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seeded(seed: string) {
  let a = hash(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(2);

/** Catmull-Rom points to a smooth cubic path. */
function smoothPath(points: [number, number][], closed: boolean): string {
  const p = closed ? [points[points.length - 1], ...points, points[0], points[1]] : [points[0], ...points, points[points.length - 1]];
  let d = `M${f(p[1][0])} ${f(p[1][1])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

/**
 * The circle, in a 100 x 40 box. The stroke starts upper left, goes round
 * a little more than once and ends past its start, like a quick pen loop.
 * The fill is a calmer closed shape just inside it.
 */
export function penCirclePaths(seed: string): { stroke: string; fill: string } {
  const rnd = seeded(seed);
  const cx = 50 + (rnd() - 0.5) * 2;
  const cy = 20 + (rnd() - 0.5) * 1.5;
  const tilt = (rnd() - 0.5) * 0.08;
  const start = Math.PI * (1.12 + rnd() * 0.12);
  const turns = 1.1 + rnd() * 0.06;
  const steps = 14;
  const stroke: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = start + (i / steps) * turns * Math.PI * 2;
    // Radius drifts a little round the loop, and the end sits slightly outside the start.
    const drift = 1 + (rnd() - 0.5) * 0.07 + (i / steps) * 0.05;
    const rx = 47 * drift;
    const ry = 17.5 * drift;
    const x = cx + rx * Math.cos(t);
    const y = cy + ry * Math.sin(t) + x * tilt - 50 * tilt;
    stroke.push([x, y]);
  }
  const fill: [number, number][] = [];
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    fill.push([cx + 45 * Math.cos(t), cy + 16 * Math.sin(t) + (cx + 45 * Math.cos(t)) * tilt - 50 * tilt]);
  }
  return { stroke: smoothPath(stroke, false), fill: smoothPath(fill, true) };
}

/** The underline, in a 100 x 6 box: one slightly uneven stroke. */
export function penUnderlinePath(seed: string): string {
  const rnd = seeded(`u:${seed}`);
  const pts: [number, number][] = [];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const x = 1 + (i / n) * 98;
    pts.push([x, 3.2 + (rnd() - 0.5) * 1.8 + (i / n) * (rnd() - 0.6) * 0.8]);
  }
  return smoothPath(pts, false);
}

type MarkProps = {
  children: ReactNode;
  seed: string;
  className?: string;
  /** Order in the reading sequence, for the draw stagger. */
  index?: number;
};

/** A word circled in blue pen. Text stays --ink; the circle sits behind it. */
export function PenCircle({ children, seed, className, index = 0 }: MarkProps) {
  const { stroke, fill } = penCirclePaths(seed);
  return (
    <span className={cn("pen-circle", className)} style={{ "--i": index } as CSSProperties}>
      <svg className="pen-circle-svg" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden focusable="false">
        <path className="pen-circle-fill" d={fill} />
        <path className="pen-circle-stroke" d={stroke} pathLength={1} />
      </svg>
      <span className="pen-circle-text">{children}</span>
    </span>
  );
}

/** A word underlined in red pen. */
export function PenUnderline({ children, seed, className }: MarkProps) {
  return (
    <span className={cn("pen-underline", className)}>
      {children}
      <svg className="pen-underline-svg" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden focusable="false">
        <path d={penUnderlinePath(seed)} pathLength={1} />
      </svg>
    </span>
  );
}
