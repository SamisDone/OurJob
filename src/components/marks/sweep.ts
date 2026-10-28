/**
 * Timing for the highlighter sweep (DESIGN.md 3, Motion): marks fill in
 * reading order with a 30 ms stagger, the whole sweep finishes under 1.2 s,
 * and missing-keyword underlines land at the end.
 */
export const SWEEP_FILL_MS = 180;
export const SWEEP_UNDERLINE_MS = 200;
export const SWEEP_MAX_TOTAL_MS = 1150;
const PREFERRED_STAGGER_MS = 30;

export function sweepTiming(matchedCount: number) {
  const budget = SWEEP_MAX_TOTAL_MS - SWEEP_FILL_MS - SWEEP_UNDERLINE_MS;
  const stagger = matchedCount > 1 ? Math.min(PREFERRED_STAGGER_MS, budget / (matchedCount - 1)) : 0;
  const fillsEnd = Math.max(0, matchedCount - 1) * stagger + SWEEP_FILL_MS;
  return {
    staggerMs: stagger,
    fillMs: SWEEP_FILL_MS,
    underlineDelayMs: fillsEnd,
    totalMs: fillsEnd + SWEEP_UNDERLINE_MS,
  };
}
