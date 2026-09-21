import path from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "direct-payments.spec.ts",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [["list"]],
  outputDir: "output/direct-payments/test-results",
  use: {
    baseURL: "http://127.0.0.1:3048",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port 3048",
    url: "http://127.0.0.1:3048",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      CATERA_V1_DEMO: "true",
      CATERA_DEMO_DATA_DIR: path.resolve(".data/direct-payments/browser-db"),
      CATERA_PUBLIC_URL: "http://127.0.0.1:3048",
    },
  },
});
