import { test, type Page } from "@playwright/test";
import { SHELL_USERS, signInAs } from "./helpers";

/**
 * Review screenshots of the shadcn/ui redesign. Not part of the normal suite:
 * SHOTS_DIR=<folder> pnpm exec playwright test tests/e2e/review-shots.spec.ts --project=desktop --workers=1
 * Uses the fictional Nadia Chowdhury (confirmed profile) and the preview routes.
 */
const dir = process.env.SHOTS_DIR;

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 390]) {
    test(`redesign at ${width} in ${theme}`, async ({ browser, baseURL }) => {
      test.skip(!dir, "Set SHOTS_DIR to take review screenshots.");
      test.setTimeout(300_000);
      const phone = width < 600;
      const context = await browser.newContext({
        viewport: { width, height: phone ? 844 : 900 },
        colorScheme: theme,
        deviceScaleFactor: phone ? 2 : 1,
      });
      const user = SHELL_USERS.confirmed;
      await signInAs(context, baseURL!, user.email, user.name, user.id);
      const page = await context.newPage();
      const shot = async (name: string, fullPage = true) => {
        // Phones: also the first screen as he sees it, with the fixed bottom bar where it belongs.
        if (phone && fullPage) await page.screenshot({ path: `${dir}/${name}-view-${width}-${theme}.png` });
        await page.screenshot({ path: `${dir}/${name}-${width}-${theme}.png`, fullPage });
      };

      await page.goto("/preview/today");
      await settle(page);
      await shot("today");

      await page.getByRole("button", { name: "Senior Backend Engineer" }).click();
      await page.getByRole("dialog").waitFor();
      await settle(page);
      await shot("today-sheet", false);
      await page.keyboard.press("Escape");

      for (const state of ["empty", "loading", "error", "late"]) {
        await page.goto(`/preview/today?state=${state}`);
        await settle(page);
        await shot(`today-${state}`, false);
      }

      await page.goto("/preview/tailor");
      await settle(page);
      await shot("tailor");

      await page.getByRole("tab", { name: /LaTeX/ }).click();
      await settle(page);
      await shot("tailor-latex", false);
      await page.getByRole("tab", { name: /Changes/ }).click();
      await settle(page);
      await shot("tailor-changes", false);

      await page.goto("/preview/tailor?state=paste");
      await settle(page);
      await shot("tailor-paste", false);
      await page.goto("/preview/tailor?state=working");
      await settle(page);
      await shot("tailor-working", false);

      // Shell: account menu open (desktop) or the sidebar sheet (phone).
      await page.goto("/preview/today");
      await settle(page);
      if (phone) {
        await page.getByRole("button", { name: /^More/ }).click();
        await settle(page);
        await shot("shell-menu", false);
      } else {
        await page.getByRole("button", { name: /^Account:/ }).click();
        await settle(page);
        await shot("shell-account", false);
        await page.keyboard.press("Escape");
        await page.keyboard.press("Control+b");
        await settle(page);
        await shot("shell-collapsed", false);
        await page.keyboard.press("Control+b");
        await page.keyboard.press("Control+k");
        await settle(page);
        await shot("shell-command", false);
      }
      await context.close();

      const anon = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, colorScheme: theme });
      const p2 = await anon.newPage();
      await p2.goto("/sign-in");
      await settle(p2);
      await p2.screenshot({ path: `${dir}/sign-in-${width}-${theme}.png` });
      await anon.close();
    });
  }
}
