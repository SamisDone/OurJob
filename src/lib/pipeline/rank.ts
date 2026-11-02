/**
 * Feed ranking (docs/ATS_SCORING.md section 5). Weights live here so Sam can tune them.
 * feedScore = 0.6 fit + 0.15 pay + 0.1 freshness + 0.1 lesser-known + 0.05 source tier.
 */
export const FEED_WEIGHTS = { fit: 0.6, pay: 0.15, freshness: 0.1, lesserKnown: 0.1, tier: 0.05 };

const DAY = 86_400_000;

export type RankInput = {
  /** P4 fit, or null when not scored yet. */
  fit: number | null;
  /** 0 to 1, used when fit is null. */
  prefilter: number | null;
  annualUsdMax?: number | null;
  postedAt: Date | null;
  tier: number;
  wellKnown: boolean;
};

export function payScore(annualUsdMax: number | null | undefined, minAnnualUsd: number | undefined): number {
  if (!annualUsdMax) return 50; // not listed: neutral
  if (!minAnnualUsd) return 50;
  if (annualUsdMax < minAnnualUsd) return 0;
  return Math.min(100, ((annualUsdMax - minAnnualUsd) / (0.5 * minAnnualUsd)) * 100);
}

export function feedScore(
  job: RankInput,
  prefs: { minAnnualUsd?: number; preferLesserKnown: boolean },
  now: Date,
): number {
  const fit = job.fit ?? (job.prefilter ?? 0) * 100;
  const days = job.postedAt ? Math.max(0, Math.floor((now.getTime() - job.postedAt.getTime()) / DAY)) : 7;
  const freshness = Math.max(0, 100 - 14 * days);
  const lesserKnown = prefs.preferLesserKnown && !job.wellKnown ? 100 : 0;
  const tier = job.tier === 1 ? 100 : job.tier === 2 ? 60 : 40;
  const w = FEED_WEIGHTS;
  return (
    w.fit * fit +
    w.pay * payScore(job.annualUsdMax, prefs.minAnnualUsd) +
    w.freshness * freshness +
    w.lesserKnown * lesserKnown +
    w.tier * tier
  );
}
