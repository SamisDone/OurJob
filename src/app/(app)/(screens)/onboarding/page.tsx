import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Set up your profile" };

/** Onboarding runs inside the app shell, so the rail, account menu and Sign out are always there. */
export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-[800px] px-4 pt-6 pb-20 md:px-8 lg:pt-[10vh]">
      <Suspense>
        <OnboardingFlow />
      </Suspense>
    </div>
  );
}
