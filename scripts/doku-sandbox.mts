// Explicit staging-only setup. Load ignored apps/web/.env.local via Node --env-file.
import { dokuConfig, dokuSnap } from "../packages/backend/src/doku.ts";
import { rpc } from "../packages/backend/src/database.ts";
const system = <T = unknown,>(action: string, payload: unknown = {}) =>
  rpc<T>(null, null, "catera_v1_system", { action, payload }, true);
const command = process.argv[2] || "check";
if (process.env.CATERA_V1_DEMO === "true")
  throw new Error(
    "Use a separate hosted staging database, not synthetic payment confirmation",
  );
if (process.env.CATERA_DOKU_STAGING !== "true")
  throw new Error(
    "Set CATERA_DOKU_STAGING=true only for the dedicated sandbox database",
  );
const config = dokuConfig();
if (command === "check") {
  console.log(
    JSON.stringify(
      {
        environment: "sandbox",
        clientConfigured: !!config.client,
        secretConfigured: !!config.secret,
        snapKeyConfigured: !!process.env.DOKU_PRIVATE_KEY,
        collectionProfileConfigured: !!process.env.DOKU_COLLECTION_PROFILE_ID,
        collectionEnabled: process.env.DOKU_COLLECTION_ENABLED === "true",
        payoutEnabled: process.env.DOKU_PAYOUTS_ENABLED === "true",
        refunds: "blocked: activated Refund Service contract required",
        database: await system("provider.config"),
      },
      null,
      2,
    ),
  );
} else if (command === "select" || command === "rollback") {
  const reason = process.argv.slice(3).join(" ");
  if (reason.length < 5) throw new Error("Supply an audit reason");
  console.log(
    await system("provider.configure", {
      provider: command === "select" ? "doku" : "xendit",
      environment: command === "select" ? "sandbox" : "legacy",
      merchant: command === "select" ? config.client : "",
      reason,
    }),
  );
} else if (command === "balance") {
  const data = await dokuSnap(
    "/sub-account/v2.0/balance-inquiries",
    { profileId: process.env.DOKU_COLLECTION_PROFILE_ID },
    await system<string>("provider.externalId"),
  );
  console.log(
    JSON.stringify(
      {
        responseCode: data.responseCode,
        accounts: data.accounts?.map((a: Record<string, unknown>) => ({
          type: a.type,
          currency: a.currency,
          balance: a.balance,
        })),
      },
      null,
      2,
    ),
  );
} else
  throw new Error("Use check, select <reason>, rollback <reason>, or balance");
