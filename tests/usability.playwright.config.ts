import { defineConfig } from "@playwright/test";
import base from "../playwright.config";
export default defineConfig({
  ...base,
  testDir: "./e2e",
  outputDir:
    "../output/usability-overhaul/" +
    (process.env.CATERA_EVIDENCE_RUN || "test-results"),
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder:
          "output/usability-overhaul/" +
          (process.env.CATERA_EVIDENCE_RUN || "report") +
          "-report",
      },
    ],
  ],
  webServer: undefined,
  use: {
    ...base.use,
    baseURL: process.env.CATERA_USABILITY_URL || "http://127.0.0.1:3118",
  },
});
