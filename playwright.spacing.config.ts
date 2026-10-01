import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const baseURL = process.env.CATERA_SPACING_URL || "http://127.0.0.1:3261";
const run = process.env.CATERA_SPACING_RUN || "verification";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL))
  throw new Error("Spacing verification requires an isolated local demo.");
if (!/^[a-z0-9-]+$/.test(run)) throw new Error("Use a simple run name.");

export default defineConfig({
  ...base,
  testMatch: "spacing.spec.ts",
  webServer: undefined,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  use: { ...base.use, baseURL, reducedMotion: "reduce" },
  outputDir: `output/playwright/spacing/${run}-results`,
  reporter: [
    ["list"],
    ["json", { outputFile: `output/playwright/spacing/${run}.json` }],
  ],
});
