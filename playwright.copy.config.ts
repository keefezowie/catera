import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const baseURL = process.env.CATERA_COPY_URL || "http://127.0.0.1:3135";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL)) {
  throw new Error("Copy verification requires an isolated local instance.");
}
const phase = process.env.CATERA_COPY_PHASE || "after";
export default defineConfig({
  ...base,
  webServer: undefined,
  use: { ...base.use, baseURL },
  outputDir: `output/slack-bugs/0035/${phase}-results`,
  reporter: [
    ["list"],
    ["json", { outputFile: `output/slack-bugs/0035/${phase}.json` }],
  ],
});
