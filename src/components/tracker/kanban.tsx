"use client";

import { DotsSixVerticalIcon, FileTextIcon } from "@phosphor-icons/react/ssr";
import { DropdownMenu } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Stamp } from "@/components/legacy/chip";
import { cn } from "@/lib/utils";

export const trackerColumns = ["Saved", "Applied", "Interviewing", "Offer", "Closed"] as const;
export type TrackerColumnName = (typeof trackerColumns)[number];

export function KanbanColumn({
  name,
  count,
  children,
  dropping = false,
}: {
  name: string;
  count: number;
  children: ReactNode;
  dropping?: boolean;
}) {
  return (
    <section
      aria-label={`${name}, ${count} jobs`}
      className={cn(
        "flex w-full flex-col rounded-panel border border-transparent p-2 transition-colors duration-200 ease-ink md:w-[272px] md:shrink-0 md:snap-start",
        dropping && "border-dashed border-graphite bg-ink-wash",
      )}
    >
      <h3 className="flex items-baseline gap-2 px-1 pb-2 text-sm font-medium text-ink">
        {name}
        <span className="text-graphite tabular">{count}</span>
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function KanbanCard({
  title,
  company,
  moved,
  tailoredHref,
  column,
  dragging = false,
  onMove,
}: {
  title: string;
  company: string;
  moved: string;
  tailoredHref?: string;
  column: TrackerColumnName;
  dragging?: boolean;
  onMove?: (to: TrackerColumnName) => void;
}) {
  return (
    <article
      className={cn(
        "group red-rule-top relative rounded-control border border-rule bg-sheet px-3 pt-3.5 pb-3 transition-shadow duration-200 ease-ink",
        dragging && "shadow-pop",
      )}
    >
      {column === "Applied" && <Stamp className="absolute top-2.5 right-2.5">Applied</Stamp>}
      <div className={cn("flex items-start gap-1", column === "Applied" && "pr-16")}>
        <span className="mt-0.5 -ml-1 cursor-grab text-graphite" aria-hidden>
          <DotsSixVerticalIcon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="leading-5 font-medium text-ink">{title}</p>
          <p className="mt-0.5 text-sm text-graphite">{company}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-graphite">{moved}</p>
      {/* Actions on their own row so labels never wrap. */}
      <div className="mt-2 flex items-center gap-1 border-t border-rule pt-2">
        {tailoredHref && (
          <a
            href={tailoredHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-sm whitespace-nowrap text-ink hover:bg-ink-wash max-md:h-11"
          >
            <FileTextIcon size={16} aria-hidden />
            Tailored CV
          </a>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            className="ml-auto inline-flex h-8 items-center rounded-control px-2 text-sm whitespace-nowrap text-body hover:bg-ink-wash max-md:h-11"
            aria-label={`Move ${title}`}
          >
            Move to
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={4}
              align="end"
              className="relative red-rule-top z-50 min-w-40 rounded-panel border border-rule bg-sheet p-1 text-sm text-body shadow-pop"
            >
              {trackerColumns
                .filter((c) => c !== column)
                .map((c) => (
                  <DropdownMenu.Item
                    key={c}
                    onSelect={() => onMove?.(c)}
                    className="flex h-9 cursor-default items-center rounded-[6px] px-3 outline-none data-[highlighted]:bg-ink-wash max-md:h-11"
                  >
                    {c}
                  </DropdownMenu.Item>
                ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </article>
  );
}

/**
 * The board: five columns side by side at a usable fixed width. Where they do
 * not fit, it scrolls sideways (visible scrollbar, snap to columns) and says
 * so; on phones the columns stack.
 */
export function KanbanBoard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div>
      {overflows && <p className="mb-2 hidden text-sm text-graphite md:block">Scroll sideways to see all five columns.</p>}
      <div
        ref={ref}
        tabIndex={overflows ? 0 : undefined}
        role="region"
        aria-label="Tracker columns"
        className="flex flex-col gap-3 pb-3 md:snap-x md:flex-row md:overflow-x-auto [scrollbar-color:var(--control-edge)_transparent]"
      >
        {children}
      </div>
    </div>
  );
}
