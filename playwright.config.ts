import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * E2E runs against a production build with a test secret and a fictional
 * allowlist. Google is never called: tests mint session cookies directly.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      AUTH_SECRET: "e2e-test-secret-not-for-production-0123456789",
      AUTH_GOOGLE_ID: "e2e-google-id",
      AUTH_GOOGLE_SECRET: "e2e-google-secret",
      ALLOWED_EMAILS: "allowed@example.com",
      ENABLE_DESIGN_TILE: "1",
      // Fixture answers for P1 and P5; the real model is never called in e2e.
      LLM_PROVIDER: "mock",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://ourjob:ourjob@localhost:5433/ourjob",
    },
  },
});
