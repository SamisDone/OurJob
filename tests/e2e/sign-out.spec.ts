import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("signing out ends the session and protected pages send you to sign in", async ({
  page,
  context,
  baseURL,
  isMobile,
}, testInfo) => {
  await signInAs(context, baseURL!, "allowed@example.com");
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  if (testInfo.project.name === "phone" || isMobile) {
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "More" }).getByRole("button", { name: "Sign out" }).click();
  } else {
    await page.getByRole("button", { name: "Account: Test Person" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
  }

  await expect(page).toHaveURL(/\/sign-in\?signedOut=1/);
  await expect(page.getByRole("status").filter({ hasText: "Signed out." })).toBeVisible();

  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "authjs.session-token")).toBeUndefined();

  for (const path of ["/today", "/profile", "/settings"]) {
    await page.goto(path);
    await expect(page, `${path} after sign out`).toHaveURL(/\/sign-in/);
  }
});

test("the command palette offers Sign out", async ({ page, context, baseURL }, testInfo) => {
  test.skip(testInfo.project.name === "phone", "The palette is a keyboard feature for desktop.");
  await signInAs(context, baseURL!, "allowed@example.com");
  await page.goto("/today");
  await page.keyboard.press("Control+k");
  await page.getByRole("option", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in\?signedOut=1/);
});
