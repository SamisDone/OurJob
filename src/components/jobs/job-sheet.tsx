"use client";

import { Bookmark, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { Nums } from "@/components/nums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { eligibilityLabel, formatPay, formatPosted, type FeedJob } from "@/lib/jobs/view";
import { MatchBadge } from "./match-badge";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** One job in a sheet on the right: labeled facts, then "Tailor my CV" and "Open posting". */
export function JobSheet({
  job,
  now,
  onOpenChange,
  onToggleSave,
  tailorHref,
}: {
  job: FeedJob | null;
  now: Date;
  onOpenChange: (open: boolean) => void;
  onToggleSave: (job: FeedJob) => void;
  tailorHref: (job: FeedJob) => string;
}) {
  const e = job ? eligibilityLabel[job.eligibility] : null;
  const primary = useRef<HTMLAnchorElement>(null);
  return (
    <Sheet open={job !== null} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full gap-0 data-[side=right]:sm:max-w-xl"
        // Focus the primary action, not the first icon button.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          primary.current?.focus();
        }}
      >
        {job && e && (
          <>
            <SheetHeader className="gap-1.5 border-b p-6 pr-12">
              <SheetTitle className="text-xl leading-snug">{job.title}</SheetTitle>
              <SheetDescription className="text-base">
                {job.company}
                {job.newCompany && (
                  <Badge variant="outline" className="ml-2 align-middle">
                    New company
                  </Badge>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6">
              <dl className="grid gap-5 text-base">
                <Fact label="Match">
                  <MatchBadge fit={job.fit} />
                </Fact>
                <Fact label="Where">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{job.where}</span>
                    <Badge variant={e.tone}>{e.text}</Badge>
                  </div>
                  {job.eligibilityNote && <p className="mt-1.5 text-sm text-muted-foreground">{job.eligibilityNote}</p>}
                </Fact>
                <Fact label="Pay">
                  {job.pay ? (
                    <Nums>{`${formatPay(job.pay)} a year`}</Nums>
                  ) : (
                    <span className="text-muted-foreground">Not listed</span>
                  )}
                </Fact>
                <Fact label="Posted">
                  <Nums>{formatPosted(job.postedAt, now)}</Nums>
                </Fact>
                <Fact label="Source">
                  {job.source}
                  {job.direct && <span className="text-muted-foreground">, direct from the company</span>}
                </Fact>
              </dl>

              <Separator className="my-6" />

              <section aria-labelledby="why-fits" className="space-y-3">
                <h3 id="why-fits" className="font-medium">
                  Why it fits
                </h3>
                {job.reasons.length > 0 ? (
                  <ul className="list-disc space-y-2 pl-5 marker:text-muted-foreground">
                    {job.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Not scored yet. It is scored in the next daily search.</p>
                )}
              </section>

              <section aria-labelledby="missing" className="mt-6 space-y-3">
                <h3 id="missing" className="font-medium">
                  You&apos;re missing
                </h3>
                {job.missing.length > 0 ? (
                  <ul className="flex flex-wrap gap-2" aria-label="Skills you are missing">
                    {job.missing.map((m) => (
                      <li key={m}>
                        <Badge variant="destructive">{m}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">
                    {job.fit === null ? "Not scored yet." : "Nothing the post asks for is missing from your profile."}
                  </p>
                )}
              </section>
            </div>

            <SheetFooter className="flex-row flex-wrap gap-2 border-t p-6">
              <Button asChild size="lg">
                <Link href={tailorHref(job)} ref={primary}>
                  <FileText data-icon="inline-start" />
                  Tailor my CV
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={job.url} target="_blank" rel="noreferrer">
                  <ExternalLink data-icon="inline-start" />
                  Open posting
                </a>
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-lg"
                    variant="ghost"
                    className="ml-auto"
                    aria-pressed={job.saved}
                    aria-label={job.saved ? "Saved. Remove from saved" : "Save job"}
                    onClick={() => onToggleSave(job)}
                  >
                    <Bookmark className={job.saved ? "fill-current" : undefined} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{job.saved ? "Remove from saved" : "Save job"}</TooltipContent>
              </Tooltip>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
