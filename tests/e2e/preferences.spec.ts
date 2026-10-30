import { expect, test } from "@playwright/test";
import { SHELL_USERS, signInAs } from "./helpers";

/**
 * Onboarding step 4 shows its fields at once, filled from the profile, and
 * never waits on the model: P5 runs after (up to 30 s with Gemini; here the
 * mock waits LLM_MOCK_DELAY_MS, 1.5 s). In production it once showed only
 * skeletons because the preferences request waited on P5.
 */
test("step 4 shows the preference fields at once, then adds the model's suggestions", async ({
  page,
  context,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "Same form on phones; this checks the request order.");
  const user = SHELL_USERS.confirmed;
  await signInAs(context, baseURL!, user.email, user.name, user.id);

  // Hold the suggestion until the fields are on screen: they must not need it.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/preferences/suggest", async (route) => {
    await held;
    await route.continue();
  });
  const prefs = page.waitForResponse((r) => r.url().endsWith("/api/preferences") && r.request().method() === "GET");
  await page.goto("/onboarding?step=4");

  // The preferences request answers without the model (one mock model call alone is 1.5 s).
  const res = await prefs;
  const t = res.request().timing();
  expect(t.responseEnd - t.requestStart, "GET /api/preferences waited on the model").toBeLessThan(1200);

  const main = page.locator("#main");
  await expect(main.getByRole("heading", { name: "Set what you are looking for" })).toBeVisible();
  await expect(main.getByLabel("Job titles to search for")).toBeVisible();
  expect(await main.locator("input").count()).toBeGreaterThan(5);
  await expect(main.getByLabel("Minimum pay, in US dollars a year")).toBeEditable();
  // The draft: his own titles from the profile, while the suggestion is still on its way.
  await expect(main.getByRole("button", { name: "Remove Senior Backend Engineer" })).toBeVisible();
  await expect(main.getByText(/Finding more job titles and skills/)).toBeVisible();

  // P5 arrives and fills the untouched fields.
  release();
  await expect(main.getByText("Suggested from your profile.")).toBeVisible({ timeout: 15_000 });
  await expect(main.getByRole("button", { name: "Remove Platform Engineer" })).toBeVisible();
});
