import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "contents.spec.ts",
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: "list",
  outputDir: "output/package-contents/test-results",
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    env: {
      PORT: "3100",
      CATERA_PUBLIC_URL: "http://127.0.0.1:3100",
      CATERA_NEXT_DIST_DIR: ".next-contents",
      CATERA_DEMO_DATA_DIR: process.cwd() + "/.data/contents-e2e",
      CATERA_V1_FIXTURES: "true",
    },
    timeout: 120000,
  },
});
