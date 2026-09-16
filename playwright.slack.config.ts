import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: [
    "seller-experience.spec.ts",
    "slot-menus.spec.ts",
    "conditional-ui.spec.ts",
    "settlement-dashboard.spec.ts",
    "customer-choice.spec.ts",
    "paid-pilot.spec.ts",
    "dishes.spec.ts",
  ],
  use: {
    ...base.use,
    baseURL: process.env.CATERA_TEST_URL || "http://127.0.0.1:3017",
  },
  webServer: [],
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "output/slack-bugs/0017-0027/report", open: "never" },
    ],
  ],
  outputDir: "output/slack-bugs/0017-0027/results",
});
