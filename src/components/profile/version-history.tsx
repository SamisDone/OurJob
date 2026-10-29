"use client";

import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/legacy/button";
import { ErrorState, Skeleton } from "@/components/legacy/feedback";
import { Sheet, SheetContent, SheetTrigger } from "@/components/legacy/overlay";
import { toast } from "sonner";
import { useProfileVersions, useRestoreVersion } from "@/lib/query/profile";

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today at ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
}

/** Every save is kept. Restoring copies an old version forward; nothing is deleted. */
export function VersionHistory() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm">
          <ClockCounterClockwiseIcon aria-hidden />
          Version history
        </Button>
      </SheetTrigger>
      <SheetContent
        title="Version history"
        description="Every save is kept. Restoring makes a copy of that version the newest one."
      >
        <Versions />
      </SheetContent>
    </Sheet>
  );
}

function Versions() {
  const q = useProfileVersions();
  const restore = useRestoreVersion();
  if (q.isPending) {
    return (
      <div aria-busy className="space-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-56" />
          </div>
        ))}
      </div>
    );
  }
  if (q.isError)
    return (
      <ErrorState title="Versions did not load." onRetry={() => void q.refetch()}>
        {q.error.message}
      </ErrorState>
    );
  return (
    <ol className="divide-y divide-rule border-y border-rule">
      {q.data.map((v) => (
        <li key={v.version} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0 text-sm">
            <p className="font-medium text-body">
              Version {v.version} {v.isCurrent && <span className="font-normal text-graphite">(current)</span>}
            </p>
            <p className="text-graphite">
              {when(v.createdAt)}
              {v.note ? `. ${v.note}` : ""}
            </p>
          </div>
          {!v.isCurrent && (
            <Button
              variant="secondary"
              size="sm"
              disabled={restore.isPending}
              onClick={() =>
                restore.mutate(v.version, {
                  onSuccess: (p) => toast(`Restored version ${v.version} as version ${p.version}.`),
                  onError: (e) => toast(e.message),
                })
              }
            >
              Restore
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}
