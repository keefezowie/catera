import { defineConfig } from "@playwright/test";
import base from "./playwright.contents.config";
export default defineConfig({
  ...base,
  testMatch: [
    "package-presentation.spec.ts",
    "contents.spec.ts",
    "dishes.spec.ts",
    "guest-auth.spec.ts",
    "journeys.spec.ts",
  ],
  outputDir: "output/package-presentation/test-results",
  use: { ...base.use, baseURL: "http://127.0.0.1:3120" },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3120",
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      PORT: "3120",
      CATERA_PUBLIC_URL: "http://127.0.0.1:3120",
      CATERA_NEXT_DIST_DIR: ".next-package-presentation",
      CATERA_DEMO_DATA_DIR: process.cwd() + "/.data/package-presentation-e2e",
      CATERA_V1_FIXTURES: "true",
    },
  },
});
