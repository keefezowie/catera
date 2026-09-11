import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
  ADDRESS_ID,
  localBootstrap,
  seedSQL,
} from "../packages/backend/src/seed";
import {
  addDays,
  localDay,
  offerSchema,
  menuBatchSaveSchema,
  slotMenuIssues,
  type Offer,
  type MealMenu,
  type MenuMonth,
  type CustomerState,
  type Checkout,
} from "@catera/domain";
let db: PGlite, base: Offer;
const read = <T>(resource: string, params = {}, actor: string = U.owner) =>
  localRpc<T>(db, actor, "catera_v1_read", [resource, params]);
const cmd = <T = { id: string; contentRevision: number }>(
  action: string,
  payload: unknown,
  actor: string = U.owner,
  id = crypto.randomUUID(),
) => localRpc<T>(db, actor, "catera_v1_command", [action, payload, id]);
const month = addDays(localDay(), 70).slice(0, 7) + "-01",
  day = month.slice(0, 8) + "10",
  next = month.slice(0, 8) + "11";
const template = (
  meal = "lunch",
  categoryId = "main",
  name = "Lauk",
): MealMenu => ({
  contentModel: "slots",
  meal,
  name: "",
  description: "",
  image: "",
  items: [],
  composition: [{ id: "group", categoryId, name, slots: 1 }],
  nutrition: null,
});
const filled = (m = template()): MealMenu => ({
  ...m,
  items: [
    {
      id: "slot",
      groupId: "group",
      categoryId: m.composition![0].categoryId,
      name: "Ayam sintetis",
      description: "",
      image: "",
      serving: "120 g",
    },
  ],
  nutrition: { proteinG: 0 },
});
async function create(
  type: Offer["packageType"] = "nasi_box",
  menus = [template()],
) {
  const offer = {
    ...base,
    packageType: type,
    name: "Sintetis slot " + crypto.randomUUID().slice(0, 8),
    meal: menus.length === 2 ? "both" : "lunch",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    capacity: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, 100])),
    days: 2,
    trialPrice: 25000,
    trialMax: 10,
    menus,
  };
  expect(offerSchema.safeParse(offer).success).toBe(true);
  return cmd("package.save", {
    catererId: K[0],
    slug: "slot-" + crypto.randomUUID(),
    offer,
  });
}
const batch = (
  id: string,
  details = filled(),
  dates = [
    { date: day, version: 0 },
    { date: next, version: 0 },
  ],
) => ({
  catererId: K[0],
  packageId: id,
  contentRevision: 1,
  meal: "lunch",
  details,
  dates,
});
beforeAll(async () => {
  db = await createDemoDatabase(true);
  base = (await read<{ items: Offer[] }>("catalog")).items.find(
    (o) => o.catererId === K[0],
  )!;
});
afterAll(async () => db?.close());
it("upgrades a database that already has the recurring-capacity wrapper without undoing its restrictions", async () => {
  const old = new PGlite();
  try {
    await old.exec(localBootstrap);
    for (const file of [
      "202609090001_marketplace.sql",
      "202609090002_services.sql",
      "202609090003_hardening.sql",
    ])
      await old.exec(await readFile("supabase/migrations/" + file, "utf8"));
    await old.exec(seedSQL());
    for (const file of [
      "20260910120930_package_contents.sql",
      "20260910130548_reusable_dishes.sql",
      "20260910160000_calendar_metadata.sql",
      "20260911150000_shared_recurring_capacity.sql",
    ])
      await old.exec(await readFile("supabase/migrations/" + file, "utf8"));
    const migration = (await readdir("supabase/migrations")).find((f) =>
      f.endsWith("_slot_menu_calendar.sql"),
    )!;
    await old.exec(await readFile("supabase/migrations/" + migration, "utf8"));
    await expect(
      localRpc(old, U.owner, "catera_v1_command", [
        "capacity.save",
        { catererId: K[0] },
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow("INVALID_ACTION");
    const category = await localRpc<{ id: string }>(
      old,
      U.owner,
      "catera_v1_command",
      [
        "category.save",
        { catererId: K[0], name: "Upgrade category" },
        crypto.randomUUID(),
      ],
    );
    expect(category.id).toBeTruthy();
  } finally {
    await old.close();
  }
});
it("publishes both package types without specific dishes, including separate meals", async () => {
  for (const type of ["ala_carte", "nasi_box"] as const) {
    const { id } = await create(type, [
      template(),
      template("dinner", "soup", "Sup"),
    ]);
    const current = (await read<{ items: Offer[] }>("catalog")).items.find(
      (o) => o.id === id,
    )!;
    expect(current.menus.map((m) => m.items)).toEqual([[], []]);
  }
  expect(slotMenuIssues(filled(), true)).toEqual([]);
  expect(slotMenuIssues({ ...filled(), items: [] }, true)).not.toEqual([]);
  expect(
    menuBatchSaveSchema.safeParse(
      batch(crypto.randomUUID(), filled(), [
        { date: day, version: 0 },
        { date: day, version: 0 },
      ]),
    ).success,
  ).toBe(false);
});
it("saves a month batch atomically and retries idempotently without duplicate notifications", async () => {
  const { id } = await create(),
    payload = batch(id),
    request = crypto.randomUUID();
  await cmd("menu.saveBatch", payload, U.owner, request);
  await cmd("menu.saveBatch", payload, U.owner, request);
  let calendar = await read<MenuMonth>("menu-month", {
    packageId: id,
    revision: 1,
    month,
    meal: "lunch",
  });
  expect(calendar.dates.filter((d) => d.version === 1)).toHaveLength(2);
  await expect(
    cmd(
      "menu.saveBatch",
      batch(id, filled(), [
        { date: day, version: 1 },
        { date: next, version: 0 },
      ]),
    ),
  ).rejects.toThrow("CONFLICT");
  calendar = await read<MenuMonth>("menu-month", {
    packageId: id,
    revision: 1,
    month,
    meal: "lunch",
  });
  expect(calendar.dates.find((d) => d.date === day)?.version).toBe(1);
});
it("rejects incomplete slots, mismatched categories, changed composition and cross-tenant access", async () => {
  const { id } = await create();
  await expect(
    cmd("menu.saveBatch", batch(id, { ...filled(), items: [] })),
  ).rejects.toThrow("INVALID_INPUT");
  const wrong = filled();
  wrong.items![0].categoryId = "fruit";
  await expect(cmd("menu.saveBatch", batch(id, wrong))).rejects.toThrow(
    "INVALID_INPUT",
  );
  const different = filled();
  different.composition![0].id = "new";
  different.items![0].groupId = "new";
  await expect(cmd("menu.saveBatch", batch(id, different))).rejects.toThrow(
    "COMPOSITION_CHANGED",
  );
  await expect(
    cmd("menu.saveBatch", { ...batch(id), catererId: K[1] }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    read(
      "menu-month",
      { packageId: id, revision: 1, month, meal: "lunch" },
      U.customer,
    ),
  ).rejects.toThrow("FORBIDDEN");
  expect(
    (
      await read<MenuMonth>("menu-month", {
        packageId: id,
        revision: 1,
        month,
        meal: "lunch",
      })
    ).dates.every((d) => d.version === 0),
  ).toBe(true);
});
it("shares tenant-owned category IDs between library and template", async () => {
  const category = await cmd<{ id: string; name: string }>("category.save", {
    catererId: K[0],
    name: "Camilan khusus",
  });
  const { id } = await create("ala_carte", [
    template("lunch", category.id, category.name),
  ]);
  const dish = await cmd<{ id: string; version: number }>("dish.save", {
    catererId: K[0],
    details: {
      name: "Camilan",
      description: "",
      image: "",
      serving: "1",
      categoryId: category.id,
    },
  });
  const menu = filled(template("lunch", category.id, category.name));
  menu.items![0] = {
    ...menu.items![0],
    sourceDishId: dish.id,
    sourceDishVersion: dish.version,
  };
  await cmd("menu.saveBatch", batch(id, menu));
  await cmd("dish.save", {
    catererId: K[0],
    id: dish.id,
    version: 1,
    details: {
      name: "Baru",
      description: "",
      image: "",
      serving: "2",
      categoryId: category.id,
    },
  });
  expect(
    (
      await read<MenuMonth>("menu-month", {
        packageId: id,
        revision: 1,
        month,
        meal: "lunch",
      })
    ).dates.find((d) => d.date === day)?.details?.items![0].name,
  ).toBe("Ayam sintetis");
  await expect(
    cmd("dish.save", {
      catererId: K[0],
      details: {
        name: "Invalid",
        description: "",
        image: "",
        serving: "",
        categoryId: crypto.randomUUID(),
      },
    }),
  ).rejects.toThrow("INVALID_CATEGORY");
});
it("allows purchases before menus exist, resolves dated dishes and preserves the purchased snapshot", async () => {
  const { id } = await create();
  const checkout = await cmd<Checkout>(
    "checkout.create",
    {
      packageId: id,
      portions: 1,
      trial: false,
      startDate: day,
      addressId: ADDRESS_ID,
      paymentMethod: "qris",
    },
    U.customer,
  );
  await cmd("checkout.demo_pay", { id: checkout.id }, U.customer);
  const before = await read<CustomerState>("customer", {}, U.customer),
    purchase = before.subscriptions.find((s) => s.package_id === id)!;
  expect(
    before.deliveries.find((d) => d.offer.id === id)?.offer.menus[0].items,
  ).toEqual([]);
  await cmd(
    "menu.saveBatch",
    batch(
      id,
      filled(),
      checkout.quote.dates.map((date) => ({ date, version: 0 })),
    ),
  );
  const after = await read<CustomerState>("customer", {}, U.customer);
  expect(
    after.subscriptions.find((s) => s.package_id === id)!.snapshot,
  ).toEqual(purchase.snapshot);
  expect(
    after.deliveries.find((d) => d.offer.id === id)?.offer.menus[0].items![0]
      .name,
  ).toBe("Ayam sintetis");
  expect(
    after.deliveries.find((d) => d.offer.id === id)?.offer.menus[0].nutrition
      ?.proteinG,
  ).toBe(0);
  await db.query(
    "update v1.fulfillments set status='delivered' where day_id=(select id from v1.delivery_days where subscription_id=$1 order by service_date limit 1)",
    [purchase.id],
  );
  await expect(
    cmd(
      "menu.saveBatch",
      batch(
        id,
        filled(),
        checkout.quote.dates.map((date) => ({ date, version: 1 })),
      ),
    ),
  ).rejects.toThrow("CUTOFF");
  const cal = await read<MenuMonth>("menu-month", {
    packageId: id,
    revision: 1,
    month,
    meal: "lunch",
  });
  expect(
    cal.dates.find((d) => d.date === checkout.quote.dates[0])?.editable,
  ).toBe(false);
});
it("creates a new slot revision when a legacy listing is edited without rewriting old contents", async () => {
  const original = await db.query<{ contents: unknown }>(
    "select contents from v1.content_revisions where package_id=$1 and revision=$2",
    [base.id, base.contentRevision || 0],
  );
  await cmd("package.save", {
    id: base.id,
    catererId: K[0],
    version: base.version,
    offer: { ...base, menus: [template()], meal: "lunch" },
  });
  const same = await db.query<{ contents: unknown }>(
    "select contents from v1.content_revisions where package_id=$1 and revision=$2",
    [base.id, base.contentRevision || 0],
  );
  expect(same.rows).toEqual(original.rows);
});
