import { defineConfig } from "@playwright/test";
import base from "../playwright.config";
process.env.CATERA_OPS_TEST_URL ||= "http://127.0.0.1:3106";
process.env.CATERA_CALENDAR_EVIDENCE = "output/slack-bugs/0006/customer-calendar";
export default defineConfig({
  ...base,
  testDir: "./e2e",
  outputDir: "../output/slack-bugs/0006/test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "output/slack-bugs/0006/report" }]],
  testMatch: ["seller-operations.spec.ts", "calendar.spec.ts"],
  webServer: undefined,
  use: {
    ...base.use,
    baseURL: process.env.CATERA_OPS_TEST_URL || "http://127.0.0.1:3106",
  },
});
