/**
 * Timing for the pen moment (DESIGN.md 3, Motion): the pen circles matched
 * words in reading order with a 30 ms stagger, red underlines land after the
 * last circle, and the whole thing finishes under 1.2 s.
 */
export const PEN_CIRCLE_MS = 240;
export const PEN_UNDERLINE_MS = 200;
export const PEN_MAX_TOTAL_MS = 1150;
const PREFERRED_STAGGER_MS = 30;

export function penTiming(matchedCount: number) {
  const budget = PEN_MAX_TOTAL_MS - PEN_CIRCLE_MS - PEN_UNDERLINE_MS;
  const stagger = matchedCount > 1 ? Math.min(PREFERRED_STAGGER_MS, budget / (matchedCount - 1)) : 0;
  const circlesEnd = Math.max(0, matchedCount - 1) * stagger + PEN_CIRCLE_MS;
  return {
    staggerMs: stagger,
    circleMs: PEN_CIRCLE_MS,
    underlineDelayMs: circlesEnd,
    totalMs: circlesEnd + PEN_UNDERLINE_MS,
  };
}
