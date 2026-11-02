import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { SHELL_USERS, signInAs } from "./helpers";

/**
 * Paste a job post, watch the three steps, get the saved result. The mock
 * model answers from tests/fixtures/llm/p2-job and p3-tailor (the fictional
 * Lumen Labs post and Nadia Chowdhury), each after LLM_MOCK_DELAY_MS.
 */
const JD = readFileSync("tests/fixtures/jds/01-lumen-backend.txt", "utf8");

test("tailoring shows the three steps and opens the saved result", async ({ page, context, baseURL }) => {
  test.setTimeout(90_000);
  const user = SHELL_USERS.confirmed;
  await signInAs(context, baseURL!, user.email, user.name, user.id);
  await page.goto("/tailor");

  await page.getByLabel("Job post").fill(JD);
  await page.getByRole("button", { name: "Tailor my CV" }).click();

  const steps = page.getByRole("listitem");
  await expect(steps.filter({ hasText: "Reading the job, in progress" })).toBeVisible();
  await expect(steps.filter({ hasText: "Tailoring your CV, in progress" })).toBeVisible();
  await expect(steps.filter({ hasText: "Reading the job, done" })).toBeVisible();
  await expect(steps.filter({ hasText: "Checking every fact against your profile" })).toBeVisible();

  await expect(page).toHaveURL(/\/tailor\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByText("Senior Backend Engineer").first()).toBeVisible();
  await expect(page.getByText("Estimated ATS match")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open in Overleaf" }).first()).toBeVisible();
  // The CV may scroll inside its frame on phones; the page itself never scrolls sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  // It is saved: the tailor page lists it under Recent.
  await page.goto("/tailor");
  await expect(page.getByRole("heading", { name: "Recent" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Senior Backend Engineer at Lumen Labs/ }).first()).toBeVisible();
});

test("the tailoring stream reports reading, tailoring and checking, then the saved id", async ({
  context,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "Same API on every device.");
  test.setTimeout(60_000);
  const user = SHELL_USERS.confirmed;
  await signInAs(context, baseURL!, user.email, user.name, user.id);
  // Playwright cannot read a streamed body in the browser; the request API gets all of it.
  const res = await context.request.post("/api/tailor", { data: { jd: JD } });
  expect(res.ok()).toBe(true);
  const events = (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { type: string; stage?: string; id?: string });
  expect(events.filter((e) => e.type === "stage").map((e) => e.stage)).toEqual(["reading", "tailoring", "checking"]);
  expect(events.at(-1)).toMatchObject({ type: "done", id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
});

test("tailoring never spins forever: a silent server or a closed stream ends in an error with Try again", async ({
  page,
  context,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "Same screen on phones; this checks timing.");
  const user = SHELL_USERS.confirmed;
  await signInAs(context, baseURL!, user.email, user.name, user.id);
  await page.clock.install();

  // 1. The server never answers (a killed function, a hung model request).
  await page.route("**/api/tailor", () => new Promise(() => {}));
  await page.goto("/tailor");
  await page.getByLabel("Job post").fill(JD);
  await page.getByRole("button", { name: "Tailor my CV" }).click();
  await expect(page.getByText("Reading the job, in progress")).toBeVisible();
  await page.clock.fastForward(101_000);
  const alert = page.getByRole("alert").filter({ hasText: "The CV was not tailored." });
  await expect(alert).toContainText("took too long and was stopped");
  await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  // The post he pasted is still there.
  await expect(page.getByLabel("Job post")).toHaveValue(JD);

  // 2. The stream closes after a step, with no result and no error line.
  await page.unroute("**/api/tailor");
  await page.route("**/api/tailor", (route) =>
    route.fulfill({ status: 200, contentType: "application/x-ndjson", body: '{"type":"stage","stage":"reading"}\n' }),
  );
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The CV was not tailored." })).toContainText(
    "connection closed before the CV was ready",
  );
});
