import type { BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";

// Must match playwright.config.ts webServer env.
export const E2E_SECRET = "e2e-test-secret-not-for-production-0123456789";
export const SESSION_COOKIE = "authjs.session-token";

/** The fictional person e2e tests sign in as. global-setup.ts creates their users row. */
export const E2E_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "allowed@example.com",
  name: "Test Person",
};

/**
 * Two more fictional people for the app shell test, so it never races the
 * onboarding test over E2E_USER's data: one with no profile, one with a
 * confirmed profile (seeded in global-setup.ts).
 */
export const SHELL_USERS = {
  fresh: { id: "00000000-0000-4000-8000-000000000002", email: "fresh@example.com", name: "Fresh Person" },
  confirmed: { id: "00000000-0000-4000-8000-000000000003", email: "confirmed@example.com", name: "Nadia Chowdhury" },
} as const;

/** Mints an Auth.js session cookie for a fictional person, so tests never call Google. */
export async function signInAs(
  context: BrowserContext,
  baseURL: string,
  email: string,
  name = "Test Person",
  uid: string = E2E_USER.id,
) {
  const token = await encode({
    salt: SESSION_COOKIE,
    secret: E2E_SECRET,
    token: { email, name, sub: "e2e", uid },
  });
  await context.addCookies([{ name: SESSION_COOKIE, value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
}
