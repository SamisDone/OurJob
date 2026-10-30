import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// E2E_LLM_PROVIDER=gemini runs the suite against the real model once (keys from .env.local).
const realLlm = process.env.E2E_LLM_PROVIDER === "gemini";
if (realLlm) loadEnv({ path: ".env.local", quiet: true });

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
  // One production server serves every worker; past 4 it slows enough that desktop tests time out.
  workers: 4,
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
      ALLOWED_EMAILS: "allowed@example.com,fresh@example.com,confirmed@example.com",
      ENABLE_DESIGN_TILE: "1",
      // Fixture answers for P1 and P5; the real model is never called in e2e.
      LLM_PROVIDER: realLlm ? "gemini" : "mock",
      // Long enough to see each tailoring step on screen.
      LLM_MOCK_DELAY_MS: realLlm ? "0" : "1500",
      ...(realLlm
        ? {
            GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
            LLM_MODEL: process.env.LLM_MODEL ?? "gemini-3.5-flash-lite",
            LLM_FALLBACK_MODEL: process.env.LLM_FALLBACK_MODEL ?? "gemini-3.8-flash",
          }
        : {}),
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://ourjob:ourjob@localhost:5433/ourjob",
    },
  },
});
