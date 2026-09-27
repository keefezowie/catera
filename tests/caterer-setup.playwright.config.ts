import { defineConfig } from "@playwright/test";
import base from "../playwright.config";

/** Run only against an explicitly started, isolated synthetic server. */
export default defineConfig({
  ...base,
  testDir: "./e2e",
  testMatch: "caterer-setup.spec.ts",
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  outputDir: "../output/playwright/caterer-setup/results",
  reporter: [
    ["list"],
    [
      "html",
      { open: "never", outputFolder: "output/playwright/caterer-setup/report" },
    ],
  ],
  webServer: undefined,
  use: {
    ...base.use,
    baseURL: process.env.CATERA_SETUP_URL || "http://127.0.0.1:3217",
  },
});
