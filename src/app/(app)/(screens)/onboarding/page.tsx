import type { Metadata } from "next";
import { Suspense } from "react";
import { Page } from "@/components/shell/page-states";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Set up your profile" };

/** Onboarding runs inside the app shell, so the sidebar, account menu and Sign out are always there. */
export default function OnboardingPage() {
  return (
    <Page>
      <Suspense>
        <OnboardingFlow />
      </Suspense>
    </Page>
  );
}
