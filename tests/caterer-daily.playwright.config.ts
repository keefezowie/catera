import { defineConfig } from "@playwright/test";
import base from "../playwright.config";

export default defineConfig({
  ...base,
  testDir: "./e2e",
  testMatch: [
    "caterer-daily-simplification.spec.ts",
    "seller-operational-controls.spec.ts",
    "settlement-dashboard.spec.ts",
  ],
  outputDir: "../output/playwright/caterer-daily/results",
  reporter: [
    ["list"],
    [
      "html",
      { open: "never", outputFolder: "output/playwright/caterer-daily/report" },
    ],
  ],
  webServer: undefined,
  use: {
    ...base.use,
    baseURL: process.env.CATERA_DAILY_URL || "http://127.0.0.1:3217",
  },
});
