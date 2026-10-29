import type { Metadata } from "next";
import { Suspense } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import { AccountMenu } from "@/components/shell/account-menu";
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
          <header className="mx-auto flex max-w-[800px] items-center justify-between gap-4 px-4 pt-4 md:px-8 md:pt-6">
            <Wordmark />
            {/* Settings and Sign out stay reachable during onboarding. */}
            <AccountMenu variant="header" user={{ name: user.name, email: user.email, image: user.image }} />
          </header>
          <main id="main" className="mx-auto max-w-[800px] px-4 pt-6 pb-20 md:px-8 lg:pt-[12vh]">
            <Suspense>
              <OnboardingFlow />
            </Suspense>
          </main>
        </div>
      </TooltipProvider>
    </QueryProvider>
  );
}
