import type { Metadata } from "next";
import { Suspense } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import { Wordmark } from "@/components/shell/wordmark";
import { TooltipProvider } from "@/components/ui/overlay";
import { requireUser } from "@/lib/auth/session";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const user = await requireUser();
  return (
    <QueryProvider>
      <TooltipProvider>
        <div className="min-h-dvh">
          <header className="mx-auto flex max-w-[880px] items-center justify-between px-4 pt-6 md:px-8">
            <Wordmark />
            <span className="truncate text-sm text-graphite">{user.email}</span>
          </header>
          <main id="main" className="mx-auto max-w-[880px] px-4 pt-8 pb-20 md:px-8">
            <Suspense>
              <OnboardingFlow />
            </Suspense>
          </main>
        </div>
      </TooltipProvider>
    </QueryProvider>
  );
}
