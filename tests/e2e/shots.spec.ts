import { readFileSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { signInAs } from "./helpers";

/**
 * Review screenshots of the Phase 1 screens. Not part of the normal suite:
 * SHOTS_DIR=<folder> pnpm exec playwright test tests/e2e/shots.spec.ts --workers=1
 * Seeds the fictional Nadia Chowdhury profile through the real API first.
 */
const dir = process.env.SHOTS_DIR;

async function shoot(page: Page, name: string, path: string, suffix: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${dir}/${name}-${suffix}.png`, fullPage: true });
}

for (const theme of ["light", "dark"] as const) {
  test(`screens in ${theme}`, async ({ browser, baseURL }, info) => {
    test.skip(!dir, "Set SHOTS_DIR to take review screenshots.");
    test.setTimeout(240_000);
    const width = info.project.name === "phone" ? 390 : 1440;
    const suffix = `${width}-${theme}`;
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 900 },
      colorScheme: theme,
    });
    await signInAs(context, baseURL!, "allowed@example.com", "Nadia Chowdhury");
    const page = await context.newPage();
    const api = page.request;

    // Empty states first.
    await api.delete("/api/sources?kind=cv_md");
    await api.delete("/api/sources?kind=linkedin_pdf");
    await shoot(page, "onboarding-1-empty", "/onboarding?step=1", suffix);

    // Seed through the real API: CV, LinkedIn export, build.
    const upload = (file: string, linkedin = false) =>
      api.post("/api/sources", {
        multipart: {
          file: { name: file.split("/").pop()!, mimeType: "application/octet-stream", buffer: readFileSync(file) },
          ...(linkedin ? { kind: "linkedin" } : {}),
        },
      });
    await upload("tests/fixtures/cvs/nadia-chowdhury.md");
    await upload("tests/fixtures/linkedin/nadia-chowdhury-linkedin.pdf", true);
    await api.post("/api/profile/build");

    await shoot(page, "onboarding-1", "/onboarding?step=1", suffix);
    await shoot(page, "onboarding-2", "/onboarding?step=2", suffix);
    await shoot(page, "onboarding-3-conflict", "/onboarding?step=3", suffix);

    await api.patch("/api/profile", {
      data: { ops: [{ op: "resolveConflict", field: "experience.exp_2.end", value: "2023-04" }] },
    });
    await api.post("/api/profile/confirm");
    await shoot(page, "onboarding-4", "/onboarding?step=4", suffix);
    await shoot(page, "profile", "/profile", suffix);
    await shoot(page, "settings", "/settings", suffix);
    await context.close();
  });
}
