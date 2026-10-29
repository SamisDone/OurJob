"use client";

import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Segmented } from "@/components/legacy/tabs";
import { cn } from "@/lib/utils";

type Pane = "job" | "cv" | "score";

/**
 * The tailoring desk layout (DESIGN.md 5.4), driven by its own width, not the
 * window's, because the rail takes space:
 * - 1,180 px and wider: three columns, job | CV (widest) | score. The score
 *   column is sticky.
 * - 916 px and wider: two columns, job | CV, with the score as a sticky panel
 *   above them that opens to the full breakdown.
 * - narrower, on tablets: job above CV, same sticky score panel.
 * - phones (under 768 px window): Job / CV / Score segmented control, one pane
 *   at a time, and the actions pinned to the bottom above the tab bar.
 * The CV column is never narrower than 612 px (see CvPreview), which is why
 * three columns need 1,180 px: 260 + 612 + 260 + two 24 px gaps.
 */
export function TailorDesk({
  job,
  cv,
  score,
  scoreSummary,
  actions,
  mobileActions,
}: {
  job: ReactNode;
  cv: ReactNode;
  /** The full score panel: number, breakdown, matched and missing. */
  score: ReactNode;
  /** One line for the collapsed panel: "Estimated ATS match 74, master CV 54". */
  scoreSummary: ReactNode;
  /** Open in Overleaf, Copy LaTeX, Download. Laid out by the desk; give them no widths. */
  actions: ReactNode;
  /** The same actions, compact enough for the pinned bar on phones. Defaults to `actions`. */
  mobileActions?: ReactNode;
}) {
  const [pane, setPane] = useState<Pane>("job");
  const [open, setOpen] = useState(false);
  // The pinned bar shows only while the desk is on screen.
  const root = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root} className="@container">
      <div className="mb-4 md:hidden">
        <Segmented
          aria-label="Show"
          value={pane}
          onValueChange={(v) => setPane(v as Pane)}
          options={[
            { value: "job", label: "Job" },
            { value: "cv", label: "CV" },
            { value: "score", label: "Score" },
          ]}
          className="w-full [&>button]:flex-1"
        />
      </div>

      <div
        className={cn(
          // minmax(0, 1fr): the 612 px CV page must scroll inside its pane, never widen the page.
          "grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-6",
          "@min-[916px]:grid-cols-[minmax(280px,0.75fr)_minmax(612px,1.25fr)]",
          // 260 + 612 + 260 + two 24 px gaps = 1,180 px, the three-column threshold.
          "@min-[1180px]:grid-cols-[minmax(260px,0.8fr)_minmax(612px,1.6fr)_minmax(260px,280px)] @min-[1180px]:gap-x-6",
        )}
      >
        {/* Score: third column when there is room, else a sticky panel above both columns. */}
        <aside
          aria-label="Estimated ATS match"
          className={cn(
            "order-first col-span-full self-start md:sticky md:top-0 md:z-20",
            "@min-[1180px]:order-last @min-[1180px]:col-span-1 @min-[1180px]:top-4",
            pane !== "score" && "max-md:hidden",
          )}
        >
          <div
            className={cn(
              // A card only in the two-column layout; plain column in three columns and on phones.
              "md:@max-[1179px]:relative md:@max-[1179px]:red-rule-top md:@max-[1179px]:rounded-panel",
              "md:@max-[1179px]:border md:@max-[1179px]:border-rule md:@max-[1179px]:bg-sheet md:@max-[1179px]:px-4 md:@max-[1179px]:py-3",
            )}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="hidden min-h-11 w-full items-center justify-between gap-4 text-left md:flex @min-[1180px]:hidden"
            >
              <span className="min-w-0 text-sm">{scoreSummary}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-sm text-ink">
                {open ? "Hide details" : "Show details"}
                <CaretDownIcon
                  size={14}
                  aria-hidden
                  className={cn("transition-transform duration-200 ease-ink", open && "rotate-180")}
                />
              </span>
            </button>
            <div
              className={cn(
                "max-md:block",
                open ? "md:mt-4 md:block md:max-h-[60vh] md:overflow-y-auto" : "md:hidden",
                "@min-[1180px]:mt-0 @min-[1180px]:block @min-[1180px]:max-h-none @min-[1180px]:overflow-visible",
              )}
            >
              {score}
              <div className="mt-8 hidden flex-col gap-2 @min-[1180px]:flex [&>*]:w-full">{actions}</div>
            </div>
            <div className="mt-3 hidden flex-wrap gap-2 md:flex @min-[1180px]:hidden">{actions}</div>
          </div>
        </aside>

        <section aria-label="Job description" className={cn("min-w-0", pane !== "job" && "max-md:hidden")}>
          {job}
        </section>

        <section aria-label="Your tailored CV" className={cn("min-w-0", pane !== "cv" && "max-md:hidden")}>
          {cv}
        </section>
      </div>

      {/* Phones: the main action is always one tap away, above the tab bar. */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-rule bg-sheet px-4 py-3 md:hidden",
          !onScreen && "hidden",
        )}
      >
        <div className="flex gap-2 [&>*:first-child]:flex-1">{mobileActions ?? actions}</div>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </div>
  );
}
