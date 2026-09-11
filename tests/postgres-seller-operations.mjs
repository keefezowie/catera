import assert from "node:assert/strict";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed.ts";
import { localDay, addDays } from "@catera/domain";
export async function verifySellerOperations(pool, cmd, evidence) {
  const date = addDays(localDay(), -1),
    items = [];
  for (const packageId of [P[0], P[2]]) {
    const sub = crypto.randomUUID(),
      id = crypto.randomUUID();
    await pool.query(
      "insert into v1.subscriptions(id,user_id,package_id,snapshot,portions,starts_on,ends_on) select $1,$2,id,jsonb_build_object('offer',v1.offer(p)),2,$3,$3 from v1.packages p where id=$4",
      [sub, U.customer, date, packageId],
    );
    await pool.query(
      "insert into v1.delivery_days(id,subscription_id,service_date,address) values($1,$2,$3,'{}')",
      [id, sub, date],
    );
    await pool.query(
      "insert into v1.fulfillments(day_id,meal) values($1,'lunch'),($1,'dinner')",
      [id],
    );
    items.push({ id, version: 1 });
  }
  const payload = {
    catererId: K[0],
    date,
    meal: "lunch",
    status: "preparing",
    items,
  };
  const results = await Promise.allSettled([
    cmd("delivery.statusBatch", payload, U.owner),
    cmd(
      "delivery.statusBatch",
      { ...payload, items: [...items].reverse() },
      U.staff,
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(
    results.find((r) => r.status === "rejected").reason.message,
    /CONFLICT/,
  );
  const statuses = await pool.query(
    "select f.status from v1.fulfillments f where f.day_id=any($1::uuid[]) and meal='dinner'",
    [items.map((i) => i.id)],
  );
  assert(statuses.rows.every((r) => r.status === "scheduled"));
  const current = items.map((i) => ({ ...i, version: 2 }));
  const request = crypto.randomUUID(),
    p = { ...payload, status: "out_for_delivery", items: current };
  await cmd("delivery.statusBatch", p, U.owner, request);
  await cmd("delivery.statusBatch", p, U.owner, request);
  assert(
    (
      await pool.query(
        "select version from v1.delivery_days where id=any($1::uuid[])",
        [items.map((i) => i.id)],
      )
    ).rows.every((r) => r.version === 3),
  );
  await assert.rejects(
    cmd("delivery.statusBatch", { ...payload, catererId: K[1] }, U.owner),
    /FORBIDDEN/,
  );
  const count = async () =>
    (
      await pool.query(
        "select (select count(*) from v1.audit) a,(select count(*) from v1.notifications) n",
      )
    ).rows;
  const before = await count();
  await assert.rejects(
    cmd(
      "delivery.statusBatch",
      {
        ...payload,
        status: "delivered",
        items: current.map((i, n) => ({ ...i, version: n ? 99 : 3 })),
      },
      U.owner,
    ),
    /CONFLICT/,
  );
  assert.deepEqual(await count(), before);
  evidence.push(
    "Seller bulk status: reversed concurrent batches accept one version without deadlock, dinner stays independent, retries are idempotent, cross-tenant access fails, and stale batches roll back audit/notifications.",
  );
}
