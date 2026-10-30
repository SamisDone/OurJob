import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Page, PageHeader } from "@/components/shell/page-states";
import { SignOutButton } from "@/components/shell/sign-out";
import { ThemeControl } from "@/components/shell/theme-control";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { AiSection } from "./ai-section";
import { PreferencesSection } from "./preferences-section";

export const metadata: Metadata = { title: "Settings" };

function SettingsCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card aria-labelledby={id} role="region">
      <CardHeader>
        <CardTitle>
          <h2 id={id}>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <Page className="max-w-3xl">
      <PageHeader title="Settings" description="Your account, what the daily search looks for, and how the app works." />
      <div className="space-y-6">
        <SettingsCard id="account" title="Account" description={`Signed in as ${user.email}.`}>
          <SignOutButton />
        </SettingsCard>

        <SettingsCard
          id="preferences"
          title="Search preferences"
          description="What the daily job search looks for. Changes apply from the next run."
        >
          <PreferencesSection />
        </SettingsCard>

        <SettingsCard id="ai" title="AI provider" description="The model that reads job posts and tailors your CV.">
          <AiSection />
        </SettingsCard>

        <SettingsCard id="theme" title="Theme" description="System follows your device.">
          <ThemeControl />
        </SettingsCard>
      </div>
    </Page>
  );
}
