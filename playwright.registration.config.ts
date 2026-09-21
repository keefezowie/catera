import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "registration.spec.ts",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3147",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -w @catera/web -- --port 3147",
    url: "http://127.0.0.1:3147/register",
    reuseExistingServer: !process.env.CI,
    env: {
      CATERA_V1_DEMO: "false",
      CATERA_NEXT_DIST_DIR: ".next-registration",
      CATERA_PUBLIC_URL: "http://127.0.0.1:3147",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54399",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-unused-key",
      CATERA_SESSION_SECRET: "local-synthetic-registration-test-secret-only",
    },
  },
});
