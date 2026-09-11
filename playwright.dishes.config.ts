import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["dishes.spec.ts", "contents.spec.ts"],
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: "list",
  outputDir: "output/reusable-dishes/test-results",
  use: {
    baseURL: "http://127.0.0.1:3102",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3102",
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      PORT: "3102",
      CATERA_PUBLIC_URL: "http://127.0.0.1:3102",
      CATERA_NEXT_DIST_DIR: ".next-dishes",
      CATERA_DEMO_DATA_DIR: process.cwd() + "/.data/dishes-final",
      CATERA_V1_FIXTURES: "true",
    },
  },
});
