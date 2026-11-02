import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { SHELL_USERS, signInAs } from "./helpers";

/**
 * Today on stored data: one fictional company, one fresh job matched to the
 * fictional Nadia Chowdhury, and a finished run, as the daily pipeline writes
 * them. global-setup.ts removes these rows before each suite.
 * SHOTS_DIR=<folder> also saves the screen at each width in light and dark.
 */
const url = process.env.DATABASE_URL ?? "postgres://ourjob:ourjob@localhost:5433/ourjob";
const COMPANY = "00000000-0000-4000-8000-0000000000c1";
const JOB = "00000000-0000-4000-8000-0000000000a1";
const RUN = "00000000-0000-4000-8000-0000000000b1";

test.beforeAll(async () => {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`insert into companies (id, name, normalized_name, website, ats_type, ats_slug, ats_verified, discovered_via)
              values (${COMPANY}, 'Lumen Labs', 'e2e lumen labs', 'https://lumenlabs.example', 'ashby', 'e2e-lumen', true, 'seed')
              on conflict do nothing`;
    await sql`insert into jobs (id, company_id, source, tier, source_job_id, title, normalized_title, description_text,
                apply_url, canonical_url, location_raw, workplace, remote_scope, salary, posted_at, posted_at_source, content_hash)
              values (${JOB}, ${COMPANY}, 'ashby', 1, 'e2e-1', 'Senior Backend Engineer', 'senior backend engineer',
                'Lumen Labs builds booking software. You will write Go services on PostgreSQL and Kafka. Work from anywhere.',
                'https://jobs.ashbyhq.com/e2e-lumen/e2e-1', 'https://jobs.ashbyhq.com/e2e-lumen/e2e-1', 'Remote (Worldwide)', 'remote',
                ${sql.json({ kind: "worldwide", confidence: "structured" })},
                ${sql.json({ min: 95000, max: 130000, currency: "USD", period: "year", annualUsdMin: 95000, annualUsdMax: 130000, source: "parsed_text" })},
                now() - interval '1 day', 'source_field', 'e2e')
              on conflict do nothing`;
    await sql`insert into job_matches (user_id, job_id, prefilter_score, fit_score, fit_reasons, gaps, eligibility, scored_at)
              values (${SHELL_USERS.confirmed.id}, ${JOB}, 0.9, 88,
                ${sql.json(["Go and PostgreSQL services match your Ledgerly work."])}, ${sql.json(["Terraform"])}, 'eligible', now())
              on conflict do nothing`;
    await sql`insert into pipeline_runs (id, started_at, finished_at, trigger, status, stats)
              values (${RUN}, now() - interval '2 hours', now() - interval '2 hours', 'manual', 'succeeded',
                ${sql.json({ sources: {}, companiesCrawled: 130, jobsScored: 1, llmCalls: 1, e2e: true })})
              on conflict do nothing`;
  } finally {
    await sql.end();
  }
});

test("Today lists the stored job; its sheet saves it and opens the tailor page with the post filled in", async ({
  page,
  context,
  baseURL,
}, info) => {
  const user = SHELL_USERS.confirmed;
  await signInAs(context, baseURL!, user.email, user.name, user.id);
  await page.goto("/today");
  await expect(page.getByText(/Last search at .*, 130 companies checked/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Run search now" })).toHaveCount(0);
  const row = page.getByText("Senior Backend Engineer").first();
  await expect(row).toBeVisible();
  await expect(page.getByText("Lumen Labs").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await row.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Go and PostgreSQL services match your Ledgerly work.")).toBeVisible();
  await expect(sheet.getByText("Terraform")).toBeVisible();

  // The star is stored once (desktop only, so the two projects do not race over one row).
  if (info.project.name === "desktop") {
    const stored = page.waitForResponse((r) => r.url().includes("/save") && r.ok());
    await sheet.getByRole("button", { name: "Save job" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await stored;
    await page.reload();
    await expect(page.getByRole("radio", { name: /Saved\s*1/ })).toBeVisible();
    await page.getByText("Senior Backend Engineer").first().click();
  }

  await page.getByRole("dialog").getByRole("link", { name: "Tailor my CV" }).click();
  await expect(page).toHaveURL(/\/tailor\?job=/);
  await expect(page.getByLabel("Job post")).toHaveValue(/Senior Backend Engineer\nLumen Labs/);
});

const dir = process.env.SHOTS_DIR;
for (const theme of ["light", "dark"] as const) {
  test(`Today screenshot in ${theme}`, async ({ browser, baseURL }, info) => {
    test.skip(!dir, "Set SHOTS_DIR to take screenshots.");
    const phone = info.project.name === "phone";
    const context = await browser.newContext({ ...info.project.use, colorScheme: theme });
    const user = SHELL_USERS.confirmed;
    await signInAs(context, baseURL!, user.email, user.name, user.id);
    const page = await context.newPage();
    await page.goto("/today");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${dir}/today-${phone ? 390 : 1440}-${theme}.png`, fullPage: true });
    await page.getByText("Senior Backend Engineer").first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/today-sheet-${phone ? 390 : 1440}-${theme}.png` });
  });
}
