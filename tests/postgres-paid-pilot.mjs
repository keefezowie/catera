import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "@catera/domain";
export async function verifyPaidPilot(pool, cmd, evidence) {
  await pool.query(
    await readFile(
      "supabase/migrations/20260914160856_paid_seller_pilot.sql",
      "utf8",
    ),
  );
  const address = (
    await pool.query(
      "select line,area,city,instructions from v1.addresses limit 1",
    )
  ).rows[0];
  const base = (
    await pool.query("select offer from v1.packages where id=$1", [P[2]])
  ).rows[0].offer;
  const pack = await cmd(
    "package.save",
    {
      catererId: K[0],
      slug: "paid-pilot-concurrency",
      offer: {
        ...base,
        status: "published",
        days: 3,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        capacity: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, 30])),
      },
    },
    U.owner,
  );
  const startDate = addDays(localDay(), 210);
  const row = (i) => ({
    customer: {
      name: "Synthetic pilot " + i,
      phone: "+62855566" + String(i).padStart(5, "0"),
      address,
    },
    packageId: pack.id,
    portions: 1,
    startDate,
    remainingDays: 3,
    externalReference: "pilot-" + i,
  });
  const previews = await Promise.all(
    [U.owner, U.platform_admin].map((user) =>
      cmd(
        "import.preview",
        { catererId: K[0], rows: Array.from({ length: 30 }, (_, i) => row(i)) },
        user,
      ),
    ),
  );
  const imports = await Promise.allSettled(
    previews.map((p, i) =>
      cmd(
        "import.commit",
        { catererId: K[0], id: p.id },
        [U.owner, U.platform_admin][i],
      ),
    ),
  );
  assert.equal(imports.filter((x) => x.status === "fulfilled").length, 1);
  assert.match(
    imports.find((x) => x.status === "rejected").reason.message,
    /DUPLICATE_CUSTOMER|CAPACITY/,
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.subscriptions where package_id=$1",
        [pack.id],
      )
    ).rows[0].n,
    30,
  );
  assert.equal(
    (await pool.query("select v1.demand($1,$2)::int n", [pack.id, startDate]))
      .rows[0].n,
    30,
  );
  const record = imports.find((x) => x.status === "fulfilled").value
    .subscriptions[0];
  const invite = await cmd(
    "customer.invite",
    { catererId: K[0], customerRecordId: record.customerRecordId },
    U.owner,
  );
  const users = [crypto.randomUUID(), crypto.randomUUID()];
  for (const id of users)
    await pool.query("insert into v1.profiles(id,name) values($1,$2)", [
      id,
      "Claim race synthetic",
    ]);
  const claim = async (userId) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `select set_config('request.jwt.claims','{"role":"service_role"}',true)`,
      );
      const result = await client.query(
        "select public.catera_v1_system($1,$2) value",
        [
          "pilot.claim",
          {
            userId,
            token: invite.path.split("/").at(-1),
            verifiedPhone: row(0).customer.phone,
            requestId: crypto.randomUUID(),
          },
        ],
      );
      await client.query("commit");
      return result.rows[0].value;
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  };
  const claims = await Promise.allSettled(users.map(claim));
  assert.equal(claims.filter((x) => x.status === "fulfilled").length, 1);
  assert.match(
    claims.find((x) => x.status === "rejected").reason.message,
    /CLAIM_UNAVAILABLE/,
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.delivery_days where subscription_id=$1",
        [record.id],
      )
    ).rows[0].n,
    3,
  );
  evidence.push(
    "Paid pilot: two concurrent 30-customer imports accept one batch atomically at capacity; two concurrent account claims accept one identity and preserve all deliveries.",
  );
  // A pending checkout and claim for overlapping dates serialize on the account.
  const racePackage = await cmd(
    "package.save",
    {
      catererId: K[0],
      slug: "pilot-claim-checkout-race",
      offer: {
        ...base,
        status: "published",
        days: 3,
        capacity: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, 30])),
      },
    },
    U.owner,
  );
  const r = { ...row(99), packageId: racePackage.id };
  const preview = await cmd(
      "import.preview",
      { catererId: K[0], rows: [r] },
      U.owner,
    ),
    imported = await cmd(
      "import.commit",
      { catererId: K[0], id: preview.id },
      U.owner,
    );
  const inv = await cmd(
    "customer.invite",
    {
      catererId: K[0],
      customerRecordId: imported.subscriptions[0].customerRecordId,
    },
    U.owner,
  );
  const who = crypto.randomUUID();
  await pool.query("insert into v1.profiles values($1,$2,$3)", [
    who,
    "Checkout race",
    "customer",
  ]);
  const ad = (
    await pool.query(
      "insert into v1.addresses(user_id,label,line,area,city) values($1,$2,$3,$4,$5) returning id",
      [who, "Test", address.line, address.area, address.city],
    )
  ).rows[0].id;
  const client = await pool.connect();
  let claimPromise;
  try {
    await client.query("begin");
    await client.query(
      `select set_config('request.jwt.claims','{"role":"service_role"}',true)`,
    );
    claimPromise = client
      .query("select public.catera_v1_system($1,$2) value", [
        "pilot.claim",
        {
          userId: who,
          token: inv.path.split("/").at(-1),
          verifiedPhone: r.customer.phone,
          requestId: crypto.randomUUID(),
        },
      ])
      .then(async (result) => {
        await client.query("commit");
        return result.rows[0].value;
      });
    const results = await Promise.allSettled([
      claimPromise,
      cmd(
        "checkout.create",
        { packageId: racePackage.id, addressId: ad, portions: 1, startDate },
        who,
      ),
    ]);
    assert.equal(results[0].status, "fulfilled");
    if (results[0].value.status === "claimed") {
      assert.equal(results[1].status, "rejected");
      assert.match(results[1].reason.message, /OVERLAP/);
    } else {
      assert.equal(results[0].value.status, "review");
      assert.equal(results[1].status, "fulfilled");
    }
  } finally {
    await client.query("rollback");
    client.release();
  }
  evidence.push(
    "Paid pilot: claim/checkout race either binds the obligation and rejects overlap or preserves the pending checkout and places the claim in review.",
  );
}
