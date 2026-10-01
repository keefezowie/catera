import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
export async function verifySavedPackages(
  pool,
  cmd,
  evidence,
  packageId,
  users,
) {
  await pool.query(
    await readFile(
      "supabase/migrations/20261001180039_saved_packages.sql",
      "utf8",
    ),
  );
  async function read(user, params = {}) {
    const client = await pool.connect();
    try {
      await client.query("begin;set local role authenticated");
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user || "",
      ]);
      return (
        await client.query(
          "select public.catera_v1_read('saved-packages',$1) value",
          [params],
        )
      ).rows[0].value;
    } finally {
      await client.query("rollback");
      client.release();
    }
  }
  const effects = async () =>
    (
      await pool.query(
        "select (select count(*) from v1.checkouts) checkouts,(select count(*) from v1.reservations) reservations,(select count(*) from v1.subscriptions) subscriptions",
      )
    ).rows[0];
  const before = await effects(),
    key = crypto.randomUUID(),
    payload = { packageId, saved: true };
  const race = await Promise.all(
    Array.from({ length: 8 }, () =>
      cmd("savedPackage.set", payload, users[0], key),
    ),
  );
  assert(
    race.every((result) => result.saved && result.packageId === packageId),
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.saved_packages where user_id=$1 and package_id=$2",
        [users[0], packageId],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.receipts where actor_id=$1 and request_id=$2",
        [users[0], key],
      )
    ).rows[0].n,
    1,
  );
  const savedAt = (await read(users[0])).items[0].savedAt;
  await Promise.all(
    Array.from({ length: 8 }, () => cmd("savedPackage.set", payload, users[0])),
  );
  assert.equal((await read(users[0])).items[0].savedAt, savedAt);
  await assert.rejects(
    cmd("savedPackage.set", { packageId, saved: false }, users[0], key),
    /CONFLICT/,
  );
  assert.deepEqual((await read(users[1])).packageIds, []);
  await assert.rejects(read(users[1], { userId: users[0] }), /INVALID_INPUT/);
  await assert.rejects(
    cmd("savedPackage.set", { ...payload, userId: users[0] }, users[1]),
    /INVALID_INPUT/,
  );
  await assert.rejects(read(null), /UNAUTHORIZED/);
  const access = (
    await pool.query(
      "select has_table_privilege('authenticated','v1.saved_packages','select') reads,has_table_privilege('authenticated','v1.saved_packages','insert,update,delete') writes,has_function_privilege('authenticated','public.catera_v1_command_saved_base(text,jsonb,uuid)','execute') base",
    )
  ).rows[0];
  assert.deepEqual(access, { reads: false, writes: false, base: false });
  await cmd("savedPackage.set", payload, users[1]);
  await cmd("savedPackage.set", { packageId, saved: false }, users[0]);
  assert.deepEqual((await read(users[0])).packageIds, []);
  assert.deepEqual((await read(users[1])).packageIds, [packageId]);
  assert.deepEqual(await effects(), before);
  evidence.push(
    "Saved packages: eight simultaneous receipt retries and duplicate saves yield one owner row; authenticated RPCs enforce ownership, private tables reject direct reads/writes, another user's removal cannot affect the owner, and no purchasing or capacity effects occur.",
  );
}
