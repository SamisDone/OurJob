import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { TooltipProvider } from "@/components/ui/overlay";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <TooltipProvider>
      <AppShell user={{ name: user.name }}>{children}</AppShell>
    </TooltipProvider>
  );
}
