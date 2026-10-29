/**
 * Whole-number points for the score breakdown that still add up to the shown
 * total. Plain rounding can disagree (31.5 + 7.5 + 8.8 + 6 + 5 + 15 = 73.8,
 * shown as 74, but the rounded parts sum to 75), so the remainder method
 * hands out the leftover points to the parts with the largest fractions.
 */
export function wholePoints(points: number[]): { parts: number[]; total: number } {
  const total = Math.round(points.reduce((a, b) => a + b, 0));
  const floors = points.map((p) => Math.floor(p));
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = points
    .map((p, i) => ({ i, frac: p - Math.floor(p) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const parts = [...floors];
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return { parts, total };
}
