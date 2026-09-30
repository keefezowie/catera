import { defineConfig } from "@playwright/test";
import base from "../playwright.config";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const evidence = fileURLToPath(
  new URL("../output/playwright/ux-clarity", import.meta.url),
);

export default defineConfig({
  ...base,
  testDir: "./e2e",
  testMatch: [
    "ux-clarity*.spec.ts",
    "impeccable-journeys.spec.ts",
    "uiux-research.spec.ts",
    "caterer-daily-simplification.spec.ts",
  ],
  outputDir: join(evidence, "test-results"),
  reporter: [
    ["list"],
    ["json", { outputFile: join(evidence, "results.json") }],
    ["html", { open: "never", outputFolder: join(evidence, "report") }],
  ],
  webServer: undefined,
  use: {
    ...base.use,
    baseURL: process.env.CATERA_UX_URL || "http://127.0.0.1:3231",
    reducedMotion: "reduce",
  },
});
