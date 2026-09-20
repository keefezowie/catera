import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["doku-sandbox.spec.ts", "beta-payment.spec.ts"],
  workers: 1,
  timeout: 60000,
  expect: { timeout: 20000 },
  use: {
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
    baseURL: "http://127.0.0.1:3039",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/doku/browser-report", open: "never" }],
  ],
  outputDir: "output/doku/browser-results",
  webServer: [],
});
