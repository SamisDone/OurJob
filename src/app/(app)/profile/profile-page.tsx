"use client";

import Link from "next/link";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { VersionHistory } from "@/components/profile/version-history";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useProfile } from "@/lib/query/profile";
import { useIsMutating } from "@tanstack/react-query";
import { mutationKeys } from "@/lib/query-keys";

/** The master profile: the only source of truth about him. */
export function ProfilePage() {
  const q = useProfile();
  const saving = useIsMutating({ mutationKey: mutationKeys.profile.edit }) > 0;

  return (
    <div className="mx-auto max-w-[920px] px-4 pt-8 pb-16 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Profile</h1>
          <p className="mt-1 text-sm text-graphite" aria-live="polite">
            {q.data
              ? saving
                ? "Saving"
                : `Saved as version ${q.data.version}. Every change is kept.`
              : "Everything tailoring may use about you."}
          </p>
        </div>
        {q.data && <VersionHistory />}
      </div>

      {q.isPending && <ProfileSkeleton />}
      {q.isError && (
        <ErrorState title="Your profile did not load." onRetry={() => void q.refetch()}>
          {q.error.message}
        </ErrorState>
      )}
      {q.data === null && (
        <EmptyState
          title="No profile yet."
          action={
            <Button asChild>
              <Link href="/onboarding">Start with your CV</Link>
            </Button>
          }
        >
          Upload your CV and the app builds your profile from it. You review everything before it is used.
        </EmptyState>
      )}
      {q.data && <ProfileEditor version={q.data} />}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy className="rounded-panel border border-rule bg-sheet px-5 pt-8 pb-10 md:px-10">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-5 w-40" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="mt-10 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}
