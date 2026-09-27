import { defineConfig } from "@playwright/test";
import base from "./caterer-setup.playwright.config";

/** Existing package and dialog regressions on the already-running isolated demo. */
export default defineConfig({
  ...base,
  testMatch: [
    "customer-choice.spec.ts",
    "contents.spec.ts",
    "conditional-ui.spec.ts",
  ],
  grep: /customer-choice\.spec\.ts|contents\.spec\.ts|confirmation hierarchy|optional nutrition|nested photo preview|short viewport keeps confirmation/,
  outputDir: "../output/playwright/caterer-setup-regression/results",
  reporter: [["list"]],
  webServer: undefined,
  use: { ...base.use, baseURL: "http://127.0.0.1:3217" },
});
