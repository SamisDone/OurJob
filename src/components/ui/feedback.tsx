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

/** One sentence on what is happening, plus the next action. No illustrations. */
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
    <div className={cn("border-y border-rule py-10", className)}>
      <p className="text-lg font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 measure text-base text-graphite">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
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
    <div role="alert" className={cn("rounded-panel border border-proofmark/35 bg-proofmark-wash px-5 py-4", className)}>
      <div className="flex gap-3">
        <WarningIcon size={20} aria-hidden className="mt-0.5 shrink-0 text-proofmark" />
        <div className="min-w-0">
          <p className="font-semibold text-ink">{title}</p>
          {children && <p className="mt-1 measure text-sm text-ink/80">{children}</p>}
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
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-panel border border-caution/40 bg-caution-wash px-4 py-3 text-sm text-ink"
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
    <div className={cn("measure border-l-2 border-ink/40 py-1 pl-4 text-sm text-ink/85", className)}>{children}</div>
  );
}
