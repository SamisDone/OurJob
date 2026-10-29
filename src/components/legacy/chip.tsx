import { CaretDownIcon, CheckIcon, XIcon } from "@phosphor-icons/react/ssr";
import type { ComponentProps, ReactNode } from "react";
import { PenCircle, PenUnderline } from "@/components/marks/pen";
import { cn } from "@/lib/utils";

const pill = "inline-flex items-center gap-1.5 rounded-pill whitespace-nowrap text-sm";

type FilterChipProps = ComponentProps<"button"> & {
  pressed?: boolean;
  /** Shows a caret: the chip opens a menu instead of toggling. */
  menu?: boolean;
};

/** Toggle chip for feed filters. */
export function FilterChip({ pressed = false, menu = false, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={menu ? undefined : pressed}
      data-pressed={pressed || undefined}
      className={cn(
        pill,
        "h-8 border px-3 transition-colors duration-[120ms] ease-ink max-md:h-11",
        pressed
          ? "border-ink bg-ink text-sheet hover:bg-ink/88"
          : "border-rule bg-sheet text-body hover:border-graphite",
        className,
      )}
      {...props}
    >
      {children}
      {menu && <CaretDownIcon size={14} aria-hidden className={pressed ? "text-sheet" : "text-graphite"} />}
    </button>
  );
}

type KeywordChipProps = {
  kind: "matched" | "missing";
  importance?: "must" | "nice";
  children: string;
  className?: string;
};

/**
 * A job keyword. Matched: circled in blue pen. Missing: underlined in red pen.
 * The word stays in --body; the accessible name says which it is.
 */
export function KeywordChip({ kind, importance, className, children }: KeywordChipProps) {
  return (
    <span
      data-kind={kind}
      className={cn("inline-flex h-8 items-center gap-1.5 px-1 text-sm whitespace-nowrap text-body", className)}
    >
      <span className="sr-only">{kind === "matched" ? "Matched keyword: " : "Missing keyword: "}</span>
      {kind === "matched" ? (
        <PenCircle seed={children}>{children}</PenCircle>
      ) : (
        <PenUnderline seed={children}>{children}</PenUnderline>
      )}
      {importance === "must" && <span className="text-xs text-graphite">required</span>}
    </span>
  );
}

/** The tracker's Applied mark: a slightly rotated red rubber stamp. */
export function Stamp({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 -rotate-[4deg] items-center rounded-[3px] border-2 border-redpen px-1.5 text-xs font-semibold text-redpen",
        "shadow-[inset_0_0_0_1px_var(--redpen-wash)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

type TagProps = ComponentProps<"span"> & {
  tone?: "neutral" | "ok" | "caution" | "redpen" | "new";
  icon?: ReactNode;
};

/** Small static label: "New company", "Direct", "Paused", "Staffing agency". */
export function Tag({ tone = "neutral", icon, className, children, ...props }: TagProps) {
  return (
    <span
      className={cn(
        pill,
        "h-6 px-2 text-xs font-medium",
        tone === "neutral" && "border border-rule text-body",
        tone === "ok" && "border border-ok/40 text-ok",
        tone === "caution" && "border border-caution/45 text-caution",
        tone === "redpen" && "border border-redpen/45 text-redpen",
        tone === "new" && "bg-ink text-sheet",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

/** Removable chip used in editable lists (target titles, excluded keywords). */
export function TokenChip({
  children,
  onRemove,
  className,
}: {
  children: ReactNode;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span className={cn(pill, "h-8 border border-rule bg-sheet pr-1 pl-3 text-body max-md:h-11", className)}>
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${typeof children === "string" ? children : "item"}`}
          className="inline-flex size-6 items-center justify-center rounded-pill text-graphite hover:bg-ink-wash hover:text-ink max-md:-my-1 max-md:size-11 max-md:-mr-1"
        >
          <XIcon size={14} aria-hidden />
        </button>
      )}
    </span>
  );
}

export function CheckMark({ className }: { className?: string }) {
  return <CheckIcon size={16} aria-hidden className={cn("text-ok", className)} />;
}
