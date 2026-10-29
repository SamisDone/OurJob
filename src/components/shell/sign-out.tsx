"use client";

import type { QueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { signOut as authSignOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { getQueryClient } from "@/lib/query/client";

/**
 * Signs out: settles running requests, clears the TanStack Query cache, ends
 * the session through Auth.js, then loads /sign-in fresh so nothing from the
 * session stays in memory. No confirmation: signing out loses nothing.
 */
export function useSignOut() {
  const [pending, startTransition] = useTransition();
  const signOut = () =>
    startTransition(async () => {
      await settleRequests(getQueryClient());
      getQueryClient().clear();
      // Auth.js's sign-out endpoint (with its CSRF token) clears the session
      // cookie. Not a server action: those also re-render the page being left,
      // which made signing out take seconds on a busy server.
      await authSignOut({ redirect: false });
      window.location.replace("/sign-in?signedOut=1");
    });
  return { signOut, pending };
}

/**
 * Every authenticated response refreshes the session cookie. A request that
 * started before sign-out and finished after it would set the cookie again
 * and quietly sign him back in. So: abort running queries (their fetches use
 * the abort signal) and give running mutations up to 5 s to finish first.
 */
export async function settleRequests(qc: QueryClient, timeoutMs = 5000) {
  await qc.cancelQueries();
  const started = Date.now();
  while (qc.isMutating() > 0 && Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

export function SignOutButton({ className }: { className?: string }) {
  const { signOut, pending } = useSignOut();
  return (
    <Button variant="outline" className={className} onClick={signOut} disabled={pending}>
      <LogOut data-icon="inline-start" />
      {pending ? "Signing out" : "Sign out"}
    </Button>
  );
}
