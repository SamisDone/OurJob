import { expect, test, type Page } from "@playwright/test";
import { SHELL_USERS, signInAs } from "./helpers";

/**
 * Every signed-in route renders inside the one app shell: the rail on
 * desktop, the bottom bar on phones, with the right item active. Run for a
 * person with no profile and for one with a confirmed profile.
 */

type Route = {
  path: string;
  heading: string;
  nav: "Today" | "Tailor" | "Tracker" | "Companies" | "Profile" | "Settings";
};

const ROUTES: Route[] = [
  { path: "/today", heading: "Today", nav: "Today" },
  { path: "/tailor", heading: "Tailor", nav: "Tailor" },
  { path: "/tailor/example-id", heading: "Tailored CV", nav: "Tailor" },
  { path: "/jobs/example-id", heading: "Job", nav: "Today" },
  { path: "/tracker", heading: "Tracker", nav: "Tracker" },
  { path: "/companies", heading: "Companies", nav: "Companies" },
  { path: "/profile", heading: "Profile", nav: "Profile" },
  { path: "/settings", heading: "Settings", nav: "Settings" },
  { path: "/onboarding", heading: "Add your CV", nav: "Profile" },
];

/** Pages that need a confirmed profile, and those not built yet once it is confirmed. */
const GATED = new Set(["/today", "/tailor", "/tailor/example-id", "/jobs/example-id", "/tracker", "/companies"]);
const PHONE_BAR = new Set(["Today", "Tailor", "Tracker"]);

const visibleNav = (page: Page) => page.locator('nav[aria-label="Main"]').filter({ visible: true });

async function expectActive(page: Page, nav: string | null, phone: boolean) {
  const bar = visibleNav(page);
  await expect(bar).toHaveCount(1);
  const current = bar.locator('[aria-current="page"]');
  if (!phone) {
    // Desktop rail: the full set of items, one of them current.
    await expect(bar.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Account:/ })).toBeVisible();
    if (nav) await expect(current).toHaveAccessibleName(nav);
    else await expect(current).toHaveCount(0);
    return;
  }
  // Phone bottom bar: Today, Tailor, Tracker, More. The rest are under More, which is then active.
  await expect(bar).toHaveCSS("position", "fixed");
  const more = bar.getByRole("button", { name: /^More/ });
  if (nav && PHONE_BAR.has(nav)) {
    await expect(current).toHaveAccessibleName(nav);
    await expect(more).not.toHaveAttribute("data-active");
  } else if (nav) {
    await expect(current).toHaveCount(0);
    await expect(more).toHaveAttribute("data-active", "true");
    await more.click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet.locator('[aria-current="page"]')).toHaveAccessibleName(nav);
    await expect(sheet.getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  } else {
    await expect(current).toHaveCount(0);
    await expect(more).not.toHaveAttribute("data-active");
  }
}

for (const kind of ["fresh", "confirmed"] as const) {
  test(`every signed-in route is inside the shell (${kind === "fresh" ? "no profile" : "confirmed profile"})`, async ({
    page,
    context,
    baseURL,
  }, info) => {
    test.setTimeout(120_000);
    const phone = info.project.name === "phone";
    const user = SHELL_USERS[kind];
    await signInAs(context, baseURL!, user.email, user.name, user.id);

    for (const route of ROUTES) {
      await test.step(route.path, async () => {
        await page.goto(route.path);
        await expect(page, "no redirect away from the page").toHaveURL(new RegExp(`${route.path}$`));
        await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
        if (GATED.has(route.path)) {
          if (kind === "fresh") {
            await expect(page.getByText("Finish your profile first.")).toBeVisible();
            await expect(page.getByRole("link", { name: "Continue onboarding" })).toHaveAttribute(
              "href",
              "/onboarding",
            );
          } else {
            await expect(page.getByText("Coming soon in this build.")).toBeVisible();
          }
        }
        await expectActive(page, route.nav, phone);
      });
    }

    await test.step("signed-in 404", async () => {
      const res = await page.goto("/no-such-page");
      expect(res?.status()).toBe(404);
      await expect(page.getByText("This page does not exist.")).toBeVisible();
      await expectActive(page, null, phone);
    });
  });
}

test("the shell stays mounted while moving between pages", async ({ page, context, baseURL }, info) => {
  test.skip(info.project.name === "phone", "Same shell on phones; the rail is the easiest part to watch.");
  const user = SHELL_USERS.fresh;
  await signInAs(context, baseURL!, user.email, user.name, user.id);
  await page.goto("/today");
  const rail = visibleNav(page);
  await rail.evaluate((el) => el.setAttribute("data-mark", "first-render"));
  const box = await rail.boundingBox();

  for (const name of ["Profile", "Tailor", "Settings", "Today"]) {
    await rail.getByRole("link", { name }).click();
    await expect(rail.locator('[aria-current="page"]')).toHaveAccessibleName(name);
  }
  // Today's button leads into onboarding, which is inside the same shell.
  await page.getByRole("link", { name: "Continue onboarding" }).click();
  await expect(page.getByRole("heading", { name: "Add your CV" })).toBeVisible();

  await expect(rail, "same rail element, never re-mounted").toHaveAttribute("data-mark", "first-render");
  expect(await rail.boundingBox()).toEqual(box);
});

test("a collapsed rail stays collapsed, from the first paint", async ({ browser, baseURL }, info) => {
  test.skip(info.project.name === "phone", "The rail is a desktop feature.");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const user = SHELL_USERS.fresh;
  await signInAs(context, baseURL!, user.email, user.name, user.id);
  const page = await context.newPage();
  await page.goto("/profile");
  await visibleNav(page).getByRole("button", { name: "Collapse menu" }).click();
  await expect(visibleNav(page)).toHaveCSS("width", "64px");

  // Without JavaScript the server's HTML alone must already be collapsed: no flash of the wide rail.
  const cookies = await context.cookies();
  const noJs = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  await noJs.addCookies(cookies);
  const plain = await noJs.newPage();
  await plain.goto("/settings");
  await expect(plain.locator('nav[aria-label="Main"]').first()).toHaveCSS("width", "64px");
  await noJs.close();
  await context.close();
});

test("sign in has no shell", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(0);
});
