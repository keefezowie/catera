// Run with node --env-file=apps/web/.env.local; never logs credentials or customer details.
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const setup = JSON.parse(await readFile(".data/demo-accounts.json", "utf8"));
assert.equal(setup.project, "ygzfdqrljunngfrdygzt");
const results = [];
for (const account of setup.accounts) {
  const client = createClient(
    setup.url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  assert.ifError(
    (
      await client.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      })
    ).error,
  );
  const actor = await client.rpc("catera_v1_read", {
    resource: "actor",
    params: {},
  });
  assert.ifError(actor.error);
  assert.equal(actor.data.role, account.role);
  const admin = await client.rpc("catera_v1_read", {
    resource: "admin",
    params: {},
  });
  assert.equal(!admin.error, account.role === "platform_admin");
  if (account.role === "owner" || account.role === "staff") {
    const seller = await client.rpc("catera_v1_read", {
      resource: "seller",
      params: { id: actor.data.catererId },
    });
    assert.ifError(seller.error);
    assert.equal(seller.data.caterer.name, "Dapur Selaras");
    assert.equal(seller.data.offers.length, 3);
    if (account.role === "staff")
      assert.deepEqual(seller.data.transactions, []);
  }
  if (account.role === "customer") {
    const c = await client.rpc("catera_v1_read", {
      resource: "customer",
      params: { from: "2026-01-01", to: "2027-12-31" },
    });
    assert.ifError(c.error);
    assert(c.data.subscriptions.some((s) => s.status === "active"));
    assert(c.data.subscriptions.some((s) => s.status === "completed"));
  }
  await client.auth.signOut({ scope: "local" });
  results.push({
    role: account.role,
    login: true,
    reads: true,
    adminBoundary: true,
  });
}
await writeFile(
  "output/verification/clean-catalog-hosted.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
