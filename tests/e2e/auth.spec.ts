import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
});

test("an allowed email gets the app", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "allowed@example.com");
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
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

test("the style tile puts the signed-in person's name on the sample", async ({ page, context, baseURL }) => {
  await signInAs(context, baseURL!, "allowed@example.com");
  await page.goto("/design");
  await expect(page.getByText("Good morning, Test")).toBeVisible();
  await expect(page.getByText("Nadia")).toHaveCount(0);
});

test("the style tile renders when enabled", async ({ page }) => {
  await page.goto("/design");
  await expect(page.getByRole("heading", { name: "Style tile" })).toBeVisible();
  await expect(page.getByText("Good morning, Nadia")).toBeVisible();
  await expect(page.locator("mark[data-kind=matched]").first()).toBeVisible();
});
