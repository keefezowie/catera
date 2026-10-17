import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CATERER_IDS as K, DEMO_ACTORS as U, PACKAGE_IDS as P } from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "@catera/domain";

// Phase G, G13: address.delete against a checkout, and address.replace against delivery.cook, on two
// real connections. Each round owns a fresh synthetic customer.

/** A transaction held open on its own connection as `user`; `fn` decides when it commits. */
async function held(pool, user, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('catera.demo','true',true)", [user]);
    return await fn(c);
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
const waitingOnALock = async (pool) =>
  (await pool.query("select count(*)::int n from pg_stat_activity where wait_event_type='Lock' and datname=current_database()")).rows[0].n;
async function untilBlocked(pool) {
  for (let i = 0; i < 200 && !(await waitingOnALock(pool)); i++) await new Promise((r) => setTimeout(r, 10));
}
const settled = (results) => results.map((r) => (r.status === "fulfilled" ? "ok" : String(r.reason?.message ?? r.reason)));

export async function verifyAddressDelete(pool, cmd, evidence) {
  await pool.query(await readFile("supabase/migrations/20261014120000_address_delete_replace.sql", "utf8"));
  const today = localDay();
  let n = 0;
  async function customer() {
    const user = crypto.randomUUID();
    await pool.query("insert into v1.profiles(id,name,role) values($1,'Pelanggan Sintetis','customer')", [user]);
    const save = (label) => cmd("address.save", { label, line: "Jl. Sintetis No. 7", area: "Jakarta Selatan", city: "Jakarta", instructions: "" }, user);
    return { user, home: (await save("Rumah")).id, office: (await save("Kantor")).id };
  }
  const checkout = (user, addressId) =>
    cmd("checkout.create", { acceptedTerms: true, packageId: P[0], addressId, portions: 1, startDate: addDays(today, 30 + 7 * (n++ % 40)), trial: false }, user);
  // The invariant both races protect: no live pending checkout points at an archived address.
  const orphans = async () =>
    (await pool.query("select count(*)::int n from v1.checkouts c join v1.addresses a on a.id=c.address_id where c.state='pending' and a.archived_at is not null")).rows[0].n;

  // 1. Delete racing a checkout: exactly one wins, and the loser says why.
  const outcomes = { deleted: 0, bought: 0 };
  for (let round = 0; round < 8; round++) {
    const { user, home } = await customer();
    // Alternate which call leaves first so both orders get a chance to win.
    const calls = [() => checkout(user, home), () => cmd("address.delete", { addressId: home }, user)];
    const [bought, deleted] = settled(await Promise.allSettled(round % 2 ? calls.reverse().map((f) => f()).reverse() : calls.map((f) => f())));
    if (deleted === "ok") {
      assert.equal(bought, "NOT_FOUND", "round " + round);
      outcomes.deleted++;
    } else {
      assert.deepEqual([bought, deleted], ["ok", "ADDRESS_IN_USE"], "round " + round);
      outcomes.bought++;
    }
  }
  // Forced orders: a delete in flight makes the checkout wait and then refuse; a checkout in flight makes the delete wait and then refuse.
  {
    const { user, home } = await customer();
    let buying;
    const waited = await held(pool, user, async (c) => {
      await c.query("select public.catera_v1_command('address.delete',$1,gen_random_uuid())", [{ addressId: home }]);
      buying = Promise.allSettled([checkout(user, home)]);
      await untilBlocked(pool);
      const blocked = (await waitingOnALock(pool)) > 0;
      await c.query("commit");
      return blocked;
    });
    assert.equal(waited, true, "the checkout waits for the delete in flight");
    assert.deepEqual(settled(await buying), ["NOT_FOUND"]);
  }
  {
    const { user, home } = await customer();
    let deleting;
    const waited = await held(pool, user, async (c) => {
      await c.query("select public.catera_v1_command('checkout.create',$1,gen_random_uuid())", [
        { acceptedTerms: true, packageId: P[0], addressId: home, portions: 1, startDate: addDays(today, 30 + 7 * (n++ % 40)), trial: false },
      ]);
      deleting = Promise.allSettled([cmd("address.delete", { addressId: home }, user)]);
      await untilBlocked(pool);
      const blocked = (await waitingOnALock(pool)) > 0;
      await c.query("commit");
      return blocked;
    });
    assert.equal(waited, true, "the delete waits for the checkout in flight");
    assert.deepEqual(settled(await deleting), ["ADDRESS_IN_USE"]);
  }
  assert.equal(await orphans(), 0);
  assert.equal((await pool.query("select has_function_privilege('authenticated','public.catera_v1_command_address_base(text,jsonb,uuid)','execute') c")).rows[0].c, false);
  evidence.push(
    `address.delete racing checkout.create 8 times ends with one winner (${outcomes.deleted} deleted, ${outcomes.bought} bought); a held delete makes the checkout wait and fail NOT_FOUND, a held checkout makes the delete wait and fail ADDRESS_IN_USE; no pending checkout is left on an archived address; the renamed base is not executable by clients.`,
  );

  // 1b. Delete racing a caterer import.commit that names the address: the import reads the address row for share,
  // the delete takes it for update, so one waits for the other and no imported day lands on a removed address.
  let imported = 0;
  async function importPreview(user, addressId) {
    await pool.query("insert into v1.relationships(user_id,caterer_id,source) values($1,$2,'legacy') on conflict do nothing", [user, K[0]]);
    const row = { customerId: user, addressId, packageId: P[2], portions: 1, startDate: addDays(today, 40 + 7 * (imported % 30)), remainingDays: 1, externalReference: "alamat-race-" + imported++ };
    return cmd("import.preview", { catererId: K[0], rows: [row] }, U.owner);
  }
  const dayOnRemoved = async () =>
    (await pool.query("select count(*)::int n from v1.delivery_days d join v1.addresses a on a.id::text=d.address->>'id' where a.archived_at is not null and d.status not in('delivered','cancelled') and d.service_date>=$1::date", [today])).rows[0].n;
  {
    const { user, home } = await customer();
    const preview = await importPreview(user, home);
    let committing;
    const waited = await held(pool, user, async (c) => {
      await c.query("select public.catera_v1_command('address.delete',$1,gen_random_uuid())", [{ addressId: home }]);
      committing = Promise.allSettled([cmd("import.commit", { catererId: K[0], id: preview.id }, U.owner)]);
      await untilBlocked(pool);
      const blocked = (await waitingOnALock(pool)) > 0;
      await c.query("commit");
      return blocked;
    });
    assert.equal(waited, true, "the import waits for the delete in flight");
    assert.deepEqual(settled(await committing), ["NOT_FOUND"]);
  }
  {
    const { user, home } = await customer();
    const preview = await importPreview(user, home);
    let deleting;
    const waited = await held(pool, U.owner, async (c) => {
      await c.query("select public.catera_v1_command('import.commit',$1,gen_random_uuid())", [{ catererId: K[0], id: preview.id }]);
      deleting = Promise.allSettled([cmd("address.delete", { addressId: home }, user)]);
      await untilBlocked(pool);
      const blocked = (await waitingOnALock(pool)) > 0;
      await c.query("commit");
      return blocked;
    });
    assert.equal(waited, true, "the delete waits for the import in flight");
    assert.deepEqual(settled(await deleting), ["ADDRESS_IN_USE"]);
  }
  assert.equal(await dayOnRemoved(), 0);
  evidence.push(
    "address.delete racing import.commit on the same address, in both forced orders: each waits for the other on the address row; a delete first makes the import fail NOT_FOUND, an import first makes the delete fail ADDRESS_IN_USE, and no upcoming day sits on a removed address.",
  );

  // 2. Replace racing delivery.cook on the same day: the day is either moved or cooked, never both.
  async function dayToday() {
    const { user, home, office } = await customer();
    const c = await checkout(user, home);
    await cmd("checkout.demo_pay", { id: c.id }, user);
    const days = (
      await pool.query("select d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date", [c.id])
    ).rows.map((r) => r.id);
    await pool.query("update v1.delivery_days set service_date=$2::date where id=$1", [days[0], today]);
    return { user, home, office, today: days[0], later: days.slice(1) };
  }
  const state = async (id) =>
    (await pool.query("select d.status,d.address->>'id' address,f.status meal from v1.delivery_days d join v1.fulfillments f on f.day_id=d.id and f.meal='lunch' where d.id=$1", [id])).rows[0];
  const cook = () => cmd("delivery.cook", { catererId: K[0], date: today, meal: "lunch" }, U.owner);
  const both = (s, home) => s.meal !== "scheduled" && s.address !== home;
  for (let round = 0; round < 6; round++) {
    const day = await dayToday();
    const [a, b] = settled(await Promise.allSettled([cmd("address.replace", { fromAddressId: day.home, toAddressId: day.office }, day.user), cook()]));
    assert.deepEqual([a, b], ["ok", "ok"], "round " + round);
    const s = await state(day.today);
    assert.equal(both(s, day.home), false, "round " + round);
    assert.equal(s.meal, "preparing");
    for (const id of day.later) assert.equal((await state(id)).address, day.office);
  }
  // Forced orders on the caterer lock: cook in flight, then replace leaves the cooked day; replace in flight, then cook waits for it.
  {
    const day = await dayToday();
    let replacing;
    const waited = await held(pool, U.owner, async (c) => {
      await c.query("select public.catera_v1_command('delivery.cook',$1,gen_random_uuid())", [{ catererId: K[0], date: today, meal: "lunch" }]);
      replacing = cmd("address.replace", { fromAddressId: day.home, toAddressId: day.office }, day.user);
      await untilBlocked(pool);
      const blocked = (await waitingOnALock(pool)) > 0;
      await c.query("commit");
      return blocked;
    });
    assert.equal(waited, true, "replace waits for the cook in flight");
    const result = await replacing;
    assert.equal(result.stayed, 1);
    assert.equal(result.stayedUntil.slice(0, 10), today);
    assert.equal((await state(day.today)).address, day.home);
  }
  {
    const day = await dayToday();
    let cooking;
    const waited = await held(pool, day.user, async (c) => {
      await c.query("select public.catera_v1_command('address.replace',$1,gen_random_uuid())", [{ fromAddressId: day.home, toAddressId: day.office }]);
      cooking = cook();
      await untilBlocked(pool);
      const blocked = (await waitingOnALock(pool)) > 0;
      await c.query("commit");
      return blocked;
    });
    assert.equal(waited, true, "cook waits for the replace in flight");
    await cooking;
    const s = await state(day.today);
    assert.equal(s.meal, "preparing");
    assert.equal(s.address, day.home, "today's day is past its cutoff, so the replace left it");
    for (const id of day.later) assert.equal((await state(id)).address, day.office);
  }
  evidence.push(
    "address.replace racing delivery.cook 6 times on the same day always leaves that day cooked at the old address and moves the later days; each waits for the other on the caterer lock, and no day is both moved and cooked.",
  );
}
