"use client";

import { InfoIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useRef, useState } from "react";
import { Tooltip } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-stored";

/**
 * Counts from `from` to `to` over `durationMs` while `run` is true. With
 * reduced motion, or when not running, it shows the final value.
 */
function useCountUp(from: number, to: number, run: boolean, durationMs: number) {
  const reduced = usePrefersReducedMotion();
  const animate = run && !reduced;
  const [frame, setFrame] = useState<number | null>(null);
  const raf = useRef(0);
  useEffect(() => {
    if (!animate) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setFrame(Math.round(from + (to - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [animate, from, to, durationMs]);
  return animate ? (frame ?? from) : to;
}

type Component = { id: string; label: string; points: number; max: number; detail: string };

/**
 * Estimated ATS match: the tailored score next to the master CV score, with
 * the breakdown that produced it. Always labeled as an estimate.
 */
export function ScoreDisplay({
  score,
  masterScore,
  components,
  animate = false,
  durationMs = 1100,
  className,
}: {
  score: number;
  masterScore?: number;
  components: Component[];
  animate?: boolean;
  durationMs?: number;
  className?: string;
}) {
  const shown = useCountUp(masterScore ?? score, score, animate, durationMs);
  const delta = masterScore === undefined ? null : score - masterScore;

  return (
    <section aria-label="Estimated ATS match" className={className}>
      <div className="flex items-center gap-1.5 text-sm text-graphite">
        <h2 className="font-medium text-ink">Estimated ATS match</h2>
        <Tooltip content="Real applicant tracking systems each rank differently. This is an estimate from keyword coverage, placement, title fit and how cleanly the CV parses.">
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-pill hover:text-ink"
            aria-label="How this estimate works"
          >
            <InfoIcon size={16} aria-hidden />
          </button>
        </Tooltip>
      </div>
      <div className="mt-2 flex items-end gap-4">
        <span className="text-score text-ink tabular" aria-live="polite" aria-atomic>
          <span aria-hidden>{shown}</span>
          <span className="sr-only">{score} out of 100</span>
        </span>
        {masterScore !== undefined && (
          <div className="pb-1 text-sm leading-5">
            <div className="text-graphite">
              Master CV <span className="tabular">{masterScore}</span>
            </div>
            {delta !== null && delta !== 0 && (
              <div className={cn("font-medium tabular", delta > 0 ? "text-ok" : "text-redpen")}>
                {delta > 0 ? `+${delta}` : delta} from tailoring
              </div>
            )}
          </div>
        )}
      </div>
      <dl className="mt-5 space-y-3">
        {components.map((c) => (
          <div key={c.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="text-body">{c.label}</dt>
              <dd className="text-graphite tabular">
                <span className="text-body">{Number.isInteger(c.points) ? c.points : c.points.toFixed(1)}</span> of{" "}
                {c.max}
              </dd>
            </div>
            <div className="mt-1.5 h-1 rounded-pill bg-rule" aria-hidden>
              <div className="h-full rounded-pill bg-ink" style={{ width: `${(c.points / c.max) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-graphite">{c.detail}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Fit score in a job row: tabular number plus a thin 48 px bar. */
export function FitScore({ value, className }: { value: number | null; className?: string }) {
  if (value === null) {
    return <span className={cn("text-sm text-graphite", className)}>Not scored yet</span>;
  }
  return (
    <span className={cn("inline-flex flex-col items-end gap-1", className)}>
      <span className="text-sm text-graphite">
        Fit <span className="text-lg font-semibold text-ink tabular">{value}</span>
      </span>
      <span className="block h-[3px] w-12 rounded-pill bg-rule" aria-hidden>
        <span className="block h-full rounded-pill bg-ink" style={{ width: `${value}%` }} />
      </span>
    </span>
  );
}
