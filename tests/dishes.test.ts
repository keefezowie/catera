import { beforeAll, afterAll, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
  PACKAGE_IDS as P,
  ADDRESS_ID,
  localBootstrap,
  seedSQL,
} from "../packages/backend/src/seed";
import {
  localDay,
  addDays,
  selectLibraryDish,
  dishSaveSchema,
  offerEditorIssues,
  type LibraryDish,
  type SellerState,
  type Offer,
  type Checkout,
} from "@catera/domain";
let db: PGlite, base: Offer;
const read = <T>(resource: string, params = {}, actor: string = U.owner) =>
  localRpc<T>(db, actor, "catera_v1_read", [resource, params]);
const command = <T = LibraryDish>(
  action: string,
  payload: unknown,
  actor: string = U.owner,
  key = crypto.randomUUID(),
) => localRpc<T>(db, actor, "catera_v1_command", [action, payload, key]);
const details = {
  name: "Ayam sintetis",
  description: "Data uji sintetis",
  image: "/assets/food/ayam-panggang.png",
  serving: "150 g",
};
beforeAll(async () => {
  db = await createDemoDatabase(true);
  base = (await read<{ items: Offer[] }>("catalog")).items.find(
    (o) => o.id === P[0],
  )!;
});
afterAll(async () => db?.close());
function offering(dish?: LibraryDish): Offer {
  return {
    ...base,
    packageType: "ala_carte",
    menus: [
      {
        meal: "lunch",
        name: details.name,
        description: "",
        image: "",
        items: [
          dish
            ? selectLibraryDish({ id: "slot", ...details }, dish)
            : { id: "slot", ...details },
        ],
        composition: [],
        nutrition: { proteinG: 32, carbsG: 0 },
      },
    ],
  };
}
it("guards all required steps and permits incomplete drafts without permitting publication", () => {
  const blank = {
    ...base,
    name: "",
    description: "",
    image: "",
    packageType: null,
    menus: [],
    status: "draft",
  };
  expect(offerEditorIssues(blank, true)).toEqual([]);
  expect(offerEditorIssues(blank).map((i) => i.path)).toEqual(
    expect.arrayContaining(["packageType", "name", "description", "image"]),
  );
  expect(offerEditorIssues(offering())).toEqual([]);
  expect(offerEditorIssues({ ...offering(), price: 0 })[0].step).toBe(
    "pricing",
  );
  expect(offerEditorIssues({ ...offering(), weekdays: [] })[0].step).toBe(
    "schedule",
  );
  expect(offerEditorIssues({ ...offering(), trialPrice: -1 })[0].step).toBe(
    "flexibility",
  );
  expect(offerEditorIssues({ ...offering(), name: "a" }, true)[0].step).toBe(
    "offer",
  );
  expect(
    offerEditorIssues({
      ...offering(),
      name: "",
      menus: [{ ...offering().menus[0], nutrition: { proteinG: Infinity } }],
    }).some((i) => i.path === "name"),
  ).toBe(true);
});
it("copies a library dish, preserves slot identity and serving overrides, and refreshes only explicitly", () => {
  const d: LibraryDish = {
    ...details,
    id: crypto.randomUUID(),
    catererId: K[0],
    version: 1,
    archived: false,
  };
  const slot = { id: "lauk-2", ...details, groupId: "lauk" };
  const selected = selectLibraryDish(slot, d);
  const updated = { ...d, name: "Ayam baru", serving: "200 g", version: 2 };
  expect(selected.name).toBe(details.name);
  expect(
    selectLibraryDish({ ...selected, serving: "2 potong" }, updated, true),
  ).toMatchObject({
    id: slot.id,
    groupId: "lauk",
    serving: "2 potong",
    name: updated.name,
    sourceDishVersion: 2,
  });
  expect(
    selectLibraryDish({ ...selected, serving: "2 potong" }, updated, true, true)
      .serving,
  ).toBe("200 g");
});
it("validates and authorizes library writes and rejects stale edits without duplicate audit effects", async () => {
  const payload = { catererId: K[0], details },
    key = crypto.randomUUID();
  const dish = await command("dish.save", payload, U.owner, key);
  expect(await command("dish.save", payload, U.owner, key)).toEqual(dish);
  const updated = await command("dish.save", {
    ...payload,
    id: dish.id,
    version: dish.version,
    details: { ...details, name: "Ayam baru" },
  });
  expect(updated.version).toBe(2);
  await expect(
    command("dish.save", { ...payload, id: dish.id, version: 1 }),
  ).rejects.toThrow("CONFLICT");
  await expect(
    command("dish.archive", {
      catererId: K[1],
      id: dish.id,
      version: 2,
      archived: true,
    }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(command("dish.save", payload, U.customer)).rejects.toThrow(
    "FORBIDDEN",
  );
  await expect(
    command("dish.save", { ...payload, details: { ...details, name: " " } }),
  ).rejects.toThrow("INVALID_INPUT");
  await expect(
    command("dish.save", { ...payload, details: { ...details, serving: 5 } }),
  ).rejects.toThrow("INVALID_INPUT");
  expect(dishSaveSchema.safeParse({ ...payload, id: dish.id }).success).toBe(
    false,
  );
  const archived = await command("dish.archive", {
    catererId: K[0],
    id: dish.id,
    version: 2,
    archived: true,
  });
  expect(archived.archived).toBe(true);
  const seller = await read<SellerState>("seller", { id: K[0] });
  expect(seller.dishes?.find((d) => d.id === dish.id)?.archived).toBe(true);
  expect(
    (
      await db.query("select * from v1.audit where details->>'requestId'=$1", [
        key,
      ])
    ).rows,
  ).toHaveLength(1);
  await expect(
    command("package.save", {
      catererId: K[0],
      slug: "archived-" + crypto.randomUUID(),
      offer: offering(dish),
    }),
  ).rejects.toThrow("INVALID_INPUT");
});
it("leaves package, pending checkout, purchased and frozen production contents unchanged after library edits", async () => {
  const dish = await command("dish.save", { catererId: K[0], details });
  const saved = await command<{ id: string }>("package.save", {
    catererId: K[0],
    slug: "dish-synthetic-" + crypto.randomUUID(),
    offer: offering(dish),
  });
  const input = {
    packageId: saved.id,
    addressId: ADDRESS_ID,
    startDate: addDays(localDay(), 5),
    portions: 2,
    trial: false,
    promotion: "",
  };
  const checkout = await command<Checkout>(
    "checkout.create",
    input,
    U.customer,
  );
  await command("checkout.demo_pay", { id: checkout.id }, U.customer);
  const pending = await command<Checkout>(
    "checkout.create",
    { ...input, startDate: addDays(localDay(), 30) },
    U.customer,
  );
  await command("production.freeze", {
    catererId: K[0],
    date: checkout.quote.dates[0],
  });
  const before = await db.query(
    "select (select jsonb_agg(snapshot) from v1.subscriptions)::text purchases,(select jsonb_agg(quote) from v1.checkouts)::text quotes,(select jsonb_agg(to_jsonb(r)) from v1.content_revisions r)::text revisions,(select jsonb_agg(to_jsonb(r)) from v1.production r)::text production",
  );
  await command("dish.save", {
    catererId: K[0],
    id: dish.id,
    version: dish.version,
    details: { ...details, name: "Ayam revisi" },
  });
  await command("dish.archive", {
    catererId: K[0],
    id: dish.id,
    version: 2,
    archived: true,
  });
  const after = await db.query(
    "select (select jsonb_agg(snapshot) from v1.subscriptions)::text purchases,(select jsonb_agg(quote) from v1.checkouts)::text quotes,(select jsonb_agg(to_jsonb(r)) from v1.content_revisions r)::text revisions,(select jsonb_agg(to_jsonb(r)) from v1.production r)::text production",
  );
  expect(after.rows).toEqual(before.rows);
  expect(pending.quote.offer.menus[0].items?.[0].name).toBe(details.name);
  expect(
    (
      await db.query<{ portions: number }>(
        "select portions from v1.reservations where checkout_id=$1",
        [checkout.id],
      )
    ).rows.every((r) => r.portions === 2),
  ).toBe(true);
});
it("rejects malformed direct package RPC writes and classifies saved drafts before publishing", async () => {
  const payload = {
    catererId: K[0],
    slug: "draft-" + crypto.randomUUID(),
    offer: {
      ...offering(),
      name: "",
      description: "",
      image: "",
      packageType: null,
      menus: [],
      status: "draft",
    },
  };
  const draft = await command<{ id: string }>("package.save", payload);
  await expect(
    command("package.save", {
      ...payload,
      id: draft.id,
      version: 1,
      offer: { ...base, packageType: null, menus: [], status: "published" },
    }),
  ).rejects.toThrow("CLASSIFY_PACKAGE");
  for (const patch of [
    { price: 1000.5 },
    { weekdays: [1.2] },
    { image: "" },
    { capacity: { 1: -1 } },
    { tags: [5] },
  ])
    await expect(
      command("package.save", {
        ...payload,
        offer: { ...offering(), ...patch },
      }),
    ).rejects.toThrow("INVALID_INPUT");
  const foreign = {
    ...offering(),
    menus: [
      {
        ...offering().menus[0],
        items: [
          {
            id: "slot",
            ...details,
            sourceDishId: crypto.randomUUID(),
            sourceDishVersion: 1,
          },
        ],
      },
    ],
  };
  await expect(
    command("package.save", { ...payload, offer: foreign }),
  ).rejects.toThrow("FORBIDDEN");
});
it("upgrades populated synthetic storage without rewriting snapshots or pending quotes", async () => {
  const old = new PGlite();
  try {
    await old.exec(localBootstrap);
    for (const f of [
      "202609090001_marketplace.sql",
      "202609090002_services.sql",
      "202609090003_hardening.sql",
    ])
      await old.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await old.exec(seedSQL());
    const c = await localRpc<Checkout>(old, U.customer, "catera_v1_command", [
      "checkout.create",
      {
        packageId: P[0],
        addressId: ADDRESS_ID,
        startDate: addDays(localDay(), 60),
        portions: 1,
        trial: false,
        promotion: "",
      },
      crypto.randomUUID(),
    ]);
    await localRpc(old, U.customer, "catera_v1_command", [
      "checkout.demo_pay",
      { id: c.id },
      crypto.randomUUID(),
    ]);
    await localRpc(old, U.customer, "catera_v1_command", [
      "checkout.create",
      {
        packageId: P[0],
        addressId: ADDRESS_ID,
        startDate: addDays(localDay(), 100),
        portions: 1,
        trial: false,
        promotion: "",
      },
      crypto.randomUUID(),
    ]);
    const sql =
      "select (select jsonb_agg(snapshot) from v1.subscriptions)::text snapshots,(select jsonb_agg(quote) from v1.checkouts)::text quotes";
    const before = await old.query(sql);
    for (const f of (await readdir("supabase/migrations"))
      .filter(
        (f) =>
          f.endsWith("_package_contents.sql") ||
          f.endsWith("_reusable_dishes.sql"),
      )
      .sort())
      await old.exec(await readFile("supabase/migrations/" + f, "utf8"));
    expect((await old.query(sql)).rows).toEqual(before.rows);
    expect((await old.query("select * from v1.dishes")).rows).toHaveLength(0);
  } finally {
    await old.close();
  }
});
