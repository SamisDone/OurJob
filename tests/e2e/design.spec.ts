import { expect, test, type Page } from "@playwright/test";

/** Checks from the onboarding and style tile review that can be measured. */

async function openDesk(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/design");
  await page.evaluate(() => document.fonts.ready);
}

test("pen circles never touch the words or punctuation next to them", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await openDesk(page, 1440);
  const gaps = await page.evaluate(() => {
    const out: { word: string; left: number; right: number }[] = [];
    for (const circle of document.querySelectorAll<HTMLElement>("#reading .pen-circle")) {
      const box = circle.getBoundingClientRect();
      const mark = circle.closest("mark")!;
      const rectOf = (node: Node | null, fromEnd: boolean) => {
        if (!node || node.nodeType !== Node.TEXT_NODE || !node.textContent) return null;
        const r = document.createRange();
        const len = node.textContent.length;
        r.setStart(node, fromEnd ? len - 1 : 0);
        r.setEnd(node, fromEnd ? len : 1);
        const rect = r.getBoundingClientRect();
        // Only compare with characters on the same line.
        return Math.abs(rect.top - box.top) < box.height ? rect : null;
      };
      const before = rectOf(mark.previousSibling, true);
      const after = rectOf(mark.nextSibling, false);
      out.push({
        word: circle.textContent ?? "",
        left: before ? box.left - before.right : 99,
        right: after ? after.left - box.right : 99,
      });
    }
    return out;
  });
  expect(gaps.length).toBeGreaterThan(5);
  for (const g of gaps) {
    expect(g.left, `space before "${g.word}"`).toBeGreaterThanOrEqual(2);
    expect(g.right, `space after "${g.word}"`).toBeGreaterThanOrEqual(2);
  }
});

for (const width of [1440, 1100, 390]) {
  test(`CV text is never smaller than 9 px at ${width} px`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await openDesk(page, width);
    if (width < 768) await page.locator("#desk").getByRole("radio", { name: "CV" }).click();
    const sheet = page.locator("#desk .cv-sheet").first();
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
  });
}

test("tailoring desk has three columns at 1440, two at 1100 and panes on phones", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  const columns = () =>
    page.evaluate(() => {
      const grid = document.querySelector("#desk .grid")!;
      return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    });
  // No column may stick out past the grid.
  const overflow = () =>
    page.evaluate(() => {
      const grid = document.querySelector("#desk .grid")!.getBoundingClientRect();
      const right = Math.max(...[...document.querySelectorAll("#desk .grid > *")].map((c) => c.getBoundingClientRect().right));
      return Math.round(right - grid.right);
    });
  await openDesk(page, 1440);
  expect(await columns()).toBe(3);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await openDesk(page, 1100);
  expect(await columns()).toBe(2);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await openDesk(page, 390);
  await expect(page.locator("#desk").getByRole("radio", { name: "Score" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open in Overleaf" }).last()).toBeInViewport();
});

test("phone tap targets are at least 44 px tall", async ({ page }, info) => {
  test.skip(info.project.name !== "phone");
  await page.goto("/design");
  const heights = await page.evaluate(() => {
    const pick = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].filter((e) => e.offsetParent);
    const targets = [
      ...pick("#today [role=group] button"),
      ...pick("#controls [role=radio]"),
      ...pick("#controls button[aria-label^='Remove']"),
      ...pick("#tracker button[aria-label^='Move']"),
      ...pick("#tracker a"),
    ];
    return targets.map((e) => ({ name: e.getAttribute("aria-label") ?? e.textContent?.trim() ?? "", h: e.getBoundingClientRect().height }));
  });
  expect(heights.length).toBeGreaterThan(8);
  for (const t of heights) expect(t.h, t.name).toBeGreaterThanOrEqual(44);
});
