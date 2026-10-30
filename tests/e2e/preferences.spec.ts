import { expect, test } from "@playwright/test";
import { SHELL_USERS, signInAs } from "./helpers";

/**
 * Onboarding step 4 shows its fields at once, filled from the profile, and
 * never waits on the model: P5 runs after, behind LLM_MOCK_DELAY_MS here and
 * up to 30 s with Gemini. (In production it once showed only skeletons.)
 */
test("step 4 shows the preference fields at once, then adds the model's suggestions", async ({
  page,
  context,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "Same form on phones; this checks timing.");
  const user = SHELL_USERS.confirmed;
  await signInAs(context, baseURL!, user.email, user.name, user.id);
  await page.goto("/onboarding?step=4");

  const main = page.locator("#main");
  await expect(main.getByRole("heading", { name: "Set what you are looking for" })).toBeVisible();
  // Faster than one mock model call: the fields cannot be waiting on P5.
  await expect(main.getByLabel("Job titles to search for")).toBeVisible({ timeout: 1000 });
  expect(await main.locator("input").count()).toBeGreaterThan(5);
  await expect(main.getByLabel("Minimum pay, in US dollars a year")).toBeEditable();
  // The draft: his own titles from the profile.
  await expect(main.getByRole("button", { name: "Remove Senior Backend Engineer" })).toBeVisible();

  // P5 arrives and fills the untouched fields.
  await expect(main.getByText("Suggested from your profile.")).toBeVisible({ timeout: 15_000 });
  await expect(main.getByRole("button", { name: "Remove Platform Engineer" })).toBeVisible();

  // Reloading shows the fields at once again.
  await page.reload();
  await expect(main.getByLabel("Job titles to search for")).toBeVisible({ timeout: 1000 });
});
