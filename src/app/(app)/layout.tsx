import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { RAIL_COOKIE } from "@/components/shell/rail";
import { TooltipProvider } from "@/components/ui/overlay";
import { requireUser } from "@/lib/auth/session";

/**
 * The one layout for every signed-in page, onboarding and the signed-in 404
 * included. It stays mounted across navigation, so the rail, bottom bar,
 * command palette and account menu never re-mount or flash.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const collapsed = (await cookies()).get(RAIL_COOKIE)?.value === "collapsed";
  return (
    <TooltipProvider>
      <AppShell user={{ name: user.name, email: user.email, image: user.image }} initialCollapsed={collapsed}>
        {children}
      </AppShell>
    </TooltipProvider>
  );
}
