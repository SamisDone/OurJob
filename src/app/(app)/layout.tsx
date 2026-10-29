import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/session";

/**
 * The one layout for every signed-in page, onboarding and the signed-in 404
 * included. It stays mounted across navigation, so the sidebar, header,
 * command palette and account menu never re-mount or flash.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // The shadcn Sidebar remembers its state in this cookie.
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  return (
    <AppShell user={{ name: user.name, email: user.email, image: user.image }} defaultOpen={defaultOpen}>
      {children}
    </AppShell>
  );
}
