import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: [
    "multi-cycle.spec.ts",
    "settlement-dashboard.spec.ts",
    "settlement-rollout.spec.ts",
  ],
  use: { ...base.use, baseURL: "http://127.0.0.1:3034" },
  webServer: [],
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "output/slack-bugs/0028-0034/report", open: "never" },
    ],
  ],
  outputDir: "output/slack-bugs/0028-0034/results",
});
