import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CATERER_IDS as K, DEMO_ACTORS as U, PACKAGE_IDS as P } from "../packages/backend/src/seed.ts";

// account.erase (2026-11-09) on real PostgreSQL, on top of whatever this harness built: refusals, two admins erasing
// at once, what is gone and what bookkeeping stays. One synthetic customer with distinctive values, so a search of
// every v1 table proves none of them survived.
export async function verifyAccountErase(pool, cmd, evidence) {
  for (const file of ["20261107120000_address_pin.sql", "20261107130000_command_not_anon.sql", "20261109110000_account_erase.sql"])
    await pool.query(await readFile("supabase/migrations/" + file, "utf8"));
  const q = async (sql, params = []) => (await pool.query(sql, params)).rows;
  const one = async (sql, params) => (await q(sql, params))[0];
  const tag = Math.floor(Math.random() * 9000 + 1000);
  const name = `Sinta Uji Hapus ${tag}`, phone = `+62812773${tag}0`, line = `Jl. Uji Hapus No. ${tag}`;
  const token = `ExponentPushToken[erase-${tag}]`, said = `Pesan rahasia ${tag}`;
  const user = crypto.randomUUID();
  await q("insert into v1.profiles(id,name,role,phone) values($1,$2,'customer',$3)", [user, name, phone]);
  const { id: addressId } = await cmd("address.save", { label: "Rumah", line, area: "Jakarta Selatan", city: "Jakarta", instructions: `Titip ke ${name}`, lat: -6.2441, lng: 106.7992 }, user);
  const { id: ticket } = await cmd("accountRequest.create", { kind: "deletion", body: `Hapus akun ${name}, ${phone}` }, user);
  const { id: help } = await cmd("accountRequest.create", { kind: "help", body: "Bantuan biasa saja." }, user);

  // Finished history, inserted as the database owner: a paid checkout, its subscription and day, a refund, a payout.
  const checkout = (await one(
    `insert into v1.checkouts(user_id,package_id,address_id,quote,state,expires_at)
     select $1,$2,a.id,jsonb_build_object('pricingVersion','2','total',50000,'address',to_jsonb(a)-'user_id'),'paid',now()
     from v1.addresses a where a.id=$3 returning id`, [user, P[0], addressId])).id;
  const sub = (await one(
    `insert into v1.subscriptions(checkout_id,user_id,package_id,snapshot,portions,starts_on,ends_on,status)
     select $1,$2,p.id,jsonb_build_object('offer',v1.offer(p),'address',to_jsonb(a)-'user_id'),1,current_date-30,current_date-26,'completed'
     from v1.packages p,v1.addresses a where p.id=$3 and a.id=$4 returning id`, [checkout, user, P[0], addressId])).id;
  await q("update v1.checkouts set subscription_id=$1 where id=$2", [sub, checkout]);
  const day = (await one("insert into v1.delivery_days(subscription_id,service_date,address,status) select $1,current_date-30,to_jsonb(a)-'user_id','delivered' from v1.addresses a where a.id=$2 returning id", [sub, addressId])).id;
  await q("insert into v1.production(caterer_id,service_date,revision,entries) values($1,current_date-30,$2,$3)", [K[0], 9000 + tag, JSON.stringify([{ id: day, address: { line }, customer: { id: user, name } }, { id: crypto.randomUUID(), address: { line: "Jl. Lain" } }])]);
  await q("insert into v1.fulfillments(day_id,meal,status) values($1,'lunch','delivered')", [day]);
  const issue = (await one("insert into v1.delivery_issues(day_id,meal,user_id,caterer_id,subject,description,status) values($1,'lunch',$2,$3,'Terlambat',$4,'resolved') returning id", [day, user, K[0], said])).id;
  await q("insert into v1.delivery_issue_events(issue_id,actor_id,action,body) values($1,$2,'created',$3),($1,$4,'responded',$5)", [issue, user, said, U.owner, `Maaf ${name}`]);
  await q("insert into v1.payments(checkout_id,amount,state) values($1,50000,'paid')", [checkout]);
  const allocation = (await one("insert into v1.allocations(checkout_id,caterer_id,amount,paid_out) values($1,$2,45000,45000) returning id", [checkout, K[0]])).id;
  const payout = (await one("insert into v1.payouts(caterer_id,amount,status) values($1,45000,'succeeded') returning id", [K[0]])).id;
  await q("insert into v1.payout_items(payout_id,allocation_id,amount) values($1,$2,45000)", [payout, allocation]);
  const supportCase = (await one("insert into v1.support_cases(user_id,caterer_id,checkout_id,subject,description,status) values($1,$2,$3,'Pengembalian',$4,'resolved') returning id", [user, K[0], checkout, said])).id;
  const refund = (await one("insert into v1.refunds(case_id,checkout_id,amount,state) values($1,$2,5000,'succeeded') returning id", [supportCase, checkout])).id;
  await q("insert into v1.reviews(subscription_id,user_id,package_id,rating,food,delivery,value,body) values($1,$2,$3,5,5,5,5,$4)", [sub, user, P[0], said]);
  const convo = (await one("insert into v1.conversations(customer_id,caterer_id) values($1,$2) returning id", [user, K[0]])).id;
  await q("insert into v1.messages(conversation_id,sender_id,body) values($1,$2,$3),($1,$4,$5)", [convo, user, said, U.owner, `Halo ${name}`]);
  const job = (await one("insert into v1.outbox(kind,payload) values('push',$1) returning id", [{ userId: user, body: `Untuk ${name}` }])).id;
  const sentJob = (await one("insert into v1.outbox(kind,payload,processed_at) values('push',$1,now()) returning id", [{ userId: user, body: "Terkirim." }])).id;
  await q("insert into v1.devices(user_id,token) values($1,$2)", [user, token]);
  await q("insert into v1.push_tickets(id,token,job_id) values($1,$2,$3)", ["ticket-" + tag, token, job]);
  await q("insert into v1.saved_packages(user_id,package_id,summary) values($1,$2,'{}')", [user, P[0]]);
  const kept = async () => ({
    checkouts: (await one("select count(*)::int n from v1.checkouts where user_id=$1 and state='paid'", [user])).n,
    payment: (await one("select amount from v1.payments where checkout_id=$1", [checkout])).amount,
    refund: (await one("select amount,state from v1.refunds where id=$1", [refund])),
    allocation: (await one("select amount,paid_out from v1.allocations where id=$1", [allocation])),
    payout: (await one("select p.amount,p.status,i.amount item from v1.payouts p join v1.payout_items i on i.payout_id=p.id where p.id=$1", [payout])),
    subscription: (await one("select status,portions from v1.subscriptions where id=$1", [sub])),
  });
  const before = await kept();
  const erase = (actor = U.platform_admin, id = ticket) => cmd("account.erase", { id }, actor);

  // Only a platform admin, only against a deletion request.
  await assert.rejects(erase(user), /FORBIDDEN/);
  await assert.rejects(erase(U.owner), /FORBIDDEN/);
  await assert.rejects(erase(U.platform_admin, help), /NOT_FOUND/);
  assert.equal((await one("select has_function_privilege('anon','public.catera_v1_command(text,jsonb,uuid)','execute') a,has_function_privilege('authenticated','public.catera_v1_command_erase_base(text,jsonb,uuid)','execute') b")).a, false);

  // Anything still in flight refuses, and leaves the customer exactly as they were.
  for (const [set, reset] of [
    ["update v1.subscriptions set status='active' where id=$1", "update v1.subscriptions set status='completed' where id=$1", sub],
    ["update v1.refunds set state='requested' where id=$1", "update v1.refunds set state='succeeded' where id=$1", refund],
    ["update v1.payouts set status='pending' where id=$1", "update v1.payouts set status='succeeded' where id=$1", payout],
  ].map(([a, b, id]) => [() => q(a, [id]), () => q(b, [id])])) {
    await set();
    await assert.rejects(erase(), /ACTIVE_ORDERS/);
    await reset();
  }
  const pending = (await one("insert into v1.checkouts(user_id,package_id,address_id,quote,expires_at) values($1,$2,$3,'{}',now()+interval '10 minutes') returning id", [user, P[0], addressId])).id;
  await assert.rejects(erase(), /ACTIVE_ORDERS/);
  await q("update v1.checkouts set state='expired' where id=$1", [pending]);
  assert.deepEqual(await one("select name,phone from v1.profiles where id=$1", [user]), { name, phone });
  assert.equal((await one("select status from v1.account_requests where id=$1", [ticket])).status, "open");
  evidence.push("account.erase refuses a customer, a kitchen owner and a help request (FORBIDDEN, NOT_FOUND), and refuses with ACTIVE_ORDERS while a subscription, unfinished checkout, pending refund or unsettled payout remains, changing nothing");

  // Two admins at once: one erases, the other gets the same answer; one audit row.
  const both = await Promise.all([erase(), erase()]);
  assert.deepEqual(both.map((r) => r.userId), [user, user]);
  assert.equal(both.filter((r) => r.existing).length, 1);
  assert.equal((await one("select count(*)::int n from v1.audit where action='account.erase' and details->>'requestId'=$1", [ticket])).n, 1);
  assert.equal((await erase()).existing, true);
  evidence.push("Two simultaneous account.erase calls on one request: one erases, the other answers the finished result; one audit row; a later retry answers the same");

  // What is gone.
  assert.deepEqual(await one("select name,phone from v1.profiles where id=$1", [user]), { name: "Pengguna terhapus", phone: null });
  assert.deepEqual(await q("select line,area,instructions,lat,lng,archived_at is not null archived from v1.addresses where user_id=$1", [user]), [{ line: "", area: "", instructions: "", lat: null, lng: null, archived: true }]);
  for (const sql of [
    "select 1 from v1.devices where user_id=$1", "select 1 from v1.saved_packages where user_id=$1", "select 1 from v1.notifications where user_id=$1",
    "select 1 from v1.receipts where actor_id=$1", "select 1 from v1.outbox where processed_at is null and payload->>'userId'=$1::text",
    "select 1 from v1.subscriptions where user_id=$1 and snapshot ? 'address'", "select 1 from v1.checkouts where user_id=$1 and quote ? 'address'",
    "select 1 from v1.customer_records where user_id=$1 and (name<>'Pengguna terhapus' or phone is not null or address<>'{}')",
  ]) assert.equal((await pool.query(sql, [user])).rowCount, 0, sql);
  assert.equal((await pool.query("select 1 from v1.push_tickets where token=$1", [token])).rowCount, 0);
  assert.equal((await pool.query("select 1 from v1.outbox where id=$1", [sentJob])).rowCount, 1);
  assert.deepEqual((await one("select address from v1.delivery_days where id=$1", [day])).address, {});
  assert.deepEqual((await one("select body from v1.reviews where subscription_id=$1", [sub])).body, "");
  assert.deepEqual((await q("select body from v1.messages where conversation_id=$1", [convo])).map((m) => m.body), ["[dihapus]", "[dihapus]"]);
  assert.deepEqual(await one("select status,resolved_by from v1.account_requests where id=$1", [ticket]), { status: "resolved", resolved_by: U.platform_admin });
  // Every row of every v1 table, as text: none still carries the name, phone, street line, token or message.
  const tables = (await q("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='v1' and c.relkind in('r','p')")).map((r) => r.relname);
  const left = [];
  for (const t of tables)
    for (const value of [name, phone, line, token, said])
      if ((await pool.query(`select 1 from v1.${t} x where x::text like '%'||$1||'%' limit 1`, [value])).rowCount) left.push(`${t}: ${value}`);
  assert.deepEqual(left, []);
  // What stays, unchanged and identity-free.
  assert.deepEqual(await kept(), before);
  evidence.push("After account.erase no v1 table holds the customer's name, phone, street line, push token or message text; addresses are blank and archived; the paid checkout, payment, refund, allocation and payout rows are unchanged");

  // The frozen-terms guards still hold outside the erase's own change.
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('catera.erase_user',$1,true)", [user]);
    for (const [sql, error] of [
      ["update v1.subscriptions set snapshot=snapshot||'{\"total\":1}' where id=$1", /IMMUTABLE_TERMS/],
      ["update v1.production set revision=revision+1 where entries @> jsonb_build_array(jsonb_build_object('id',$1::text))", /IMMUTABLE_HISTORY/],
      ["delete from v1.production where entries @> jsonb_build_array(jsonb_build_object('id',$1::text))", /IMMUTABLE_HISTORY/],
      ["update v1.delivery_issue_events set body='lain' where issue_id=$1", /IMMUTABLE_HISTORY/],
    ]) {
      await c.query("savepoint s");
      await assert.rejects(c.query(sql, [sql.includes("issue_id") ? issue : sql.includes("production") ? day : sub]), error, sql);
      await c.query("rollback to savepoint s");
    }
  } finally {
    await c.query("rollback");
    c.release();
  }
  evidence.push("With the erase setting present, any other snapshot change still raises IMMUTABLE_TERMS, and other production-sheet or complaint-history edits and deletes still raise IMMUTABLE_HISTORY");
}
