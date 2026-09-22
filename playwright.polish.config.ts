import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Start an explicit, disposable synthetic instance before running this suite.
// No default server is started: these mutation tests must never use hosted data.
const baseURL = process.env.CATERA_POLISH_URL || "http://127.0.0.1:3130";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL)) {
  throw new Error("Polish verification requires a local synthetic instance.");
}
const run = process.env.CATERA_EVIDENCE_RUN || "verification";

export default defineConfig({
  ...base,
  webServer: undefined,
  use: { ...base.use, baseURL },
  outputDir: `output/polish-v1/${run}-results`,
  reporter: [
    ["list"],
    ["json", { outputFile: `output/polish-v1/${run}.json` }],
    ["html", { outputFolder: `output/polish-v1/${run}-report`, open: "never" }],
  ],
});
