"use client";

import { History } from "lucide-react";
import { toast } from "sonner";
import { LoadError } from "@/components/load-error";
import { Nums } from "@/components/nums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
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
        <Button variant="outline">
          <History data-icon="inline-start" />
          Version history
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Every save is kept. Restoring makes a copy of that version the newest one.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <Versions />
        </div>
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
      <LoadError title="Versions did not load." onRetry={() => void q.refetch()}>
        {q.error.message}
      </LoadError>
    );
  return (
    <ol className="divide-y border-y">
      {q.data.map((v) => (
        <li key={v.version} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Nums>{`Version ${v.version}`}</Nums>
              {v.isCurrent && <Badge variant="secondary">Current</Badge>}
            </p>
            <p className="text-muted-foreground">
              <Nums>{when(v.createdAt)}</Nums>
              {v.note ? `. ${v.note}` : ""}
            </p>
          </div>
          {!v.isCurrent && (
            <Button
              variant="outline"
              size="sm"
              disabled={restore.isPending}
              onClick={() =>
                restore.mutate(v.version, {
                  onSuccess: (p) => toast(`Restored version ${v.version} as version ${p.version}.`),
                  onError: (e) => toast.error(e.message),
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
