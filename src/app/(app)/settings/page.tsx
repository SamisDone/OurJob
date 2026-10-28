import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/shell/sign-out";
import { ThemeControl } from "@/components/shell/theme-control";
import { Callout } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

function SettingsSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-x-10 gap-y-3 border-t border-rule py-8 md:grid-cols-[200px_1fr]">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-[960px] px-4 pt-8 pb-16 md:px-8 lg:px-12">
      <h1 className="mb-6 text-xl font-semibold">Settings</h1>

      <SettingsSection id="account" title="Account">
        <p className="text-body">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>
        <SignOutButton className="mt-4" />
      </SettingsSection>

      <SettingsSection id="ai" title="AI provider">
        <p className="text-body">
          Gemini, model <span className="font-medium">{process.env.LLM_MODEL || "not set"}</span>.
        </p>
        <Callout className="mt-3">
          On Gemini&apos;s free tier, Google can use what you send to improve its products. Use a paid key or another
          provider if you would rather it did not.
        </Callout>
      </SettingsSection>

      <SettingsSection id="theme" title="Theme">
        <ThemeControl />
      </SettingsSection>
    </div>
  );
}
