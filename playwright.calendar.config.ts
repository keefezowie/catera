import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["calendar.spec.ts", "journeys.spec.ts"],
  timeout: 90000,
  expect: { timeout: 20000 },
  workers: 1,
  reporter: "list",
  outputDir: "output/meal-calendar/test-results",
  use: {
    baseURL: "http://127.0.0.1:3112",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3112",
    reuseExistingServer: true,
    env: {
      PORT: "3112",
      CATERA_PUBLIC_URL: "http://127.0.0.1:3112",
      CATERA_NEXT_DIST_DIR: ".next-meal-calendar",
      CATERA_DEMO_DATA_DIR: process.cwd() + "/.data/calendar-e2e",
    },
    timeout: 120000,
  },
});
