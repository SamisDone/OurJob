import { CheckIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

/**
 * Onboarding progress: step names, current one in ink, done ones with a check.
 * Done steps are buttons that go back to that step; future steps are plain
 * text and do not look clickable. One line on phones and small tablets.
 */
export function ProgressSteps({
  steps,
  current,
  onSelect,
}: {
  steps: string[];
  current: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <>
      <p className="text-sm text-graphite md:hidden">
        Step {current + 1} of {steps.length}: <span className="font-medium text-ink">{steps[current]}</span>
      </p>
      <ol className="hidden w-full items-center text-sm md:flex" aria-label="Onboarding progress">
        {steps.map((label, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          const marker = (
            <span
              className={cn(
                "inline-flex size-6 shrink-0 items-center justify-center rounded-pill text-xs tabular",
                state === "done" && "bg-ink text-sheet",
                state === "current" && "border-2 border-ink font-semibold text-ink",
                state === "todo" && "border border-rule text-graphite",
              )}
              aria-hidden
            >
              {state === "done" ? <CheckIcon size={12} weight="bold" /> : i + 1}
            </span>
          );
          return (
            <li key={label} className="flex min-w-0 items-center" aria-current={state === "current" ? "step" : undefined}>
              {i > 0 && <span className="mx-2 h-px w-4 shrink-0 bg-rule" aria-hidden />}
              {state === "done" && onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className="group inline-flex items-center gap-2 rounded-control py-1 whitespace-nowrap text-body"
                >
                  {marker}
                  <span className="underline decoration-rule underline-offset-4 group-hover:decoration-ink">{label}</span>
                  <span className="sr-only"> (done, go back to this step)</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 py-1 whitespace-nowrap">
                  {marker}
                  <span className={cn(state === "current" ? "font-medium text-ink" : state === "done" ? "text-body" : "text-graphite")}>
                    {label}
                  </span>
                  {state === "done" && <span className="sr-only"> (done)</span>}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * Named work steps shown inline while something runs ("Reading the job",
 * then "Tailoring your CV"). Never a spinner on its own.
 */
export function TaskSteps({
  steps,
}: {
  steps: { label: string; state: "done" | "running" | "todo" | "failed"; detail?: string }[];
}) {
  return (
    <ol className="space-y-2.5 text-sm" aria-live="polite">
      {steps.map((s) => (
        <li key={s.label} className="flex items-start gap-3">
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" aria-hidden>
            {s.state === "done" && <CheckIcon size={16} className="text-ok" />}
            {s.state === "running" && (
              <span className="size-2 animate-[skeleton-breathe_1.2s_ease-in-out_infinite] rounded-pill bg-ink" />
            )}
            {s.state === "todo" && <span className="size-2 rounded-pill border border-graphite" />}
            {s.state === "failed" && <span className="size-2 rounded-pill bg-redpen" />}
          </span>
          <span className="min-w-0">
            <span
              className={cn(s.state === "todo" ? "text-graphite" : "text-body", s.state === "running" && "font-medium")}
            >
              {s.label}
              <span className="sr-only">
                {s.state === "done"
                  ? ", done"
                  : s.state === "running"
                    ? ", in progress"
                    : s.state === "failed"
                      ? ", failed"
                      : ""}
              </span>
            </span>
            {s.detail && <span className="block text-xs text-graphite">{s.detail}</span>}
            {s.state === "running" && (
              <span className="mt-1.5 block h-0.5 w-40 overflow-hidden rounded-pill bg-rule" aria-hidden>
                <span className="block h-full w-1/3 animate-[task-progress_1.6s_var(--ease-ink)_infinite] rounded-pill bg-ink" />
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
