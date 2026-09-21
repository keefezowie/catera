import { mkdir, writeFile } from "node:fs/promises";
import { dokuToken } from "../packages/backend/src/doku.ts";
import { directMethodReady } from "../packages/backend/src/doku-direct.ts";
// Read-only: no payment, database mutation, dashboard change or flag activation.
if (process.env.DOKU_ENVIRONMENT !== "sandbox")
  throw new Error("DOKU_SANDBOX_REQUIRED");
const required = {
  VIRTUAL_ACCOUNT_BRI: [
    "DOKU_BRI_PARTNER_SERVICE_ID",
    "DOKU_BRI_CUSTOMER_PREFIX",
  ],
  QRIS: [
    "DOKU_QRIS_MERCHANT_ID",
    "DOKU_QRIS_TERMINAL_ID",
    "DOKU_QRIS_POSTAL_CODE",
  ],
};
let tokenAuthentication: string = "not requested";
if (process.argv.includes("--check-token")) {
  try {
    await dokuToken();
    tokenAuthentication = "passed";
  } catch (error) {
    tokenAuthentication =
      error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "failed";
  }
}
const report = {
  at: new Date().toISOString(),
  environment: "sandbox",
  tokenAuthentication,
  channels: Object.entries(required).map(([method, keys]) => ({
    method,
    ready: directMethodReady(method as keyof typeof required),
    missingConfiguration: keys.filter((k) => !process.env[k]),
    acceptance:
      "No genuine direct-channel callback or collection-routing evidence recorded by this read-only check",
  })),
};
await mkdir("output/direct-payments", { recursive: true });
await writeFile(
  "output/direct-payments/preflight.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
