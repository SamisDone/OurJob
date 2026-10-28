import { expect, test, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";

// Must match playwright.config.ts webServer env.
const SECRET = "e2e-test-secret-not-for-production-0123456789";
const COOKIE = "authjs.session-token";

async function signInAs(context: BrowserContext, baseURL: string, email: string) {
  const token = await encode({
    salt: COOKIE,
    secret: SECRET,
    token: { email, name: "Test Person", sub: "e2e", uid: "00000000-0000-4000-8000-000000000001" },
  });
  await context.addCookies([{ name: COOKIE, value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
}

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
});

test("an allowed email gets the app", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "allowed@example.com");
  await page.goto("/today");
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

test("an email that is not on the allowlist is refused, even with a valid session", async ({
  page,
  context,
  baseURL,
}) => {
  await signInAs(context, baseURL!, "someone-else@example.com");
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("the refusal message names the allowlist", async ({ page }) => {
  await page.goto("/sign-in?error=AccessDenied");
  await expect(page.getByRole("alert").filter({ hasText: "allowlist" })).toHaveText(
    "This account is not on the allowlist for this deployment. Ask the owner to add your email.",
  );
});

test("the style tile renders when enabled", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("heading", { name: "Style tile" })).toBeVisible();
  await expect(page.locator("mark[data-kind=matched]").first()).toBeVisible();
});
