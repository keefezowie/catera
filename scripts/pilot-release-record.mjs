// Read-only deployment evidence. Load protected environment through your shell.
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key || url.includes("otmanljypltxkwjcebni"))
  throw new Error("Use a configured, separate Catera V1 environment");
const client = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await client.rpc("catera_v1_system", {
  action: "pilot.releaseRecord",
  payload: {},
});
if (error) throw new Error(error.message);
const migration = "supabase/migrations/20260914160856_paid_seller_pilot.sql";
const evidence = {
  at: new Date().toISOString(),
  application: {
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    dirty: !!execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }).trim(),
    deployment: process.env.VERCEL_URL || null,
  },
  databaseHost: new URL(url).hostname,
  migrationSha256: createHash("sha256")
    .update(await readFile(migration))
    .digest("hex"),
  ...data,
};
await mkdir("output/verification", { recursive: true });
await writeFile(
  "output/verification/paid-pilot-release.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(
  "Recorded application, database capabilities, scheduler health and approval flags; no credentials recorded.",
);
