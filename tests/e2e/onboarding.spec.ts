import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

/**
 * Onboarding steps 1 to 4 end to end with the mock LLM provider and the
 * fictional Nadia Chowdhury fixtures (Phase 1 done criterion). One flow,
 * run once on desktop, because it changes the test person's data.
 */
test.describe.configure({ mode: "serial" });

test("onboarding builds, reviews and confirms a profile, then saves preferences", async ({
  page,
  context,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "Runs once; it changes the test person's data.");
  // Generous: with E2E_LLM_PROVIDER=gemini the build and suggestions call the real model.
  test.setTimeout(900_000);
  await signInAs(context, baseURL!, "allowed@example.com", "Nadia Chowdhury");

  // With no confirmed profile, Today says why it is empty and leads into onboarding, inside the shell.
  await page.goto("/today");
  await expect(page.getByText("Finish your profile first.")).toBeVisible();
  await page.getByRole("link", { name: "Continue onboarding" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("heading", { name: "Add your CV" })).toBeVisible();

  // Step 1: upload the CV and check the text came through.
  await page.getByLabel("Your CV file").setInputFiles("tests/fixtures/cvs/nadia-chowdhury.md");
  await expect(page.getByRole("heading", { name: "nadia-chowdhury.md" })).toBeVisible();
  await expect(page.getByLabel("Text read from your CV")).toContainText("Senior Backend Engineer, Parcelwise");
  await page.getByRole("button", { name: "Looks right" }).click();

  // Step 2: add the LinkedIn export, then build.
  await expect(page.getByRole("heading", { name: "Add more sources" })).toBeVisible();

  // Done steps go back; future steps are not buttons.
  await expect(page.getByRole("button", { name: /^Review profile/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^Add your CV/ }).click();
  await expect(page.getByRole("heading", { name: "Add your CV" })).toBeVisible();
  await page.getByRole("button", { name: "Looks right" }).click();
  await expect(page.getByRole("heading", { name: "Add more sources" })).toBeVisible();
  await page.getByLabel("LinkedIn PDF").setInputFiles("tests/fixtures/linkedin/nadia-chowdhury-linkedin.pdf");
  await expect(page.getByText(/LinkedIn export added/)).toBeVisible();
  await page.getByRole("button", { name: "Build my profile" }).click();

  // Step 3: the disagreement is shown first and blocks confirming.
  await expect(page.getByRole("heading", { name: "Review your profile" })).toBeVisible({ timeout: 400_000 });
  await expect(page.getByRole("heading", { name: "Your sources disagree on one thing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "This is right" })).toBeDisabled();
  const conflict = page.getByRole("group", { name: "Taka Pay: end date" });
  await conflict.getByText("Apr 2023").click();
  await conflict.getByRole("button", { name: "Use this" }).click();
  await expect(page.getByRole("heading", { name: /Your sources disagree/ })).toBeHidden();
  await expect(page.getByRole("article", { name: "Backend Developer at Taka Pay" })).toContainText(
    "Feb 2020 to Apr 2023",
  );

  // Source badges show where items came from.
  await expect(
    page
      .getByRole("article", { name: "Senior Backend Engineer at Parcelwise" })
      .getByLabel("From CV, LinkedIn")
      .first(),
  ).toBeVisible();

  // Edit a bullet in place; it saves as a new version.
  await page.getByRole("button", { name: "Edit bullet 3 in Senior Backend Engineer at Parcelwise" }).click();
  await page
    .getByRole("textbox", { name: "bullet 3 in Senior Backend Engineer at Parcelwise" })
    .fill("Mentor 3 junior engineers and run the weekly architecture review for the platform team.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("for the platform team.")).toBeVisible();

  // Keyboard alternative to drag: move a bullet up.
  await page.getByRole("button", { name: "Move bullet 3 up" }).first().click();

  await page.getByRole("button", { name: "This is right" }).click();

  // Step 4: preferences arrive pre-filled from P5.
  await expect(page.getByRole("heading", { name: "Set what you are looking for" })).toBeVisible();
  await expect(page.getByText("Suggested from your profile.")).toBeVisible({ timeout: 400_000 });
  await expect(page.getByRole("button", { name: "Remove Backend Engineer" })).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: "Your profile is ready" })).toBeVisible();

  // The profile page lists every version with what changed, and restores.
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Nadia Chowdhury" })).toBeVisible();
  await page.getByRole("button", { name: "Version history" }).click();
  const history = page.getByRole("dialog", { name: "Version history" });
  await expect(history.getByText("Built from your CV and LinkedIn")).toBeVisible();
  await expect(history.getByText(/Resolved end for Taka Pay/)).toBeVisible();
  await expect(history.getByText(/Edited a bullet in Parcelwise/)).toBeVisible();
  await history.getByRole("button", { name: "Restore" }).last().click();
  await expect(page.getByText(/Restored version 1 as version \d+/)).toBeVisible();

  // Confirmed: Today no longer asks him to finish onboarding.
  await page.goto("/today");
  await expect(page.getByText("Coming soon in this build.")).toBeVisible();
  await expect(page.getByText("Finish your profile first.")).toHaveCount(0);
});
