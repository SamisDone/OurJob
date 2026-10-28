import type { BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";

// Must match playwright.config.ts webServer env.
export const E2E_SECRET = "e2e-test-secret-not-for-production-0123456789";
export const SESSION_COOKIE = "authjs.session-token";

/** Mints an Auth.js session cookie for a fictional person, so tests never call Google. */
export async function signInAs(context: BrowserContext, baseURL: string, email: string, name = "Test Person") {
  const token = await encode({
    salt: SESSION_COOKIE,
    secret: E2E_SECRET,
    token: { email, name, sub: "e2e", uid: "00000000-0000-4000-8000-000000000001" },
  });
  await context.addCookies([{ name: SESSION_COOKIE, value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
}
