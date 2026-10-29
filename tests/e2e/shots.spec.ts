import { readFileSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { SHELL_USERS, signInAs } from "./helpers";

/**
 * Review screenshots. Not part of the normal suite:
 * SHOTS_DIR=<folder> pnpm exec playwright test tests/e2e/shots.spec.ts --project=desktop --workers=1
 * Seeds the fictional Nadia Chowdhury profile through the real API.
 */
const dir = process.env.SHOTS_DIR;
const WIDTHS = [1440, 1100, 390];

async function shoot(page: Page, name: string, path: string, suffix: string, selector?: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  if (selector) {
    // Widen the shot by 32 px on each side so content that bleeds past its section (the desk) is in it.
    const box = await page.locator(selector).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
    });
    const vw = page.viewportSize()!.width;
    const x = Math.max(0, box.x - 32);
    const clip = { x, y: box.y, width: Math.min(vw, box.x + box.width + 32) - x, height: box.height };
    await page.screenshot({ path: `${dir}/${name}-${suffix}.png`, fullPage: true, clip });
  } else await page.screenshot({ path: `${dir}/${name}-${suffix}.png`, fullPage: true });
}

for (const theme of ["light", "dark"] as const) {
  test(`screens in ${theme}`, async ({ browser, baseURL }) => {
    test.skip(!dir, "Set SHOTS_DIR to take review screenshots.");
    test.setTimeout(600_000);
    for (const width of WIDTHS) {
      const suffix = `${width}-${theme}`;
      const context = await browser.newContext({
        viewport: { width, height: width < 600 ? 844 : 900 },
        colorScheme: theme,
      });
      await signInAs(context, baseURL!, "allowed@example.com", "Nadia Chowdhury");
      const page = await context.newPage();
      const api = page.request;

      await api.delete("/api/sources?kind=cv_md");
      await api.delete("/api/sources?kind=linkedin_pdf");
      await shoot(page, "onboarding-1-empty", "/onboarding?step=1", suffix);

      await api.post("/api/sources", {
        multipart: {
          file: {
            name: "nadia-chowdhury.md",
            mimeType: "text/markdown",
            buffer: readFileSync("tests/fixtures/cvs/nadia-chowdhury.md"),
          },
        },
      });
      await shoot(page, "onboarding-1-preview", "/onboarding?step=1", suffix);
      await shoot(page, "onboarding-2", "/onboarding?step=2", suffix);
      await shoot(page, "desk", "/design", suffix, "#desk");
      await shoot(page, "reading", "/design", suffix, "#reading");
      await shoot(page, "tracker", "/design", suffix, "#tracker");
      await shoot(page, "states", "/design", suffix, "#states");
      await shoot(page, "controls", "/design", suffix, "#controls");
      await context.close();
    }
  });
}

/** The app shell on its main screens, for a person with no profile and one with a confirmed profile. */
for (const theme of ["light", "dark"] as const) {
  test(`shell screens in ${theme}`, async ({ browser, baseURL }) => {
    test.skip(!dir, "Set SHOTS_DIR to take review screenshots.");
    test.setTimeout(300_000);
    for (const width of [1440, 390]) {
      const suffix = `${width}-${theme}`;
      for (const kind of ["fresh", "confirmed"] as const) {
        const user = SHELL_USERS[kind];
        const context = await browser.newContext({
          viewport: { width, height: width < 600 ? 844 : 900 },
          colorScheme: theme,
        });
        await signInAs(context, baseURL!, user.email, user.name, user.id);
        const page = await context.newPage();
        await shoot(page, `today-${kind}`, "/today", suffix);
        if (kind === "fresh") await shoot(page, "onboarding", "/onboarding", suffix);
        else await shoot(page, "profile", "/profile", suffix);
        await context.close();
      }
    }
  });
}
