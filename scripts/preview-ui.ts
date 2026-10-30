/**
 * Opens the redesigned screens locally, signed in as the fictional Nadia
 * Chowdhury, with nothing to set up but Docker:
 *   docker start ourjob-pg
 *   pnpm preview:ui            (or pnpm preview:ui --port=3300)
 *
 * It seeds Nadia's fictional, confirmed profile in the local database, starts
 * `next dev` with a throwaway auth secret and the mock LLM, and opens a
 * browser window on /preview/today and /preview/tailor with a session cookie
 * minted the same way the e2e tests do. Google is never called, nothing in the
 * app is bypassed, and no real key is needed. Close the browser to stop.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { encode } from "next-auth/jwt";
import postgres from "postgres";
import { p1OutputSchema } from "../src/lib/llm/prompts/p1-profile";
import { normalizeProfile } from "../src/lib/profile/normalize";

/** --check: headless, load both pages, report and exit (for a quick test that the preview works). */
const check = process.argv.includes("--check");
const port = Number(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? 3200);
const base = `http://localhost:${port}`;
const DATABASE_URL = process.env.PREVIEW_DATABASE_URL ?? "postgres://ourjob:ourjob@localhost:5433/ourjob";
// Throwaway values for this local preview only.
const SECRET = "local-preview-secret-not-for-production-0123456789";
const NADIA = { id: "00000000-0000-4000-8000-000000000003", email: "confirmed@example.com", name: "Nadia Chowdhury" };
const COOKIE = "authjs.session-token";

async function seed() {
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {}, connect_timeout: 5 });
  try {
    await sql`select 1`;
  } catch {
    console.error(`Cannot reach Postgres at ${DATABASE_URL}. Start it with: docker start ourjob-pg`);
    process.exit(1);
  }
  try {
    await sql`delete from users where email = ${NADIA.email} and id <> ${NADIA.id}`;
    await sql`insert into users (id, email, name) values (${NADIA.id}, ${NADIA.email}, ${NADIA.name})
              on conflict (id) do update set email = excluded.email, name = excluded.name`;
    const [current] = await sql`select 1 from master_profiles where user_id = ${NADIA.id} and is_current`;
    if (!current) {
      const raw = JSON.parse(readFileSync("tests/fixtures/llm/p1-profile/nadia-chowdhury.json", "utf8")).output;
      const profile = normalizeProfile(p1OutputSchema.parse(raw));
      await sql`insert into master_profiles (user_id, version, data, is_current, confirmed_at, note)
                values (${NADIA.id}, 1, ${sql.json(profile)}, true, now(), 'Seeded for the local preview')`;
    }
  } finally {
    await sql.end();
  }
}

async function waitForServer() {
  for (let i = 0; i < 240; i++) {
    try {
      const res = await fetch(`${base}/sign-in`);
      if (res.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`next dev did not answer on ${base} within 2 minutes.`);
}

async function main() {
  await seed();
  console.log(`Starting next dev on ${base} ...`);
  const dev = spawn("pnpm", ["exec", "next", "dev", "--port", String(port)], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      AUTH_SECRET: SECRET,
      AUTH_GOOGLE_ID: "local-preview",
      AUTH_GOOGLE_SECRET: "local-preview",
      ALLOWED_EMAILS: NADIA.email,
      LLM_PROVIDER: "mock",
      DATABASE_URL,
    },
  });
  // next dev exits at once when it cannot start, for example when another dev
  // server already runs in this folder; it prints why, so stop waiting.
  let ready = false;
  dev.on("exit", (code) => {
    if (!ready) {
      console.error(`next dev stopped (exit ${code}). See its message above.`);
      process.exit(1);
    }
  });
  const stop = () => {
    if (process.platform === "win32" && dev.pid) spawn("taskkill", ["/pid", String(dev.pid), "/T", "/F"]);
    else dev.kill("SIGTERM");
  };
  process.on("SIGINT", () => {
    stop();
    process.exit(0);
  });

  await waitForServer();
  ready = true;
  const browser = await chromium.launch({ headless: check });
  const context = await browser.newContext({ viewport: null });
  const value = await encode({
    salt: COOKIE,
    secret: SECRET,
    token: { email: NADIA.email, name: NADIA.name, sub: "preview", uid: NADIA.id },
  });
  await context.addCookies([{ name: COOKIE, value, url: base, httpOnly: true, sameSite: "Lax" }]);
  const today = await context.newPage();
  await today.goto(`${base}/preview/today`);
  const tailor = await context.newPage();
  await tailor.goto(`${base}/preview/tailor`);
  if (check) {
    for (const page of [today, tailor]) {
      const h1 = await page.getByRole("heading", { level: 1 }).first().textContent({ timeout: 60_000 });
      console.log(`${page.url()}: ${h1}`);
    }
    await browser.close();
    stop();
    process.exit(0);
  }
  console.log(
    [
      "",
      "Signed in as the fictional Nadia Chowdhury. Try:",
      `  ${base}/preview/today       (?state=loading, empty, error or late)`,
      `  ${base}/preview/tailor      (?state=paste or working)`,
      "Phone layout: open DevTools and pick a phone in the device toolbar.",
      "Close the browser window to stop.",
    ].join("\n"),
  );
  browser.on("disconnected", () => {
    stop();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
