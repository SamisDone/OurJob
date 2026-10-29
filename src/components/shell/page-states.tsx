import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import type { ProfileStatus } from "@/lib/profile/status";

/** Page frame for the shell's simple pages: heading, then one index card. */
export function PageFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-16 md:px-8 lg:px-12">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <div className="mt-8 max-w-[720px]">{children}</div>
    </div>
  );
}

/** A screen that is not in this build yet. Each one is removed as its phase lands. */
export function ComingSoon({ title, children }: { title: string; children: string }) {
  return (
    <PageFrame title={title}>
      <EmptyState title="Coming soon in this build.">{children}</EmptyState>
    </PageFrame>
  );
}

/**
 * A screen that needs a confirmed profile. It still opens inside the shell
 * and says why it is empty, with the way back into onboarding.
 */
export function NeedsProfile({ title, status, children }: { title: string; status: ProfileStatus; children: string }) {
  // With a draft profile, step 3 (review) is where he left off.
  const href = status === "draft" ? "/onboarding?step=3" : "/onboarding";
  return (
    <PageFrame title={title}>
      <EmptyState
        title="Finish your profile first."
        action={
          <Button asChild>
            <Link href={href}>Continue onboarding</Link>
          </Button>
        }
      >
        {children}
      </EmptyState>
    </PageFrame>
  );
}
