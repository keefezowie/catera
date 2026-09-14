import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /customer-choice\.spec\.ts|slot-menus\.spec\.ts/,
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: "list",
  outputDir: "output/customer-choice/test-results",
  use: {
    baseURL: "http://127.0.0.1:3136",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3136",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PORT: "3136",
      CATERA_PUBLIC_URL: "http://127.0.0.1:3136",
      CATERA_V1_DEMO: "true",
      CATERA_NEXT_DIST_DIR: ".next-choice",
      CATERA_DEMO_DATA_DIR: process.cwd() + "/.data/choice-e2e-" + Date.now(),
    },
  },
});
