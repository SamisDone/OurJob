import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAllowedEmail } from "./allowlist";

/**
 * Data access layer entry: every server component, action and route handler
 * that touches user data calls this, even though the proxy also checks.
 */
export async function requireUser() {
  const session = await auth();
  const email = session?.user?.email;
  if (!session?.user?.id || !email || !isAllowedEmail(email)) redirect("/sign-in");
  return { id: session.user.id, email, name: session.user.name ?? null, image: session.user.image ?? null };
}
