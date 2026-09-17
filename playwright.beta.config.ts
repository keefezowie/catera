import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: ["beta-*.spec.ts"],
  use: { ...base.use, baseURL: "http://127.0.0.1:3027" },
  webServer: [],
  reporter: [["list"], ["html", { outputFolder: "output/beta-improvement/report", open: "never" }]],
  outputDir: "output/beta-improvement/results",
});
