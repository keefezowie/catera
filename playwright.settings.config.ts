import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const baseURL = process.env.CATERA_SETTINGS_URL || "http://127.0.0.1:3257";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL))
  throw new Error("Settings verification requires an isolated local demo.");
const run = process.env.CATERA_SETTINGS_RUN || "account";
if (!/^[a-z0-9-]+$/.test(run))
  throw new Error("Use a simple verification run name.");

export default defineConfig({
  ...base,
  webServer: undefined,
  use: { ...base.use, baseURL, reducedMotion: "reduce" },
  outputDir: `output/playwright/familiar-settings/${run}-results`,
  reporter: [
    ["list"],
    ["json", { outputFile: `output/playwright/familiar-settings/${run}.json` }],
  ],
});
