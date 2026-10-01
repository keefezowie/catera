import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const baseURL = process.env.CATERA_UI_REFINEMENT_URL || "http://127.0.0.1:3241";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL)) {
  throw new Error("UI refinement requires an isolated loopback demo.");
}
const run = process.env.CATERA_UI_REFINEMENT_RUN || "workflows";
if (!/^[a-z0-9-]+$/.test(run))
  throw new Error("Use a simple verification run name.");
process.env.CATERA_OPS_TEST_URL = baseURL;
process.env.CATERA_CALENDAR_EVIDENCE =
  "output/playwright/ui-refinement-2026-09-30/calendar";

export default defineConfig({
  ...base,
  testMatch: [
    "ui-refinement*.spec.ts",
    "conditional-ui.spec.ts",
    "seller-workspace-ui.spec.ts",
    "seller-experience.spec.ts",
    "seller-operational-controls.spec.ts",
    "caterer-setup.spec.ts",
    "caterer-daily-simplification.spec.ts",
    "caterer-journeys.spec.ts",
    "caterer-journey-*.spec.ts",
    "polish-recovery.spec.ts",
    "polish-operational-focus.spec.ts",
    "impeccable-*.spec.ts",
    "slot-menus.spec.ts",
    "contents.spec.ts",
    "customer-choice.spec.ts",
    "beta-prepaid.spec.ts",
    "beta-attention.spec.ts",
    "beta-issues.spec.ts",
    "beta-payment.spec.ts",
    "settlement-dashboard.spec.ts",
    "settlement-rollout.spec.ts",
    "workspace-role.spec.ts",
    "navigation-controls.spec.ts",
    "guest-auth.spec.ts",
    "journeys.spec.ts",
    "multi-cycle.spec.ts",
    "direct-payments.spec.ts",
    "calendar.spec.ts",
    "package-presentation.spec.ts",
    "dishes.spec.ts",
    "paid-pilot.spec.ts",
    "sidebar-shell.spec.ts",
    "practical-copy.spec.ts",
    "featured-hero.spec.ts",
    "web-motion.spec.ts",
    "mascot.spec.ts",
    "ux-clarity.spec.ts",
    "uiux-research.spec.ts",
    "usability.spec.ts",
  ],
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  grepInvert:
    /staff invite copy, failed acceptance and durable role boundary|saved production and print preserve whole-day scope with an empty table filter/,
  webServer: undefined,
  outputDir: `output/playwright/ui-refinement-2026-09-30/${run}-results`,
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: `output/playwright/ui-refinement-2026-09-30/${run}.json` },
    ],
  ],
  use: { ...base.use, baseURL },
});
