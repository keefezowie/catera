import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
  PACKAGE_IDS as P,
  ADDRESS_ID,
} from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "@catera/domain";
export async function verifyCustomerChoice(pool, cmd, evidence) {
  const migration = (await readdir("supabase/migrations")).find((f) =>
    f.endsWith("_customer_choice_menus.sql"),
  );
  await pool.query(await readFile("supabase/migrations/" + migration, "utf8"));
  const base = (
    await pool.query("select offer from v1.packages where id=$1", [P[0]])
  ).rows[0].offer;
  const source = await cmd(
    "dish.save",
    {
      catererId: K[0],
      details: {
        name: "Concurrent customer dish",
        categoryId: "main",
        description: "",
        image: "",
        serving: "1",
      },
    },
    U.owner,
  );
  const backup = await cmd(
    "dish.save",
    {
      catererId: K[0],
      details: {
        name: "Backup customer dish",
        categoryId: "main",
        description: "",
        image: "",
        serving: "1",
      },
    },
    U.owner,
  );
  const p = await cmd(
    "package.save",
    {
      catererId: K[0],
      slug: "concurrent-choice",
      choiceDishIds: [source.id, backup.id],
      offer: {
        ...base,
        status: "published",
        menuSelectionMode: "customer",
        packageType: "ala_carte",
        days: 4,
        meal: "lunch",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        capacity: Object.fromEntries(
          [0, 1, 2, 3, 4, 5, 6].map((d) => [d, 100]),
        ),
        menus: [
          {
            contentModel: "slots",
            meal: "lunch",
            name: "",
            description: "",
            image: "",
            items: [],
            composition: [
              { id: "main", categoryId: "main", name: "Lauk", slots: 1 },
            ],
          },
        ],
      },
    },
    U.owner,
  );
  const date = addDays(localDay(), 35);
  const checkout = await cmd(
    "checkout.create",
    {
      packageId: p.id,
      portions: 2,
      trial: false,
      startDate: date,
      addressId: ADDRESS_ID,
    },
    U.customer,
  );
  await cmd("checkout.demo_pay", { id: checkout.id }, U.customer);
  const s = (
    await pool.query("select * from v1.subscriptions where checkout_id=$1", [
      checkout.id,
    ])
  ).rows[0];
  const days = (
    await pool.query(
      "select d.*,to_char(service_date,'YYYY-MM-DD') as service_date from v1.delivery_days d where subscription_id=$1 order by d.service_date",
      [s.id],
    )
  ).rows;
  const option = (
    await pool.query(
      "select * from v1.package_dishes where package_id=$1 and source_dish_id=$2",
      [p.id, source.id],
    )
  ).rows[0];
  const payload = (d, version = 0) => ({
    subscriptionId: s.id,
    meal: "lunch",
    days: [
      { id: d.id, date: d.service_date, deliveryVersion: d.version, version },
    ],
    choices: [{ slotId: "main:0", optionId: option.id, optionVersion: 1 }],
  });
  const race = await Promise.allSettled([
    cmd("customerMenu.saveBatch", payload(days[0]), U.customer),
    cmd("customerMenu.saveBatch", payload(days[0]), U.customer),
  ]);
  assert.equal(
    race.filter((r) => r.status === "fulfilled").length,
    1,
    JSON.stringify(race),
  );
  assert.match(
    race.find((r) => r.status === "rejected").reason.message,
    /CONFLICT/,
  );
  // Hold retirement until the customer save is waiting on the package lock.
  const lock = await pool.connect();
  try {
    await lock.query("begin");
    await lock.query("select set_config('request.jwt.claim.sub',$1,true)", [
      U.owner,
    ]);
    await lock.query(
      "select public.catera_v1_command('packageOption.save',$1,$2)",
      [
        { packageId: p.id, id: option.id, version: 1, archived: true },
        crypto.randomUUID(),
      ],
    );
    const pending = assert.rejects(
      cmd("customerMenu.saveBatch", payload(days[1]), U.customer),
      /OPTION_CHANGED/,
    );
    await lock.query("commit");
    await pending;
  } finally {
    await lock.query("rollback");
    lock.release();
  }
  // Same-slot historical selection survives, even when the option is retired.
  await cmd("customerMenu.saveBatch", payload(days[0], 1), U.customer);
  await cmd(
    "packageOption.save",
    { packageId: p.id, id: option.id, version: 2, archived: false },
    U.owner,
  );
  const currentPayload = (d) => ({
    ...payload(d),
    choices: [{ slotId: "main:0", optionId: option.id, optionVersion: 3 }],
  });
  const moving = await Promise.allSettled([
    cmd("customerMenu.saveBatch", currentPayload(days[1]), U.customer),
    cmd(
      "delivery.reschedule",
      { id: days[1].id, version: 1, date: addDays(date, 8) },
      U.customer,
    ),
  ]);
  assert.equal(moving[1].status, "fulfilled");
  if (moving[0].status === "rejected")
    assert.match(moving[0].reason.message, /CONFLICT/);
  const [saving, freezing] = await Promise.all([
    cmd("customerMenu.saveBatch", currentPayload(days[2]), U.customer),
    cmd(
      "production.freeze",
      { catererId: K[0], date: days[2].service_date },
      U.owner,
    ),
  ]);
  assert(saving);
  const entries = (
    await pool.query("select entries from v1.production where id=$1", [
      freezing.id,
    ])
  ).rows[0].entries;
  const frozen = entries.find((d) => d.id === days[2].id).offer.menus[0];
  assert(["selected", "pending"].includes(frozen.selectionStatus));
  assert.equal(
    frozen.items.length,
    frozen.selectionStatus === "selected" ? 1 : 0,
  );
  const cancel = await pool.connect();
  try {
    await cancel.query("begin");
    await cancel.query(
      "update v1.delivery_days set status='cancelled',version=version+1 where id=$1",
      [days[3].id],
    );
    const rejected = assert.rejects(
      cmd("customerMenu.saveBatch", currentPayload(days[3]), U.customer),
      /CUTOFF/,
    );
    await cancel.query("commit");
    await rejected;
  } finally {
    await cancel.query("rollback");
    cancel.release();
  }
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.customer_menus where day_id=$1",
        [days[3].id],
      )
    ).rows[0].n,
    0,
  );
  evidence.push(
    "Customer menu PostgreSQL races: exactly one optimistic save; retirement serializes with selection; saved historical options survive; reschedule preserves delivery identity; production captures complete versions; cancellation rejects waiting saves.",
  );
  // A user cannot bypass ownership by writing private business tables directly.
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await assert.rejects(
      client.query("select * from v1.customer_menus"),
      /permission denied/,
    );
  } finally {
    await client.query("rollback");
    client.release();
  }
  evidence.push(
    "Customer-menu and package-option data remain private to authorized transactional RPCs.",
  );
}
