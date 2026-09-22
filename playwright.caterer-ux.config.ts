import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
const baseURL = process.env.CATERA_CATERER_UX_URL || "http://127.0.0.1:3138";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL)) {
  throw new Error("Caterer UX verification requires a local synthetic instance.");
}
export default defineConfig({
  ...base,
  testMatch: [
    "caterer-ux.spec.ts",
    "beta-attention.spec.ts",
    "seller-operational-controls.spec.ts",
  ],
  use: { ...base.use, baseURL },
  webServer: [],
  reporter: [["list"]],
  outputDir: "output/playwright/caterer-ux/results",
});
