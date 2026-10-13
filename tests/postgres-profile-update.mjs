import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Phase G, FB5 (Data akun): profile.update renames only the caller's row, and a deletion request
// is created once per open request, also when two phones ask at the same moment.
export async function verifyProfileUpdate(pool, cmd, evidence) {
  await pool.query(await readFile("supabase/migrations/20261014100000_profile_update.sql", "utf8"));
  const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
  for (const [id, name] of [[a, "Awal A"], [b, "Awal B"]])
    await pool.query("insert into v1.profiles(id,name) values($1,$2)", [id, name]);
  const nameOf = async (id) => (await pool.query("select name from v1.profiles where id=$1", [id])).rows[0].name;

  const race = await Promise.all([
    cmd("profile.update", { name: "  Sari Dewi  " }, a),
    cmd("profile.update", { name: "Budi Santoso" }, b),
    cmd("profile.update", { name: "Sari Wulan" }, a),
  ]);
  assert.equal(race[1].name, "Budi Santoso");
  assert.equal(await nameOf(b), "Budi Santoso");
  assert.ok(["Sari Dewi", "Sari Wulan"].includes(await nameOf(a)));
  assert.equal(race[0].name, "Sari Dewi");
  for (const bad of [{ name: "" }, { name: " x " }, { name: "n".repeat(81) }, { name: 7 }, { name: "Ok", id: b }, {}])
    await assert.rejects(cmd("profile.update", bad, a), /INVALID_INPUT/);
  assert.equal((await cmd("profile.update", { name: String.fromCharCode(0xa0) + "\tSari Dewi" + String.fromCharCode(0x3000) }, a)).name, "Sari Dewi");
  await assert.rejects(cmd("profile.update", { name: "Tanpa Masuk" }, null), /UNAUTHORIZED/);
  assert.equal(await nameOf(b), "Budi Santoso");

  const bAsk = crypto.randomUUID();
  const asks = await Promise.all([
    cmd("accountRequest.create", { kind: "deletion", body: "Tolong hapus akun saya." }, a),
    cmd("accountRequest.create", { kind: "deletion", body: "Tolong hapus akun saya." }, a),
    cmd("accountRequest.create", { kind: "deletion", body: "Hapus akun saya." }, b, bAsk),
  ]);
  assert.equal(asks[0].id, asks[1].id);
  assert.equal(asks.slice(0, 2).filter((x) => x.existing).length, 1);
  assert.equal((await pool.query("select count(*)::int n from v1.account_requests where user_id=$1 and kind='deletion' and status='open'", [a])).rows[0].n, 1);
  assert.equal((await pool.query("select count(*)::int n from v1.account_requests where user_id=$1 and kind='deletion'", [b])).rows[0].n, 1);
  const replays = await Promise.all([0, 1].map(() => cmd("accountRequest.create", { kind: "deletion", body: "Hapus akun saya." }, b, bAsk)));
  for (const replay of replays) assert.deepEqual(replay, { id: asks[2].id, status: "open" });
  const help = await cmd("accountRequest.create", { kind: "help", body: "Ubah nomor WhatsApp dapur." }, a);
  assert.equal(help.status, "open");
  await pool.query("update v1.account_requests set status='resolved',resolution='selesai' where user_id=$1 and kind='deletion'", [a]);
  const again = await cmd("accountRequest.create", { kind: "deletion", body: "Hapus akun saya lagi." }, a);
  assert.notEqual(again.id, asks[0].id);
  assert.equal((await pool.query("select has_function_privilege('authenticated','public.catera_v1_command_profile_base(text,jsonb,uuid)','execute') c")).rows[0].c, false);
  evidence.push("profile.update: simultaneous updates by two accounts each change only their own row, bad names are INVALID_INPUT and signed out is UNAUTHORIZED; two phones asking for deletion at once create one open request, a retry with the same request id returns the stored receipt, a resolved one allows a new request, and the renamed base is not executable by clients.");
}
