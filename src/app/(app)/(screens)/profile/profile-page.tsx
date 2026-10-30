"use client";

import { useIsMutating } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import Link from "next/link";
import { LoadError } from "@/components/load-error";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { VersionHistory } from "@/components/profile/version-history";
import { Page, PageHeader } from "@/components/shell/page-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/lib/query/profile";
import { mutationKeys } from "@/lib/query-keys";

/** The master profile: the only source of truth about him. */
export function ProfilePage() {
  const q = useProfile();
  const saving = useIsMutating({ mutationKey: mutationKeys.profile.edit }) > 0;

  return (
    <Page>
      <PageHeader
        title="Profile"
        description={
          <span aria-live="polite">
            {q.data
              ? saving
                ? "Saving"
                : `Saved as version ${q.data.version}. Every change is kept.`
              : "Everything tailoring may use about you."}
          </span>
        }
        actions={q.data && <VersionHistory />}
      />

      {q.isPending && <ProfileSkeleton />}
      {q.isError && (
        <LoadError title="Your profile did not load." onRetry={() => void q.refetch()}>
          {q.error.message}
        </LoadError>
      )}
      {q.data === null && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>No profile yet.</EmptyTitle>
            <EmptyDescription>
              Upload your CV and the app builds your profile from it. You review everything before it is used.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/onboarding">Start with your CV</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
      {q.data && <ProfileEditor version={q.data} />}
    </Page>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy className="space-y-6">
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
