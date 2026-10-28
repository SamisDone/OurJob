"use client";

import { ArrowSquareOutIcon, BookmarkSimpleIcon, CheckIcon, XIcon } from "@phosphor-icons/react/ssr";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/chip";
import { PenUnderline } from "@/components/marks/pen";
import { FitScore } from "@/components/score/score";
import { cn } from "@/lib/utils";

export type JobRowData = {
  id: string;
  title: string;
  company: string;
  source: string;
  newCompany?: boolean;
  isNew?: boolean;
  remote: string;
  pay: string;
  posted: string;
  fit: number | null;
  reasons: string[];
  gaps: string[];
  preview: string;
};

/**
 * One job in the feed. A row, not a card: separated by rules, expands in
 * place with reasons, gaps and actions.
 */
export function JobRow({
  job,
  defaultOpen = false,
  onTailor,
  onDismiss,
  onSave,
  onApplied,
}: {
  job: JobRowData;
  defaultOpen?: boolean;
  onTailor?: () => void;
  onDismiss?: () => void;
  onSave?: () => void;
  onApplied?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <article
      className={cn("relative border-b border-rule px-4 last:border-b-0 md:px-6", open && "bg-ink-wash")}
      aria-label={`${job.title} at ${job.company}`}
    >
      {/* New since the last visit: a small ink dot in the margin, like a pen tick. */}
      {job.isNew && (
        <span className="absolute top-[27px] left-1.5 size-1.5 rounded-pill bg-ink md:left-2.5" aria-hidden />
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-[1fr_auto] gap-x-6 py-4 text-left focus-visible:rounded-control"
      >
        <span className="min-w-0">
          <span className="block text-lg font-semibold text-ink">
            {job.isNew && <span className="sr-only">New. </span>}
            {job.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-graphite">
            <span className="font-medium text-graphite">{job.company}</span>
            <span>{job.source}</span>
            {job.newCompany && <Tag>New company</Tag>}
          </span>
          <span className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-body">
            <span>{job.remote}</span>
            <span className={cn(job.pay === "Pay not listed" && "text-graphite")}>{job.pay}</span>
            <span className="text-graphite">{job.posted}</span>
          </span>
        </span>
        <FitScore value={job.fit} className="pt-1" />
      </button>

      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-ink",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="grid gap-5 pb-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              {job.reasons.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-ink">Why it fits</h4>
                  <ul className="mt-1.5 space-y-1 text-sm text-body">
                    {job.reasons.map((r) => (
                      <li key={r} className="flex gap-2">
                        <CheckIcon size={16} aria-hidden className="mt-0.5 shrink-0 text-ok" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-graphite">Not scored yet. It will be scored in the next run.</p>
              )}
              {job.gaps.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-ink">Main gaps</h4>
                  <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-body">
                    {job.gaps.map((g) => (
                      <span key={g}>
                        <span className="sr-only">Missing: </span>
                        <PenUnderline seed={g}>{g}</PenUnderline>
                      </span>
                    ))}
                  </p>
                </div>
              )}
            </div>
            <p className="line-clamp-4 measure text-sm text-body">{job.preview}</p>
          </div>
          <div className="flex flex-wrap gap-2 pb-5">
            <Button onClick={onTailor}>Tailor CV</Button>
            <Button variant="secondary">
              <ArrowSquareOutIcon aria-hidden />
              Open job
            </Button>
            <Button variant="ghost" onClick={onSave}>
              <BookmarkSimpleIcon aria-hidden />
              Save
            </Button>
            <Button variant="ghost" onClick={onDismiss}>
              <XIcon aria-hidden />
              Dismiss
            </Button>
            <Button variant="ghost" onClick={onApplied}>
              Mark applied
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function JobRowSkeleton() {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-6 border-b border-rule px-4 py-4 last:border-b-0 md:px-6">
      <div>
        <div className="flex h-7 items-center">
          <div className="h-4 w-3/5 animate-[skeleton-breathe_1.8s_ease-in-out_infinite] rounded-[4px] bg-rule/70" />
        </div>
        <div className="mt-0.5 flex h-5 items-center">
          <div className="h-3 w-2/5 animate-[skeleton-breathe_1.8s_ease-in-out_infinite] rounded-[4px] bg-rule/70" />
        </div>
        <div className="mt-1 flex h-5 items-center">
          <div className="h-3 w-1/2 animate-[skeleton-breathe_1.8s_ease-in-out_infinite] rounded-[4px] bg-rule/70" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 pt-2">
        <div className="h-4 w-12 animate-[skeleton-breathe_1.8s_ease-in-out_infinite] rounded-[4px] bg-rule/70" />
        <div className="h-[3px] w-12 rounded-pill bg-rule/70" />
      </div>
    </div>
  );
}
