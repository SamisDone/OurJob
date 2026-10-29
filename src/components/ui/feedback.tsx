import { ArrowClockwiseIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Placeholder block. Skeletons mirror the final layout so nothing shifts. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-[skeleton-breathe_1.8s_ease-in-out_infinite] rounded-[4px] bg-rule/70", className)}
      {...props}
    />
  );
}

/**
 * Text on ruled index-card lines. Every line of text is 32 px tall and the
 * blue rule is drawn 5 px under the baseline of each row (background shifted
 * 4 px up from the bottom of the band), so text sits on the lines and
 * descenders (g, p, brackets) clear them.
 */
export function RuledText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("ruled px-6 pt-8 pb-8 leading-8 [background-position:0_-4px] md:px-8", className)}>{children}</div>
  );
}

/**
 * One sentence on what is happening, plus the next action. A small index
 * card: the text sits on ruled lines, the action sits below them, so no line
 * ever crosses a button. No illustrations.
 */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative red-rule-top overflow-hidden rounded-panel border border-rule bg-sheet", className)}>
      <RuledText>
        <p className="text-lg leading-8 font-semibold text-ink">{title}</p>
        {children && <p className="measure text-base leading-8 text-body">{children}</p>}
      </RuledText>
      {action && <div className="px-6 pb-6 md:px-8">{action}</div>}
    </div>
  );
}

/** A white sheet with the index card's red rule across the top. Borders, not shadows. */
export function Panel({ children, className, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("red-rule-top relative rounded-panel border border-rule bg-sheet", className)} {...props}>
      {children}
    </section>
  );
}

/** What happened and what to do, with a retry. Errors do not apologize. */
export function ErrorState({
  title,
  children,
  onRetry,
  retryLabel = "Try again",
  className,
}: {
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "red-rule-top relative rounded-panel border border-redpen/35 bg-redpen-wash px-5 pt-5 pb-4",
        className,
      )}
    >
      <div className="flex gap-3">
        <WarningIcon size={20} aria-hidden className="mt-0.5 shrink-0 text-redpen" />
        <div className="min-w-0">
          <p className="font-semibold text-ink">{title}</p>
          {children && <p className="mt-1 measure text-sm text-body">{children}</p>}
          {onRetry && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
              <ArrowClockwiseIcon aria-hidden />
              {retryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Full-width caution bar, for pipeline warnings. */
export function CautionBar({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-panel border border-caution/40 bg-caution-wash px-4 py-3 text-sm text-body"
    >
      <WarningIcon size={16} aria-hidden className="shrink-0 text-caution" />
      <p className="min-w-0 flex-1">{children}</p>
      {action}
    </div>
  );
}

/** A calm note, for things like the Gemini free tier privacy note. */
export function Callout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("measure border-l-2 border-ink/40 py-1 pl-4 text-sm text-body", className)}>{children}</div>
  );
}
