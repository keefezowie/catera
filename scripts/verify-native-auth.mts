import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
const { signInNative, nativeSignInPath } = createRequire(import.meta.url)(
  "../apps/customer/src/auth.ts",
) as typeof import("../apps/customer/src/auth");

const setup = JSON.parse(await fs.readFile(".data/demo-accounts.json", "utf8"));
assert.equal(setup.project, "ygzfdqrljunngfrdygzt");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key, "Publishable key required");
const evidence = [];
for (const account of setup.accounts) {
  // Exercises the same storage interface as SecureStore without storing tokens on disk.
  const saved = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => saved.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      saved.set(key, value);
    },
    removeItem: async (key: string) => {
      saved.delete(key);
    },
  };
  const options = {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const client = createClient(setup.url, key, options);
  const actor = await signInNative(
    client,
    account.email,
    account.password,
    crypto.randomUUID(),
  );
  assert.equal(actor.role, account.role);
  assert.equal(
    nativeSignInPath(actor),
    account.role === "customer" ? "/" : "/account",
  );
  const restored = createClient(setup.url, key, options);
  assert.equal(
    (await restored.auth.getSession()).data.session?.user.id,
    actor.id,
  );
  const checked = await restored.rpc("catera_v1_read", {
    resource: "actor",
    params: {},
  });
  assert.ifError(checked.error);
  assert.equal(checked.data.role, account.role);
  const admin = await restored.rpc("catera_v1_read", {
    resource: "admin",
    params: {},
  });
  assert.equal(!admin.error, account.role === "platform_admin");
  assert.ifError((await restored.auth.signOut({ scope: "local" })).error);
  assert.equal((await restored.auth.getSession()).data.session, null);
  evidence.push({
    role: account.role,
    nativeSignIn: true,
    persistedSessionRestored: true,
    databaseRoleVerified: true,
    adminBoundaryVerified: true,
    signOut: true,
  });
  console.log(
    account.role +
      ": native sign-in, restored session, role permissions and sign-out passed",
  );
}
await fs.mkdir("output/native-fixes-verification", { recursive: true });
await fs.writeFile(
  "output/native-fixes-verification/auth.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
