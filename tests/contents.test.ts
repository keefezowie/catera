import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
  PACKAGE_IDS as P,
  ADDRESS_ID,
} from "../packages/backend/src/seed";
import { localBootstrap, seedSQL } from "../packages/backend/src/seed";
import {
  addDays,
  localDay,
  offerSchema,
  menuSummary,
  menuItems,
  nutritionSummary,
  type Offer,
  type SellerState,
  type CustomerState,
  type Checkout,
} from "@catera/domain";
let db: PGlite, base: Offer;
const read = <T>(resource: string, params = {}, actor: string = U.customer) =>
  localRpc<T>(db, actor, "catera_v1_read", [resource, params]);
const command = <T = { id: string; contentRevision: number }>(
  action: string,
  payload: unknown,
  actor: string = U.owner,
  id = crypto.randomUUID(),
) => localRpc<T>(db, actor, "catera_v1_command", [action, payload, id]);
beforeAll(async () => {
  db = await createDemoDatabase(true);
  base = (await read<{ items: Offer[] }>("catalog")).items.find(
    (o) => o.id === P[0],
  )!;
});
afterAll(async () => db?.close());
function contents(box = false) {
  return {
    ...base,
    packageType: box ? ("nasi_box" as const) : ("ala_carte" as const),
    menus: [
      {
        meal: "lunch",
        name: "Ayam, tempe",
        description: "Data sintetis",
        image: "",
        composition: box ? [{ id: "lauk", name: "Lauk", slots: 2 }] : [],
        items: [
          {
            id: "chicken",
            name: "Ayam",
            description: "",
            image: "",
            serving: "150 g",
            ...(box ? { groupId: "lauk" } : {}),
          },
          {
            id: "tempe",
            name: "Tempe",
            description: "",
            image: "",
            serving: "2 potong",
            ...(box ? { groupId: "lauk" } : {}),
          },
        ],
        nutrition: { proteinG: 40, carbsG: 0 },
      },
    ],
  };
}
async function create(box = false) {
  const offer = contents(box);
  const r = await command("package.save", {
    catererId: K[0],
    slug: "synthetic-contents-" + crypto.randomUUID(),
    offer,
  });
  return { ...r, offer };
}
const input = (packageId: string) => ({
  packageId,
  addressId: ADDRESS_ID,
  portions: 2,
  startDate: addDays(localDay(), 30),
  trial: false,
  promo: "",
  invite: "",
});
it("seeds customer demo offers with real package, menu and dish structure", async () => {
  const catalog = await read<{ items: Offer[] }>("catalog");
  expect(catalog.items).toHaveLength(6);
  expect(catalog.items.every((offer) => offer.packageType)).toBe(true);

  const box = catalog.items.find((offer) => offer.id === P[0])!;
  expect(box.packageType).toBe("nasi_box");
  expect(box.menus[0].composition).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ categoryId: "rice", slots: 1 }),
      expect.objectContaining({ categoryId: "main", slots: 1 }),
    ]),
  );
  expect(box.menus[0].items).toHaveLength(0);
  expect(box.menus[0].contentModel).toBe("slots");

  const alaCarte = catalog.items.find((offer) => offer.id === P[4])!;
  expect(alaCarte.packageType).toBe("ala_carte");
  expect(alaCarte.menus[0].items).toHaveLength(0);
  expect(alaCarte.menus[0].composition?.reduce((n, g) => n + g.slots, 0)).toBe(4);

  const combined = catalog.items.find((offer) => offer.id === P[2])!;
  expect(combined.meal).toBe("both");
  expect(combined.menus.map((menu) => menu.meal)).toEqual(["lunch", "dinner"]);
  expect(combined.menus.every(m => m.contentModel === "slots" && m.items?.length === 0 && m.nutrition === null)).toBe(true);
});
it("validates complete dishes, box slots, custom components and partial/zero nutrition", () => {
  expect(offerSchema.safeParse(contents()).success).toBe(true);
  const box = contents(true);
  box.menus[0].composition[0].name = "Camilan khusus";
  expect(offerSchema.safeParse(box).success).toBe(true);
  expect(nutritionSummary({ proteinG: 40, carbsG: 0 })).toContain(
    "0 g karbohidrat",
  );
  expect(nutritionSummary(null)).toBe("");
  box.menus[0].composition[0].slots = 3;
  expect(offerSchema.safeParse(box).success).toBe(false);
  expect(offerSchema.safeParse({ ...box, status: "draft" }).success).toBe(true);
  expect(
    offerSchema.safeParse({
      ...contents(),
      menus: [{ ...contents().menus[0], nutrition: { proteinG: -1 } }],
    }).success,
  ).toBe(false);
  expect(
    offerSchema.safeParse({
      ...contents(),
      menus: [{ ...contents().menus[0], nutrition: { proteinG: Infinity } }],
    }).success,
  ).toBe(false);
});
it("adapts legacy menus without inferring contents or type", () => {
  const legacy = {
    meal: "lunch" as const,
    name: "Legacy menu",
    description: "A menu saved before structured contents were introduced.",
    image: "",
  };
  expect(menuItems(legacy)).toHaveLength(1);
  expect(menuItems(legacy)[0].name).toBe(legacy.name);
  expect(menuSummary(contents(true).menus[0])).toContain("Lauk: Ayam (150 g)");
});
it("creates structured offers and reserves whole portions, including combined meals", async () => {
  const { id } = await create(true);
  const c = await command<Checkout>("checkout.create", input(id), U.customer);
  expect(c.quote.offer.contentRevision).toBe(1);
  expect(c.quote.offer.menus[0].items).toHaveLength(2);
  expect(c.quote.subtotal).toBe(base.price * 2 * base.days);
  const reservations = await db.query<{ portions: number }>(
    "select portions from v1.reservations where checkout_id=$1",
    [c.id],
  );
  expect(reservations.rows.every((r) => r.portions === 2)).toBe(true);
  const offer = {
    ...contents(),
    meal: "both",
    menus: [
      contents().menus[0],
      { ...contents().menus[0], meal: "dinner", nutrition: null },
    ],
  };
  const both = await command("package.save", {
    catererId: K[0],
    slug: "both-" + crypto.randomUUID(),
    offer,
  });
  const c2 = await command<Checkout>(
    "checkout.create",
    input(both.id),
    U.customer,
  );
  await command("checkout.demo_pay", { id: c2.id }, U.customer);
  const r = await db.query<{ n: number }>(
    "select count(*)::int n from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id where d.subscription_id=(select subscription_id from v1.checkouts where id=$1)",
    [c2.id],
  );
  expect(r.rows[0].n).toBe(c2.quote.dates.length * 2);
});
it("isolates dated menus by purchased revision, clears nutrition and preserves snapshots", async () => {
  const { id } = await create(true);
  const c = await command<Checkout>("checkout.create", input(id), U.customer);
  await command("checkout.demo_pay", { id: c.id }, U.customer);
  const snapshot = JSON.stringify(
    (await read<CustomerState>("customer")).subscriptions.find(
      (s) => s.package_id === id,
    )!.snapshot,
  );
  const current = (await read<{ items: Offer[] }>("catalog")).items.find(
    (o) => o.id === id,
  )!;
  const next = {
    ...current,
    menus: [
      {
        ...current.menus[0],
        items: current.menus[0].items!.map((i) => ({
          ...i,
          name: i.name + " baru",
        })),
      },
    ],
  };
  await command("package.save", {
    catererId: K[0],
    id,
    version: current.version,
    offer: next,
  });
  const date = c.quote.dates[0],
    details = {
      ...c.quote.offer.menus[0],
      nutrition: null,
      items: c.quote.offer.menus[0].items!.map((i) => ({
        ...i,
        name: i.name + " pengganti",
      })),
    };
  await command("menu.save", {
    catererId: K[0],
    packageId: id,
    date,
    meal: "lunch",
    contentRevision: 1,
    version: 0,
    details,
  });
  const customer = await read<CustomerState>("customer");
  const d = customer.deliveries.find(
    (d) => d.offer.id === id && d.service_date === date,
  )!;
  expect(d.offer.menus[0].items![0].name).toContain("pengganti");
  expect(d.offer.menus[0].nutrition).toBeNull();
  expect(d.offer.menus[0].source).toBe("dated");
  expect(
    JSON.stringify(
      customer.subscriptions.find((s) => s.package_id === id)!.snapshot,
    ),
  ).toBe(snapshot);
  const seller = await read<SellerState>("seller", { id: K[0], date }, U.owner);
  expect(
    seller
      .contentRevisions!.filter((r) => r.packageId === id)
      .map((r) => r.revision)
      .sort(),
  ).toEqual([1, 2]);
  const noticeCount = (
    await db.query<{ n: number }>(
      "select count(*)::int n from v1.notifications where user_id=$1",
      [U.customer],
    )
  ).rows[0].n;
  await command("menu.save", {
    catererId: K[0],
    packageId: id,
    date,
    meal: "lunch",
    contentRevision: 2,
    version: 0,
    details: { ...next.menus[0], nutrition: null },
  });
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from v1.notifications where user_id=$1",
        [U.customer],
      )
    ).rows[0].n,
  ).toBe(noticeCount);
  expect(
    (await read<CustomerState>("customer")).deliveries.find(
      (x) => x.id === d.id,
    )!.offer.menus[0],
  ).toEqual(d.offer.menus[0]);
  await expect(
    command("menu.save", {
      catererId: K[0],
      packageId: id,
      date,
      meal: "lunch",
      contentRevision: 1,
      version: 0,
      details,
    }),
  ).rejects.toThrow("CONFLICT");
  await expect(
    command("menu.save", {
      catererId: K[0],
      packageId: id,
      date,
      meal: "lunch",
      contentRevision: 2,
      version: 1,
      details: {
        ...details,
        composition: [{ id: "lauk", name: "Changed", slots: 2 }],
      },
    }),
  ).rejects.toThrow("COMPOSITION_CHANGED");
  const frozen = await command<{ id: string }>("production.freeze", {
    catererId: K[0],
    date,
  });
  const before = (
    await db.query<{ entries: unknown }>(
      "select entries from v1.production where id=$1",
      [frozen.id],
    )
  ).rows[0].entries;
  await command("menu.save", {
    catererId: K[0],
    packageId: id,
    date,
    meal: "lunch",
    contentRevision: 1,
    version: 1,
    details: { ...details, nutrition: { proteinG: 50 } },
  });
  expect(
    (
      await db.query<{ entries: unknown }>(
        "select entries from v1.production where id=$1",
        [frozen.id],
      )
    ).rows[0].entries,
  ).toEqual(before);
});
it("retains purchased contents when a structured trial changes delivery date", async () => {
  const { id } = await create(true);
  const checkout = await command<Checkout>(
    "checkout.create",
    { ...input(id), trial: true, startDate: addDays(localDay(), 90) },
    U.customer,
  );
  expect(checkout.quote.dates).toHaveLength(1);
  await command("checkout.demo_pay", { id: checkout.id }, U.customer);
  const date = checkout.quote.dates[0],
    replacement = addDays(date, 7);
  const customer = await read<CustomerState>("customer", {
    from: date,
    to: replacement,
  });
  const delivery = customer.deliveries.find((d) => d.offer.id === id)!;
  const details = {
    ...checkout.quote.offer.menus[0],
    nutrition: null,
    items: checkout.quote.offer.menus[0].items!.map((i) => ({
      ...i,
      name: i.name + " tanggal baru",
    })),
  };
  await command("menu.save", {
    catererId: K[0],
    packageId: id,
    date: replacement,
    meal: "lunch",
    contentRevision: 1,
    version: 0,
    details,
  });
  await command(
    "delivery.reschedule",
    { id: delivery.id, version: delivery.version, date: replacement },
    U.customer,
  );
  const updated = await read<CustomerState>("customer", {
    from: date,
    to: replacement,
  });
  const moved = updated.deliveries.find((d) => d.id === delivery.id)!;
  expect(moved.service_date).toBe(replacement);
  expect(moved.offer.contentRevision).toBe(1);
  expect(moved.offer.menus[0].items![0].name).toContain("tanggal baru");
  expect(
    updated.subscriptions.find((s) => s.package_id === id)!.snapshot,
  ).toEqual(customer.subscriptions.find((s) => s.package_id === id)!.snapshot);
  const reservation = (
    await db.query<{ service_date: string; portions: number }>(
      "select service_date::text,portions from v1.reservations where checkout_id=$1 and state='confirmed'",
      [checkout.id],
    )
  ).rows;
  expect(reservation).toEqual([{ service_date: replacement, portions: 2 }]);
});
it("rejects malformed contents through direct SQL and unauthorized or stale edits", async () => {
  for (const offer of [
    {
      ...contents(),
      menus: [{ ...contents().menus[0], nutrition: { proteinG: -1 } }],
    },
    { ...contents(true), menus: [{ ...contents(true).menus[0], items: [] }] },
    { ...contents(), menus: [] },
    {
      ...contents(),
      menus: [{ ...contents().menus[0], items: [{ id: "x", name: "" }] }],
    },
  ]) {
    await expect(
      command("package.save", {
        catererId: K[0],
        slug: crypto.randomUUID(),
        offer,
      }),
    ).rejects.toThrow("INVALID_INPUT");
  }
  const { id } = await create();
  const current = (await read<{ items: Offer[] }>("catalog")).items.find(
    (o) => o.id === id,
  )!;
  await expect(
    command("package.save", {
      catererId: K[0],
      id,
      version: current.version - 1,
      offer: current,
    }),
  ).rejects.toThrow("CONFLICT");
  await expect(
    command("package.save", {
      catererId: K[1],
      id,
      version: current.version,
      offer: current,
    }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    command(
      "package.save",
      { catererId: K[0], id, version: current.version, offer: current },
      U.customer,
    ),
  ).rejects.toThrow("FORBIDDEN");
});
it("upgrades populated legacy data without changing pending quotes or purchase/production snapshots", async () => {
  const old = new PGlite();
  await old.waitReady;
  try {
    await old.exec(localBootstrap);
    for (const file of [
      "202609090001_marketplace.sql",
      "202609090002_services.sql",
      "202609090003_hardening.sql",
    ])
      await old.exec(await readFile("supabase/migrations/" + file, "utf8"));
    await old.exec(seedSQL());
    const pending = await localRpc<Checkout>(
      old,
      U.customer,
      "catera_v1_command",
      ["checkout.create", input(P[4]), crypto.randomUUID()],
    );
    const before = (
      await old.query("select snapshot from v1.subscriptions order by id")
    ).rows;
    const date = (
      await old.query<{ date: string }>(
        "select min(d.service_date)::text date from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.package_id=$1",
        [P[0]],
      )
    ).rows[0].date;
    await localRpc(old, U.owner, "catera_v1_command", [
      "production.freeze",
      { catererId: K[0], date },
      crypto.randomUUID(),
    ]);
    const production = (
      await old.query("select entries from v1.production order by id")
    ).rows;
    await old.exec(
      await readFile(
        "supabase/migrations/20260910120930_package_contents.sql",
        "utf8",
      ),
    );
    expect(
      (await old.query("select snapshot from v1.subscriptions order by id"))
        .rows,
    ).toEqual(before);
    expect(
      (await old.query("select entries from v1.production order by id")).rows,
    ).toEqual(production);
    expect(
      (
        await old.query<{ quote: unknown }>(
          "select quote from v1.checkouts where id=$1",
          [pending.id],
        )
      ).rows[0].quote,
    ).toEqual(pending.quote);
    await localRpc(old, U.customer, "catera_v1_command", [
      "checkout.demo_pay",
      { id: pending.id },
      crypto.randomUUID(),
    ]);
    expect(
      (
        await old.query<{ state: string }>(
          "select state from v1.checkouts where id=$1",
          [pending.id],
        )
      ).rows[0].state,
    ).toBe("paid");
  } finally {
    await old.close();
  }
});
