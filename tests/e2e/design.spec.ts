import { expect, test, type Page } from "@playwright/test";

/** Measurable checks on the style tile (DESIGN.md 9 and 10). */

async function openTile(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/design");
  await page.evaluate(() => document.fonts.ready);
}

for (const width of [1440, 1100, 390]) {
  test(`CV text is never smaller than 9 px, and nothing scrolls sideways, at ${width} px`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await openTile(page, width);
    const sheet = page.locator("#cv .cv-sheet").first();
    await expect(sheet).toBeVisible();
    const smallest = await sheet.evaluate((el) => {
      let min = Infinity;
      for (const node of el.querySelectorAll("*")) {
        const has = [...node.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && c.textContent?.trim());
        if (!has || node.closest(".cv-page-break")) continue;
        min = Math.min(min, parseFloat(getComputedStyle(node).fontSize));
      }
      return min;
    });
    expect(smallest).toBeGreaterThanOrEqual(8.99);
    // The CV may scroll inside its own frame on phones; the page itself never does.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("phone tap targets: primary actions 44 px, nothing under 24 px", async ({ page }, info) => {
  test.skip(info.project.name !== "phone");
  await page.goto("/design");
  const sizes = await page.evaluate(() => {
    const pick = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].filter((e) => e.offsetParent);
    const measure = (e: HTMLElement) => ({
      name: e.getAttribute("aria-label") ?? e.textContent?.trim() ?? "",
      h: e.getBoundingClientRect().height,
      w: e.getBoundingClientRect().width,
    });
    return {
      primary: [
        ...pick('#controls [data-slot=button][data-variant=default][data-size="default"]'),
        ...pick("#controls [data-slot=toggle-group-item]"),
        ...pick("#controls [data-slot=radio-group] label"),
      ].map(measure),
      // Radios and switches are not listed: their labels are part of the target.
      other: pick("#controls button:not([role=radio]):not([role=switch]), #controls a").map(measure),
    };
  });
  expect(sizes.primary.length).toBeGreaterThan(6);
  for (const t of sizes.primary) expect(t.h, t.name).toBeGreaterThanOrEqual(44);
  for (const t of sizes.other) expect(Math.min(t.h, t.w), t.name).toBeGreaterThanOrEqual(24);
});
