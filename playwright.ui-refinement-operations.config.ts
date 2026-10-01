import { defineConfig } from "@playwright/test";
import base from "./playwright.ui-refinement.config";

// This fixture deliberately accepts a staff invitation and changes its
// customer's role. Keep it separate from the general journey database.
const baseURL = "http://127.0.0.1:3243";
const run = process.env.CATERA_UI_REFINEMENT_RUN || "operations";
process.env.CATERA_OPS_TEST_URL = baseURL;

export default defineConfig({
  ...base,
  testMatch: ["seller-operations.spec.ts", "caterer-journey-handoffs.spec.ts"],
  grepInvert: undefined,
  outputDir: `output/playwright/ui-refinement-2026-09-30/${run}-results`,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: `output/playwright/ui-refinement-2026-09-30/${run}.json`,
      },
    ],
  ],
  use: { ...base.use, baseURL },
});
