import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const baseURL = process.env.CATERA_UIUX_URL || "http://127.0.0.1:3147";
const run = process.env.CATERA_UIUX_RUN || "states";
if (!/^[a-z0-9-]+$/.test(run))
  throw new Error("Use a simple verification run name.");
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL)) {
  throw new Error("UI/UX verification requires an isolated local demo.");
}
export default defineConfig({
  ...base,
  webServer: undefined,
  use: { ...base.use, baseURL },
  outputDir: `output/playwright/impeccable/${run}-results`,
  reporter: [
    ["list"],
    ["json", { outputFile: `output/playwright/impeccable/${run}.json` }],
  ],
});
