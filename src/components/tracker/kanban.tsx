"use client";

import { DotsSixVerticalIcon, FileTextIcon } from "@phosphor-icons/react/ssr";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { Stamp } from "@/components/ui/chip";
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
        "flex min-w-64 flex-1 flex-col rounded-panel border border-transparent p-2 transition-colors duration-200 ease-ink",
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
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-graphite">
        <span>{moved}</span>
        <div className="flex items-center gap-1">
          {tailoredHref && (
            <a
              href={tailoredHref}
              className="inline-flex items-center gap-1 rounded-[4px] px-1 text-ink hover:underline"
            >
              <FileTextIcon size={14} aria-hidden />
              Tailored CV
            </a>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              className="rounded-[4px] px-1.5 py-0.5 text-body hover:bg-ink-wash"
              aria-label={`Move ${title}`}
            >
              Move to
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={4}
                align="end"
                className="z-50 min-w-40 rounded-panel border border-rule bg-sheet p-1 text-sm text-body shadow-pop"
              >
                {trackerColumns
                  .filter((c) => c !== column)
                  .map((c) => (
                    <DropdownMenu.Item
                      key={c}
                      onSelect={() => onMove?.(c)}
                      className="flex h-9 cursor-default items-center rounded-[6px] px-3 outline-none data-[highlighted]:bg-ink-wash"
                    >
                      {c}
                    </DropdownMenu.Item>
                  ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </article>
  );
}
