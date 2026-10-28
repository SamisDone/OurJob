"use client";

import { SignOutIcon } from "@phosphor-icons/react/ssr";
import { useTransition } from "react";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { getQueryClient } from "@/lib/query/client";

/**
 * Signs out: first clears the TanStack Query cache so nothing from this
 * session stays in memory, then ends the Auth.js session on the server,
 * which redirects to /sign-in. No confirmation: signing out loses nothing.
 */
export function useSignOut() {
  const [pending, startTransition] = useTransition();
  const signOut = () =>
    startTransition(async () => {
      getQueryClient().clear();
      await signOutAction();
    });
  return { signOut, pending };
}

export function SignOutButton({ className }: { className?: string }) {
  const { signOut, pending } = useSignOut();
  return (
    <Button variant="secondary" className={className} onClick={signOut} disabled={pending}>
      <SignOutIcon aria-hidden />
      {pending ? "Signing out" : "Sign out"}
    </Button>
  );
}
