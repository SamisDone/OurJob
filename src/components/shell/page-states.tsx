import { Clock, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { ProfileStatus } from "@/lib/profile/status";
import { cn } from "@/lib/utils";

/**
 * Page body: 24 px side padding on phones, 32 to 40 px on desktop. Wide pages
 * (tables, the tailor workspace) pass wide.
 */
export function Page({
  children,
  wide = false,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 pt-6 pb-16 md:px-8 md:pt-8 lg:px-10",
        wide ? "max-w-[1440px]" : "max-w-5xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Every page starts with a clear title and one sentence saying what the page is for. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-prose text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Page frame for the simple pages: title, sentence, content. */
export function PageFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Page>
      <PageHeader title={title} description={description} />
      {children}
    </Page>
  );
}

/** A screen that is not in this build yet. Each one is removed as its phase lands. */
export function ComingSoon({ title, description, children }: { title: string; description: string; children: string }) {
  return (
    <PageFrame title={title} description={description}>
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Clock />
          </EmptyMedia>
          <EmptyTitle>Coming soon in this build.</EmptyTitle>
          <EmptyDescription>{children}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageFrame>
  );
}

/**
 * A screen that needs a confirmed profile. It still opens inside the shell
 * and says why it is empty, with the way back into onboarding.
 */
export function NeedsProfile({
  title,
  description,
  status,
  children,
}: {
  title: string;
  description: string;
  status: ProfileStatus;
  children: string;
}) {
  // With a draft profile, step 3 (review) is where he left off.
  const href = status === "draft" ? "/onboarding?step=3" : "/onboarding";
  return (
    <PageFrame title={title} description={description}>
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserRound />
          </EmptyMedia>
          <EmptyTitle>Finish your profile first.</EmptyTitle>
          <EmptyDescription>{children}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={href}>Continue onboarding</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </PageFrame>
  );
}
