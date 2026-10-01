import { defineConfig } from "@playwright/test";

// The separately started server uses unused loopback Auth configuration.
// Email/OTP responses are intercepted by this suite; it never sends messages.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "registration.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  webServer: undefined,
  outputDir: "output/playwright/ui-refinement-2026-09-30/auth-results",
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "output/playwright/ui-refinement-2026-09-30/auth.json" },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:3242",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
