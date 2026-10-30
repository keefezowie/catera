import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEMO_ACTORS as U, CATERER_IDS as K } from "../packages/backend/src/seed.ts";

// Sign-in rethink: typed contact numbers on real PostgreSQL, on top of the hosted payment-channels system read.
export async function verifyContactPhone(pool, cmd, evidence) {
  await pool.query(await readFile("supabase/migrations/20261030120000_caterer_contact_whatsapp.sql", "utf8"));
  const sys = async (action, payload) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)");
      return (await c.query("select public.catera_v1_system($1,$2) value", [action, payload])).rows[0].value;
    } finally {
      await c.query("rollback");
      c.release();
    }
  };
  const checkout = (await pool.query("select id from v1.checkouts where user_id=$1 order by created_at desc limit 1", [U.customer])).rows[0].id;
  const madeAuth = !(await pool.query("select to_regclass('auth.users') is not null x")).rows[0].x;
  if (madeAuth) await pool.query("create table auth.users(id uuid primary key, phone text, email text, phone_confirmed_at timestamptz)");
  await pool.query("insert into auth.users(id,phone,email) values($1,'6281200000001','synthetic@example.test') on conflict(id) do update set phone=excluded.phone", [U.customer]);
  assert.equal((await sys("provider.payment.customer", { id: checkout })).phone, "6281200000001");
  await cmd("profile.update", { phone: "+6281234500009" }, U.customer);
  assert.equal((await sys("provider.payment.customer", { id: checkout })).phone, "+6281234500009");
  await cmd("profile.update", { phone: null }, U.customer);
  assert.equal((await sys("provider.payment.customer", { id: checkout })).phone, "6281200000001");
  await pool.query(madeAuth ? "drop table auth.users" : "delete from auth.users where id=$1", madeAuth ? [] : [U.customer]);

  await assert.rejects(cmd("seller.whatsapp", { catererId: K[0], whatsapp: "+6281300000001" }, U.staff), /FORBIDDEN/);
  const set = await Promise.all(["+6281300000001", "+6281300000002"].map((whatsapp) =>
    cmd("seller.whatsapp", { catererId: K[0], whatsapp }, U.owner)));
  const stored = (await pool.query("select whatsapp from v1.caterers where id=$1", [K[0]])).rows[0].whatsapp;
  assert.ok(set.some((r) => r.whatsapp === stored));
  await cmd("seller.whatsapp", { catererId: K[0], whatsapp: null }, U.owner);
  // Claim attempts: wrong numbers commit their count; seven at once leave five counted and the link expired.
  const commit = async (payload) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)");
      const r = (await c.query("select public.catera_v1_system('pilot.claim',$1) value", [payload])).rows[0].value;
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  };
  const link = async (phone) => {
    const record = (await pool.query("insert into v1.customer_records(caterer_id,name,phone,origin) values($1,'Synthetic claim attempts',$2,'seller') returning id", [K[1], phone])).rows[0].id;
    const token = crypto.randomUUID() + crypto.randomUUID();
    await pool.query("insert into v1.customer_claims(customer_record_id,token_hash,expires_at,created_by) values($1,encode(sha256(convert_to($2,'UTF8')),'hex'),now()+interval '1 day',$3)", [record, token, U.owner]);
    const who = crypto.randomUUID();
    await pool.query("insert into v1.profiles(id,name) values($1,'Synthetic claimer')", [who]);
    const attempt = (verifiedPhone) => commit({ userId: who, token, verifiedPhone, requestId: crypto.randomUUID() });
    const count = async () => (await pool.query("select failed_attempts n from v1.customer_claims where customer_record_id=$1", [record])).rows[0].n;
    return { attempt, count };
  };
  const spent = await link("+6281277100001");
  const burst = await Promise.allSettled([1, 2, 3, 4, 5, 6, 7].map((i) => spent.attempt("+62899990000" + i)));
  assert.equal(burst.filter((r) => r.status === "fulfilled" && r.value.status === "unavailable").length, 5);
  assert.ok(burst.filter((r) => r.status === "rejected").every((r) => /CLAIM_UNAVAILABLE/.test(r.reason.message)));
  assert.equal(await spent.count(), 5);
  await assert.rejects(spent.attempt("+6281277100001"), /CLAIM_UNAVAILABLE/);
  const kept = await link("+6281277100002");
  for (let i = 1; i <= 4; i++) await kept.attempt("+62899990000" + i);
  assert.equal((await kept.attempt("+6281277100002")).status, "claimed");
  for (const fn of ["catera_v1_command_contact_base(text,jsonb,uuid)", "catera_v1_read_contact_base(text,jsonb)", "catera_v1_system_contact_base(text,jsonb)"])
    assert.equal((await pool.query(`select has_function_privilege('authenticated','public.${fn}','execute') c`)).rows[0].c, false);
  evidence.push("Contact numbers: provider.payment.customer prefers the phone typed through profile.update and falls back to auth.users.phone when it is cleared; seller.whatsapp is owner only, two simultaneous sets leave one of them, seven simultaneous wrong claim numbers count five and expire the link (the right number then fails), four wrong then the right one claims; and the renamed bases are not executable by clients.");
}
