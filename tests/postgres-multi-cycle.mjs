import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  CATERER_IDS as K,
} from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "@catera/domain";
export async function verifyMultiCycle(pool, cmd, evidence) {
  for (const suffix of [
    "_paid_seller_pilot.sql",
    "_multi_cycle.sql",
    "_earned_settlement.sql",
  ]) {
    const file = (await readdir("supabase/migrations")).find((f) =>
      f.endsWith(suffix),
    );
    await pool.query(await readFile("supabase/migrations/" + file, "utf8"));
  }
  const offer = (
    await pool.query("select offer from v1.packages where id=$1", [P[0]])
  ).rows[0].offer;
  const p = await cmd(
    "package.save",
    {
      catererId: K[0],
      slug: "multi-cycle-race",
      offer: {
        ...offer,
        name: "Synthetic cycle concurrency",
        days: 20,
        status: "published",
        capacity: Object.fromEntries(offer.weekdays.map((d) => [d, 3])),
      },
    },
    U.owner,
  );
  await cmd(
    "package.durationPricing.save",
    {
      catererId: K[0],
      packageId: p.id,
      revision: 0,
      options: [
        { cycles: 1, discountPercent: 0 },
        { cycles: 3, discountPercent: 5 },
      ],
    },
    U.owner,
  );
  const users = [];
  const inputs = [];
  for (let i = 0; i < 3; i++) {
    const user = crypto.randomUUID();
    users.push(user);
    await pool.query("insert into v1.profiles(id,name) values($1,$2)", [
      user,
      "Synthetic cycle " + i,
    ]);
    const a = await cmd(
      "address.save",
      {
        label: "Test",
        line: "Synthetic Road 10",
        area: "Jakarta Selatan",
        city: "Jakarta",
        instructions: "",
      },
      user,
    );
    inputs.push({
      packageId: p.id,
      addressId: a.id,
      portions: 1,
      cycles: 3,
      startDate: addDays(localDay(), 10),
      trial: false,
    });
  }
  const client = await pool.connect();
  let q;
  try {
    await client.query("begin");
    await client.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('catera.demo','true',true)",
      [users[0]],
    );
    q = (await client.query("select v1.quote($1,$2) q", [users[0], inputs[0]]))
      .rows[0].q;
    await client.query("rollback");
  } finally {
    client.release();
  }
  assert.equal(q.dates.length, 60);
  await pool.query("insert into v1.capacity values($1,$2,1,false)", [
    p.id,
    q.dates.at(-1),
  ]);
  const results = await Promise.allSettled(
    inputs.map((a, i) => cmd("checkout.create", { acceptedTerms: true, ...(a) }, users[i])),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  for (const r of results.filter((r) => r.status === "rejected"))
    assert.match(r.reason.message, /CAPACITY/);
  const winner = results.findIndex((r) => r.status === "fulfilled");
  const c = results[winner].value;
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.reservations where checkout_id=$1",
        [c.id],
      )
    ).rows[0].n,
    60,
  );
  const payments = await Promise.all(
    Array.from({ length: 3 }, () =>
      cmd("checkout.demo_pay", { id: c.id }, users[winner]),
    ),
  );
  assert(
    payments.every((p) => p.subscriptionId === payments[0].subscriptionId),
  );
  assert.equal(
    (
      await pool.query(
        "select sum(d.amount)::int n from v1.settlement_day_allocations d join v1.allocations a on a.id=d.allocation_id where a.checkout_id=$1",
        [c.id],
      )
    ).rows[0].n,
    c.quote.sellerNet,
  );
  const renew = {
    ...inputs[winner],
    renewedFrom: payments[0].subscriptionId,
    startDate: addDays(q.dates.at(-1), 1),
  };
  const renewals = await Promise.allSettled([
    cmd("checkout.create", { acceptedTerms: true, ...(renew) }, users[winner]),
    cmd("checkout.create", { acceptedTerms: true, ...(renew) }, users[winner]),
  ]);
  assert.equal(renewals.filter((r) => r.status === "fulfilled").length, 1);
  const day = (
    await pool.query(
      "select id from v1.delivery_days where subscription_id=$1 order by service_date limit 1",
      [payments[0].subscriptionId],
    )
  ).rows[0].id;
  await pool.query(
    "update v1.fulfillments set status='delivered' where day_id=$1",
    [day],
  );
  await Promise.all(
    Array.from({ length: 3 }, () =>
      pool.query("update v1.delivery_days set status='delivered' where id=$1", [
        day,
      ]),
    ),
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.settlement_entries where day_id=$1 and kind='earned'",
        [day],
      )
    ).rows[0].n,
    1,
  );
  evidence.push(
    "Multi-cycle: three buyers compete for capacity on the 60th date; exactly one complete purchase commits, repeated activation credits no duplicates, and only one early renewal succeeds.",
  );
  evidence.push(
    "Concurrent delivery completion produces exactly one earned seller credit.",
  );
}
