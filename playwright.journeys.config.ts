import { defineConfig } from "@playwright/test";
const baseURL = process.env.CATERA_JOURNEYS_URL || "http://127.0.0.1:3131";
if (new URL(baseURL).hostname !== "127.0.0.1")
  throw new Error("Journey mutations require an isolated loopback demo");
const run = (process.env.CATERA_JOURNEYS_RUN || "main").replace(
  /[^a-zA-Z0-9_-]/g,
  "",
);
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  expect: { timeout: 20000 },
  workers: 1,
  fullyParallel: false,
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: `output/playwright/journeys-report-${run}`,
      },
    ],
  ],
  outputDir: `output/playwright/journeys-results-${run}`,
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
