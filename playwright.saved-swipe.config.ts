import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "saved-swipe.spec.ts",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: "output/saved-swipe/playwright",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3268",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  webServer: {
    command: "npm run dev -w @catera/web -- --port 3268",
    url: "http://127.0.0.1:3268",
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      CATERA_V1_DEMO: "true",
      CATERA_V1_FIXTURES: "true",
      CATERA_DEMO_DATA_DIR: ".data/saved-swipe",
      CATERA_NEXT_DIST_DIR: ".next-saved-swipe",
      CATERA_PUBLIC_URL: "http://127.0.0.1:3268",
    },
  },
});
