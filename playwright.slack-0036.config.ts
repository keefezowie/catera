import { defineConfig } from "@playwright/test";

const port = 3036;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "sidebar-shell.spec.ts",
  timeout: 120000,
  expect: { timeout: 20000 },
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  outputDir: "output/slack-bugs/0036/results",
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PORT: String(port),
      CATERA_PUBLIC_URL: baseURL,
      CATERA_V1_DEMO: "true",
      CATERA_NEXT_DIST_DIR: ".next-slack-0036",
      CATERA_DEMO_DATA_DIR: process.cwd() + "/.data/slack-0036-" + Date.now(),
    },
  },
});
