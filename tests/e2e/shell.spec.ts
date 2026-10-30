import { expect, test, type Locator, type Page } from "@playwright/test";
import { SHELL_USERS, signInAs } from "./helpers";

/**
 * Every signed-in route renders inside the one app shell: the sidebar on
 * desktop, the bottom bar on phones, with the right item active. Run for a
 * person with no profile and for one with a confirmed profile.
 */

type Route = {
  path: string;
  heading: string;
  /** The heading once the profile is confirmed, when it differs. */
  confirmedHeading?: string;
  nav: "Today" | "Tailor" | "Tracker" | "Companies" | "Profile" | "Settings";
};

const ROUTES: Route[] = [
  { path: "/today", heading: "Today", nav: "Today" },
  { path: "/tailor", heading: "Tailor", nav: "Tailor" },
  // Not a tailoring id: the signed-in 404, still under Tailor.
  { path: "/tailor/example-id", heading: "Tailored CV", confirmedHeading: "Page not found", nav: "Tailor" },
  { path: "/jobs/example-id", heading: "Job", nav: "Today" },
  { path: "/tracker", heading: "Tracker", nav: "Tracker" },
  { path: "/companies", heading: "Companies", nav: "Companies" },
  { path: "/profile", heading: "Profile", nav: "Profile" },
  { path: "/settings", heading: "Settings", nav: "Settings" },
  { path: "/onboarding", heading: "Add your CV", nav: "Profile" },
];

/** Pages that need a confirmed profile. */
const GATED = new Set(["/today", "/tailor", "/tailor/example-id", "/jobs/example-id", "/tracker", "/companies"]);
/** What a gated page shows once the profile is confirmed. */
const CONFIRMED: Record<string, (main: Locator) => Promise<void>> = {
  "/tailor": (main) => expect(main.getByLabel("Job post")).toBeVisible(),
  "/tailor/example-id": (main) => expect(main.getByText("This page does not exist.")).toBeVisible(),
};
const PHONE_BAR = new Set(["Today", "Tailor", "Tracker"]);

/** Desktop: the sidebar. Phones: the bottom bar (the sidebar is hidden, then a sheet). */
const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main" });

async function expectActive(page: Page, nav: string | null, phone: boolean) {
  const bar = mainNav(page);
  await expect(bar).toHaveCount(1);
  const current = bar.locator('[aria-current="page"]');
  if (!phone) {
    // Desktop sidebar: the full set of items, one of them current, and the account menu.
    await expect(bar.getByRole("link", { name: "Profile" })).toBeVisible();
    await expect(bar.getByRole("button", { name: /^Account:/ })).toBeVisible();
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
    await expect(more).toHaveAccessibleName(`More, current page ${nav}`);
    await more.click();
    const sheet = page.getByRole("dialog", { name: "Menu" });
    await expect(sheet.locator('[aria-current="page"]')).toHaveAccessibleName(nav);
    await expect(sheet.getByRole("button", { name: /^Account:/ })).toBeVisible();
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
        // Inside #main: while a page streams in, React keeps a hidden copy of it elsewhere in <body>.
        const main = page.locator("#main");
        const heading = kind === "confirmed" ? (route.confirmedHeading ?? route.heading) : route.heading;
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        if (GATED.has(route.path)) {
          if (kind === "fresh") {
            await expect(main.getByText("Finish your profile first.")).toBeVisible();
            await expect(main.getByRole("link", { name: "Continue onboarding" })).toHaveAttribute(
              "href",
              "/onboarding",
            );
          } else if (CONFIRMED[route.path]) {
            await CONFIRMED[route.path](main);
          } else {
            await expect(main.getByText("Coming soon in this build.")).toBeVisible();
          }
        }
        await expectActive(page, route.nav, phone);
      });
    }

    await test.step("signed-in 404", async () => {
      const res = await page.goto("/no-such-page");
      expect(res?.status()).toBe(404);
      await expect(page.locator("#main").getByText("This page does not exist.")).toBeVisible();
      await expectActive(page, null, phone);
    });
  });
}

test("the shell stays mounted while moving between pages", async ({ page, context, baseURL }, info) => {
  test.skip(info.project.name === "phone", "Same shell on phones; the sidebar is the easiest part to watch.");
  const user = SHELL_USERS.fresh;
  await signInAs(context, baseURL!, user.email, user.name, user.id);
  await page.goto("/today");
  const sidebar = mainNav(page);
  await sidebar.evaluate((el) => el.setAttribute("data-mark", "first-render"));
  const box = await sidebar.boundingBox();

  for (const name of ["Profile", "Tailor", "Settings", "Today"]) {
    await sidebar.getByRole("link", { name }).click();
    await expect(sidebar.locator('[aria-current="page"]')).toHaveAccessibleName(name);
  }
  // Today's button leads into onboarding, which is inside the same shell.
  await page.getByRole("link", { name: "Continue onboarding" }).click();
  await expect(page.getByRole("heading", { name: "Add your CV" })).toBeVisible();

  await expect(sidebar, "same sidebar element, never re-mounted").toHaveAttribute("data-mark", "first-render");
  expect(await sidebar.boundingBox()).toEqual(box);
});

test("a collapsed sidebar stays collapsed, from the first paint", async ({ browser, baseURL }, info) => {
  test.skip(info.project.name === "phone", "Collapsing is a desktop feature.");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const user = SHELL_USERS.fresh;
  await signInAs(context, baseURL!, user.email, user.name, user.id);
  const page = await context.newPage();
  await page.goto("/profile");
  await page.getByRole("button", { name: "Toggle menu" }).click();
  // Icons only: 3rem.
  await expect(mainNav(page)).toHaveCSS("width", "48px");

  // Without JavaScript the server's HTML alone must already be collapsed: no flash of the wide sidebar.
  const cookies = await context.cookies();
  const noJs = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  await noJs.addCookies(cookies);
  const plain = await noJs.newPage();
  await plain.goto("/settings");
  await expect(mainNav(plain)).toHaveCSS("width", "48px");
  await noJs.close();
  await context.close();
});

test("sign in has no shell", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(mainNav(page)).toHaveCount(0);
});
