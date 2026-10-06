import { defineConfig } from "@playwright/test";

const baseURL = process.env.CATERA_DESKTOP_URL || "http://127.0.0.1:3147";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL))
  throw new Error("Desktop UX checks require a local synthetic demo.");

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: [
    "v1-desktop-ux.spec.ts",
    "v1-landscape.spec.ts",
    "conditional-ui.spec.ts",
  ],
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  outputDir: "work/desktop-optimization/test-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "work/desktop-optimization/browser.json" }],
  ],
  use: {
    baseURL,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { executablePath: "/usr/bin/chromium" },
  },
});
