import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const baseURL = process.env.CATERA_LAYOUT_URL || "http://127.0.0.1:3157";
const run = process.env.CATERA_LAYOUT_RUN || "verification";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL))
  throw new Error("Layout verification requires an isolated local demo.");
if (!/^[a-z0-9-]+$/.test(run)) throw new Error("Use a simple run name.");

export default defineConfig({
  ...base,
  testMatch: "impeccable-layout*.spec.ts",
  webServer: undefined,
  retries: 0,
  use: { ...base.use, baseURL, reducedMotion: "reduce" },
  outputDir: `output/playwright/impeccable-second/regression/${run}-results`,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: `output/playwright/impeccable-second/regression/${run}.json`,
      },
    ],
  ],
});
