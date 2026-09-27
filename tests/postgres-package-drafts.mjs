import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { addDays, localDay } from "@catera/domain";
import {
  ADDRESS_ID,
  CATERER_IDS as K,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed.ts";

export async function verifyPackageDrafts(pool, cmd, evidence) {
  const beforeMigration = (
    await pool.query(
      "select id,offer,version,status from v1.packages order by id",
    )
  ).rows;
  await pool.query(
    await readFile(
      "supabase/migrations/20260927105917_partial_package_drafts.sql",
      "utf8",
    ),
  );
  assert.deepEqual(
    (
      await pool.query(
        "select id,offer,version,status from v1.packages order by id",
      )
    ).rows,
    beforeMigration,
  );
  const base = (
    await pool.query("select offer from v1.packages where id=$1", [P[0]])
  ).rows[0].offer;
  const draft = {
    ...base,
    name: "",
    description: "",
    image: "",
    menus: [],
    packageType: null,
    status: "draft",
    price: null,
    capacity: {},
    trialPrice: null,
    trialMax: null,
    tiers: [],
    durationPricing: {
      revision: 0,
      options: [{ cycles: 1, discountPercent: 0 }],
    },
  };
  const valid = async (offer) =>
    (
      await pool.query("select v1.valid_offer($1::jsonb) valid", [
        JSON.stringify(offer),
      ])
    ).rows[0].valid;
  assert.equal(await valid(draft), true);
  for (const invalid of [
    null,
    { ...draft, status: null },
    { ...draft, meal: null },
    { ...draft, capacity: null },
    { ...draft, capacity: { 1: 5 } },
    { ...base, status: "published", price: null },
    { ...base, status: "published", capacity: {} },
  ])
    assert.equal(await valid(invalid), false);
  assert.equal(
    (await pool.query("select v1.valid_offer(null::jsonb) valid")).rows[0]
      .valid,
    false,
  );

  const key = crypto.randomUUID();
  const payload = {
    catererId: K[0],
    slug: "postgres-partial-draft-" + crypto.randomUUID(),
    offer: draft,
  };
  const retries = await Promise.all([
    cmd("package.save", payload, U.owner, key),
    cmd("package.save", payload, U.owner, key),
  ]);
  assert.equal(retries[0].id, retries[1].id);
  const id = retries[0].id;
  const saved = async () =>
    (
      await pool.query(
        "select offer,version,status from v1.packages where id=$1",
        [id],
      )
    ).rows[0];
  assert.equal((await saved()).offer.price, null);
  assert.deepEqual((await saved()).offer.capacity, {});
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.audit where details->>'requestId'=$1",
        [key],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.receipts where actor_id=$1 and request_id=$2",
        [U.owner, key],
      )
    ).rows[0].n,
    1,
  );

  const version = (await saved()).version;
  const edits = await Promise.allSettled(
    [41000, 42000].map((price) =>
      cmd(
        "package.save",
        { catererId: K[0], id, version, offer: { ...draft, price } },
        U.owner,
      ),
    ),
  );
  assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(
    edits.find((r) => r.status === "rejected").reason.message,
    /CONFLICT/,
  );
  const winner = await saved();
  assert([41000, 42000].includes(winner.offer.price));
  assert.deepEqual(winner.offer.capacity, {});

  const effects = async () =>
    (
      await pool.query(`select
    (select count(*) from v1.customer_records)::int customers,
    (select count(*) from v1.checkouts)::int checkouts,
    (select count(*) from v1.subscriptions)::int subscriptions,
    (select count(*) from v1.reservations)::int reservations,
    (select count(*) from v1.allocations)::int allocations,
    (select count(*) from v1.receipts)::int receipts,
    (select count(*) from v1.audit)::int audit,
    (select count(*) from v1.outbox)::int outbox`)
    ).rows[0];
  const beforeFailures = await effects();
  await assert.rejects(
    cmd(
      "package.save",
      {
        catererId: K[0],
        id,
        version: winner.version,
        offer: { ...base, status: "published", price: null, capacity: {} },
      },
      U.owner,
    ),
    /INVALID_INPUT/,
  );
  const purchase = {
    packageId: id,
    addressId: ADDRESS_ID,
    startDate: addDays(localDay(), 35),
    portions: 1,
    trial: false,
  };
  await assert.rejects(
    cmd("checkout.create", { ...purchase, acceptedTerms: true }, U.customer),
    /NOT_AVAILABLE/,
  );
  await assert.rejects(
    pool.query("select v1.quote($1,$2)", [U.customer, purchase]),
    /NOT_AVAILABLE/,
  );
  await assert.rejects(
    cmd(
      "import.preview",
      {
        catererId: K[0],
        rows: [
          {
            ...purchase,
            addressId: undefined,
            customer: {
              name: "Synthetic incomplete draft import",
              phone: "+628190009991",
              address: {
                line: "Synthetic test street 17",
                area: "Jakarta Selatan",
                city: "Jakarta",
                instructions: "",
              },
            },
            remainingDays: 1,
            externalReference: "partial-draft-rejected",
          },
        ],
      },
      U.owner,
    ),
    /NOT_AVAILABLE/,
  );
  assert.deepEqual(await effects(), beforeFailures);
  assert.deepEqual(await saved(), winner);

  await cmd(
    "package.save",
    {
      catererId: K[0],
      id,
      version: winner.version,
      offer: { ...draft, price: null },
    },
    U.owner,
  );
  const cleared = await saved();
  assert.equal(cleared.offer.price, null);
  assert.deepEqual(cleared.offer.capacity, {});
  await cmd(
    "package.save",
    {
      catererId: K[0],
      id,
      version: cleared.version,
      offer: { ...base, status: "published" },
    },
    U.owner,
  );
  const published = await saved();
  assert.equal(published.status, "published");
  assert.equal(published.offer.price, base.price);
  await assert.rejects(
    cmd(
      "package.save",
      { catererId: K[0], id, version: published.version, offer: draft },
      U.owner,
    ),
    /PACKAGE_IMMUTABLE/,
  );
  evidence.push(
    "Partial drafts preserve null price and empty capacity; concurrent retries save once and competing edits reject stale versions. Incomplete publication, quote, checkout and import fail without side effects; completed publication retains immutable terms.",
  );
}
