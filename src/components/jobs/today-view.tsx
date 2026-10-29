"use client";

import { CircleAlert, Inbox, Play, RotateCw, Search, TriangleAlert } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/shell/page-states";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { feedFilters, formatClock, isSearchLate, type FeedFilter, type FeedJob } from "@/lib/jobs/view";
import { JobSheet } from "./job-sheet";
import { JobsTable } from "./jobs-table";

export type TodayRun = { finishedAt: string; companies: number };

const DESCRIPTION = "Fresh remote jobs from the last 7 days, ranked by how well they fit you.";

function lastChecked(run: TodayRun, timeZone: string) {
  return `Last search at ${formatClock(run.finishedAt, timeZone)}, ${run.companies} companies checked`;
}

/** The Today screen: filters with counts, the jobs table, and the job sheet. */
export function TodayView({
  jobs: initialJobs,
  run,
  now,
  timeZone,
  tailorHref = (j) => `/tailor?job=${encodeURIComponent(j.id)}`,
}: {
  jobs: FeedJob[];
  run: TodayRun;
  now: Date;
  timeZone: string;
  tailorHref?: (job: FeedJob) => string;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(
    () =>
      Object.fromEntries(feedFilters.map((f) => [f.value, jobs.filter(f.test).length])) as Record<FeedFilter, number>,
    [jobs],
  );
  const visible = useMemo(() => {
    const test = feedFilters.find((f) => f.value === filter)!.test;
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => test(j) && (!q || `${j.title} ${j.company}`.toLowerCase().includes(q)));
  }, [jobs, filter, query]);

  const open = jobs.find((j) => j.id === openId) ?? null;
  const onOpen = useCallback((j: FeedJob) => setOpenId(j.id), []);
  const toggleSave = (job: FeedJob) => {
    const saved = !job.saved;
    const set = (value: boolean) => setJobs((all) => all.map((j) => (j.id === job.id ? { ...j, saved: value } : j)));
    set(saved);
    toast(saved ? "Saved." : "Removed from saved.", { action: { label: "Undo", onClick: () => set(!saved) } });
  };

  const late = isSearchLate(run.finishedAt, now);

  return (
    <Page wide>
      <PageHeader
        title="Today"
        description={DESCRIPTION}
        actions={
          <>
            <span className="text-sm text-muted-foreground">{lastChecked(run, timeZone)}</span>
            <Button variant="outline" onClick={() => toast("Search started. New jobs appear here as they are scored.")}>
              <Play data-icon="inline-start" />
              Run search now
            </Button>
          </>
        }
      />

      {late && (
        <Alert variant="warning" className="mb-6">
          <TriangleAlert />
          <AlertTitle>The daily search is late.</AlertTitle>
          <AlertDescription>
            The last search finished more than 30 hours ago, so newer jobs may be missing. Run it now or check the
            GitHub Actions schedule.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label="Show"
          value={filter}
          onValueChange={(v) => v && setFilter(v as FeedFilter)}
          className="flex-wrap"
        >
          {feedFilters.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="gap-2 px-3">
              {f.label}
              <span className="num text-xs text-muted-foreground">{counts[f.value]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <InputGroup className="lg:w-72">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Filter by role or company"
            placeholder="Filter by role or company"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
      </div>

      {visible.length > 0 ? (
        <JobsTable jobs={visible} now={now} selectedId={openId} onOpen={onOpen} />
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>
              {filter === "saved" && !query ? "No saved jobs yet." : "No jobs match this filter."}
            </EmptyTitle>
            <EmptyDescription>
              {filter === "saved" && !query
                ? "Open a job and press Save to keep it here."
                : "Try All, or clear the search box."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <JobSheet
        job={open}
        now={now}
        onOpenChange={(o) => !o && setOpenId(null)}
        onToggleSave={toggleSave}
        tailorHref={tailorHref}
      />
    </Page>
  );
}

/** Today when the last search found nothing new. */
export function TodayEmpty({ run, timeZone }: { run: TodayRun; timeZone: string }) {
  return (
    <Page wide>
      <PageHeader title="Today" description={DESCRIPTION} />
      <Empty className="border border-dashed py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>No new matches today.</EmptyTitle>
          <EmptyDescription>
            {run.companies} companies checked at {formatClock(run.finishedAt, timeZone)}. Add a company you like on the
            Companies page to watch it too.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline">Add a company</Button>
        </EmptyContent>
      </Empty>
    </Page>
  );
}

/** Today while the feed loads: the same layout, in skeletons. */
export function TodaySkeleton() {
  return (
    <Page wide>
      <div aria-busy aria-label="Loading jobs">
        <div className="mb-8 space-y-2.5">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="mb-4 flex gap-2">
          {[64, 120, 100, 72].map((w) => (
            <Skeleton key={w} className="h-8" style={{ width: w }} />
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border">
          <div className="h-11 border-b bg-muted/50" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex h-16 items-center gap-6 border-b px-4 last:border-0">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-64 max-w-full" />
                <Skeleton className="h-3.5 w-32" />
              </div>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="hidden h-4 w-24 md:block" />
              <Skeleton className="hidden h-4 w-20 md:block" />
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}

/** Today when the feed could not load. */
export function TodayError({ onRetry }: { onRetry?: () => void }) {
  return (
    <Page wide>
      <PageHeader title="Today" description={DESCRIPTION} />
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>The job feed did not load.</AlertTitle>
        <AlertDescription>
          The database did not answer in time. Your jobs are safe; try again in a moment.
        </AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCw data-icon="inline-start" />
            Try again
          </Button>
        </AlertAction>
      </Alert>
    </Page>
  );
}
