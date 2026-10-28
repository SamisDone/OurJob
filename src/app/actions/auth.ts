"use server";

import { signOut } from "@/auth";

/** Ends the session and lands on the sign-in page with a quiet "Signed out" note. */
export async function signOutAction() {
  await signOut({ redirectTo: "/sign-in?signedOut=1" });
}
