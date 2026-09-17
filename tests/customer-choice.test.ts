import { beforeAll, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
  ADDRESS_ID,
} from "../packages/backend/src/seed";
import {
  addDays,
  localDay,
  menuSummary,
  customerMenuSaveSchema,
  type Offer,
  type Checkout,
  type CustomerState,
  type CustomerMenuMonth,
  type PackageDish,
} from "@catera/domain";
let db: PGlite, base: Offer;
const day = addDays(localDay(), 12);
const read = <T>(
  resource: string,
  params = {},
  actor: string | null = U.owner,
) => localRpc<T>(db, actor, "catera_v1_read", [resource, params]);
const cmd = <T = { id: string; version: number }>(
  action: string,
  payload: unknown,
  actor: string = U.owner,
  requestId = crypto.randomUUID(),
) => localRpc<T>(db, actor, "catera_v1_command", [action, payload, requestId]);
beforeAll(async () => {
  db = await createDemoDatabase(true);
  base = (await read<{ items: Offer[] }>("catalog")).items.find(
    (o) => o.catererId === K[0],
  )!;
});
afterAll(async () => db?.close());
it("clears acknowledged fallback tasks without inventing menus or changing delivery obligations", async () => {
  const f = await fixture();
  const dayId = f.payload.days[0].id, date = addDays(localDay(), -2);
  await db.query("update v1.delivery_days set service_date=$2 where id=$1", [dayId, date]);
  const taskId = "choice-" + dayId + "-lunch";
  const attention = () => read<any>("seller-attention", { id: K[0] }, U.owner);
  expect((await attention()).items.some((i: any) => i.id === taskId && i.kind === "choice_fallback")).toBe(true);
  await localRpc(db,null,"catera_v1_system",["maintenance",{}],true);
  const push=(await db.query<any>("select id from v1.outbox where kind='push' and payload->>'choiceDayId'=$1 limit 1",[dayId])).rows[0].id;
  expect(await localRpc(db,null,"catera_v1_system",["notification.eligible",{id:push}],true)).toBe(true);
  const payload = { deliveryId: dayId, meal: "lunch", date, body: "Prepared dishes and informed customer" };
  await expect(cmd("attention.choiceHandled", payload, U.customer)).rejects.toThrow("FORBIDDEN");
  await expect(cmd("attention.choiceHandled", { ...payload, date: addDays(date, 1) }, U.owner)).rejects.toThrow("CONFLICT");
  const key = crypto.randomUUID();
  await cmd("attention.choiceHandled", payload, U.staff, key);
  await cmd("attention.choiceHandled", payload, U.staff, key);
  expect((await attention()).items.some((i: any) => i.id === taskId)).toBe(false);
  expect((await db.query("select 1 from v1.customer_menus where day_id=$1",[dayId])).rows).toHaveLength(0);
  expect((await db.query<any>("select status from v1.delivery_days where id=$1",[dayId])).rows[0].status).toBe("scheduled");
  expect((await db.query("select 1 from v1.choice_fallback_actions where day_id=$1",[dayId])).rows).toHaveLength(1);
  await db.query("update v1.fulfillments set status='delivered' where day_id=$1",[dayId]);
  expect(await localRpc(db,null,"catera_v1_system",["notification.eligible",{id:push}],true)).toBe(false);
});
it("uses purchased timezones at the cutoff boundary", async () => {
  const f = await fixture();
  // Exercise the authoritative helper with composite inputs; purchased terms remain immutable.
  for (const zone of ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]) {
    for (const minutes of [0, 5]) {
      const result = await db.query<{ editable: boolean }>(
        `
        select v1.customer_menu_editable(
          jsonb_populate_record(null::v1.delivery_days,to_jsonb(d)||jsonb_build_object('service_date',t.local_time::date+1)),
          jsonb_populate_record(null::v1.subscriptions,to_jsonb(s)||jsonb_build_object('snapshot',jsonb_set(jsonb_set(s.snapshot,'{offer,timezone}',to_jsonb($2::text)),'{offer,cutoff}',to_jsonb(to_char(t.local_time,'HH24:MI'))))),
          'lunch') as editable
        from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id
        cross join lateral (select (clock_timestamp()+($3::int * interval '1 minute')) at time zone $2 as local_time) t
        where d.id=$1`,
        [f.payload.days[0].id, zone, minutes],
      );
      expect(result.rows[0].editable).toBe(minutes > 0);
    }
  }
});
it("rejects incomplete publication and invalid mode without leaving packages or receipts", async () => {
  const slug = "invalid-choice-" + crypto.randomUUID();
  const payload = {
    catererId: K[0],
    slug,
    offer: { ...base, menuSelectionMode: "customer" },
  };
  await expect(cmd("package.save", payload)).rejects.toThrow(
    "INSUFFICIENT_OPTIONS",
  );
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from v1.packages where slug=$1",
        [slug],
      )
    ).rows[0].n,
  ).toBe(0);
  await expect(
    cmd("package.save", {
      ...payload,
      offer: { ...base, menuSelectionMode: "unknown" },
    }),
  ).rejects.toThrow("INVALID_INPUT");
});
async function fixture(
  type: "nasi_box" | "ala_carte" = "nasi_box",
  both = false,
) {
  const sources = [];
  for (let i = 0; i < 3; i++)
    sources.push(
      await cmd("dish.save", {
        catererId: K[0],
        details: {
          name: "Synthetic choice " + i,
          description: "",
          image: "",
          serving: "120 g",
          categoryId: "main",
        },
      }),
    );
  const offer = {
    ...base,
    menuSelectionMode: "customer",
    packageType: type,
    name: "Choice synthetic",
    days: 2,
    meal: both ? "both" : "lunch",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    capacity: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, 100])),
    menus: (both ? ["lunch", "dinner"] : ["lunch"]).map((meal) => ({
      contentModel: "slots",
      meal,
      name: "",
      description: "",
      image: "",
      items: [],
      composition: [{ id: "main", categoryId: "main", name: "Lauk", slots: 2 }],
    })),
  };
  const p = await cmd("package.save", {
    catererId: K[0],
    slug: "choice-" + crypto.randomUUID(),
    offer,
    choiceDishIds: sources.map((d) => d.id),
  });
  const options = await read<PackageDish[]>(
    "package-options",
    { packageId: p.id },
    null,
  );
  const checkout = await cmd<Checkout>(
    "checkout.create",
    {
      packageId: p.id,
      portions: 3,
      trial: false,
      startDate: day,
      addressId: ADDRESS_ID,
      paymentMethod: "qris",
    },
    U.customer,
  );
  await cmd("checkout.demo_pay", { id: checkout.id }, U.customer);
  const customer = await read<CustomerState>("customer", {}, U.customer);
  const subscription = customer.subscriptions.find(
    (s) => s.package_id === p.id,
  )!;
  const calendar = await read<CustomerMenuMonth>(
    "customer-menu-month",
    {
      subscriptionId: subscription.id,
      month: day.slice(0, 7) + "-01",
      meal: "lunch",
    },
    U.customer,
  );
  const payload = {
    subscriptionId: subscription.id,
    meal: "lunch",
    days: calendar.dates.slice(0, 1).map((d) => ({
      id: d.dayId,
      date: d.date,
      deliveryVersion: d.deliveryVersion,
      version: d.version,
    })),
    choices: options.slice(0, 2).map((o, i) => ({
      slotId: "main:" + i,
      optionId: o.id,
      optionVersion: o.version,
    })),
  };
  return {
    p,
    options,
    sources,
    subscription,
    calendar,
    payload,
    customer,
    offer,
  };
}
it("supports both types, distinct complete menus, all portions, independent meals and immutable purchases", async () => {
  for (const type of ["ala_carte", "nasi_box"] as const) {
    const f = await fixture(type, true);
    expect(f.calendar.dates[0].editable).toBe(true);
    const requestId = crypto.randomUUID();
    const saved = await cmd(
      "customerMenu.saveBatch",
      f.payload,
      U.customer,
      requestId,
    );
    expect(
      await cmd("customerMenu.saveBatch", f.payload, U.customer, requestId),
    ).toEqual(saved);
    const c = await read<CustomerState>("customer", {}, U.customer),
      d = c.deliveries.find((d) => d.id === f.payload.days[0].id)!;
    expect(d.portions).toBe(3);
    expect(d.offer.menus.find((m) => m.meal === "lunch")!.items).toHaveLength(
      2,
    );
    expect(
      d.offer.menus.find((m) => m.meal === "dinner")!.selectionStatus,
    ).toBe("pending");
    expect(
      c.subscriptions.find((s) => s.id === f.subscription.id)!.snapshot,
    ).toEqual(f.subscription.snapshot);
    expect(
      c.notifications.some((n) => n.href.includes(f.subscription.id + "/menu")),
    ).toBe(true);
  }
});
it("rejects incomplete, duplicate, forged, cross-tenant and cross-customer requests", async () => {
  const f = await fixture();
  expect(
    customerMenuSaveSchema.safeParse({
      ...f.payload,
      choices: [{ ...f.payload.choices[0], name: "forged" }],
    }).success,
  ).toBe(false);
  await expect(
    cmd(
      "customerMenu.saveBatch",
      { ...f.payload, choices: f.payload.choices.slice(0, 1) },
      U.customer,
    ),
  ).rejects.toThrow("INVALID_INPUT");
  await expect(
    cmd(
      "customerMenu.saveBatch",
      {
        ...f.payload,
        choices: [
          f.payload.choices[0],
          { ...f.payload.choices[0], slotId: "main:1" },
        ],
      },
      U.customer,
    ),
  ).rejects.toThrow("INVALID_INPUT");
  await expect(
    cmd("customerMenu.saveBatch", f.payload, U.owner),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    read(
      "customer-menu-month",
      {
        subscriptionId: f.subscription.id,
        month: day.slice(0, 7) + "-01",
        meal: "lunch",
      },
      U.owner,
    ),
  ).rejects.toThrow("FORBIDDEN");
  const another = await fixture();
  await expect(
    cmd(
      "customerMenu.saveBatch",
      { ...f.payload, choices: another.payload.choices },
      U.customer,
    ),
  ).rejects.toThrow("OPTION_CHANGED");
  await expect(
    cmd(
      "packageOption.save",
      { packageId: f.p.id, sourceDishId: another.sources[0].id },
      U.customer,
    ),
  ).rejects.toThrow("FORBIDDEN");
  // RPC never trusts names or serving amounts supplied alongside legitimate IDs.
  await cmd(
    "customerMenu.saveBatch",
    {
      ...f.payload,
      choices: f.payload.choices.map((c) => ({
        ...c,
        name: "Forged",
        serving: "999 kg",
      })),
    },
    U.customer,
  );
  const d = (
    await read<CustomerState>("customer", {}, U.customer)
  ).deliveries.find((d) => d.id === f.payload.days[0].id)!;
  expect(d.offer.menus[0].items![0].name).not.toBe("Forged");
  expect(d.offer.menus[0].items![0].serving).toBe("120 g");
});
it("honors saved options after retirement/refresh, rejects stale new choices and insufficient libraries", async () => {
  const f = await fixture();
  await cmd("customerMenu.saveBatch", f.payload, U.customer);
  await cmd("packageOption.save", {
    packageId: f.p.id,
    id: f.options[0].id,
    version: 1,
    archived: true,
  });
  await expect(
    cmd("packageOption.save", {
      packageId: f.p.id,
      id: f.options[1].id,
      version: 1,
      archived: true,
    }),
  ).rejects.toThrow("INSUFFICIENT_OPTIONS");
  await cmd(
    "customerMenu.saveBatch",
    { ...f.payload, days: f.payload.days.map((d) => ({ ...d, version: 1 })) },
    U.customer,
  );
  await expect(
    cmd(
      "customerMenu.saveBatch",
      {
        ...f.payload,
        days: f.calendar.dates.map((d) => ({
          id: d.dayId,
          date: d.date,
          deliveryVersion: d.deliveryVersion,
          version: d.date === day ? 2 : 0,
        })),
      },
      U.customer,
    ),
  ).rejects.toThrow("OPTION_CHANGED");
  const source = f.sources.find((s) => s.id === f.options[1].sourceDishId)!;
  await cmd("dish.save", {
    catererId: K[0],
    id: source.id,
    version: 1,
    details: {
      name: "Changed source",
      description: "",
      image: "",
      serving: "250 g",
      categoryId: "main",
    },
  });
  await cmd("packageOption.save", {
    packageId: f.p.id,
    id: f.options[1].id,
    version: 1,
    refresh: true,
  });
  const c = await read<CustomerState>("customer", {}, U.customer);
  expect(
    c.deliveries.find((d) => d.id === f.payload.days[0].id)!.offer.menus[0]
      .items![1].serving,
  ).toBe("120 g");
});
it("reset preserves version history, rescheduling carries selections, and frozen manifests retain exact menus", async () => {
  const f = await fixture();
  await cmd("customerMenu.saveBatch", f.payload, U.customer);
  const frozen = await cmd("production.freeze", { catererId: K[0], date: day });
  await cmd(
    "delivery.reschedule",
    { id: f.payload.days[0].id, version: 1, date: addDays(day, 4) },
    U.customer,
  );
  const d = (
    await read<CustomerState>("customer", {}, U.customer)
  ).deliveries.find((d) => d.id === f.payload.days[0].id)!;
  expect(d.offer.menus[0].items).toHaveLength(2);
  await expect(
    cmd(
      "customerMenu.resetBatch",
      { ...f.payload, days: f.payload.days.map((d) => ({ ...d, version: 1 })) },
      U.customer,
    ),
  ).rejects.toThrow("CONFLICT");
  await cmd(
    "customerMenu.resetBatch",
    {
      subscriptionId: f.subscription.id,
      meal: "lunch",
      days: [
        {
          id: d.id,
          date: d.service_date,
          deliveryVersion: d.version,
          version: 1,
        },
      ],
    },
    U.customer,
  );
  expect(
    (await read<CustomerState>("customer", {}, U.customer)).deliveries.find(
      (x) => x.id === d.id,
    )!.offer.menus[0].selectionStatus,
  ).toBe("pending");
  const manifest = await localRpc<{ entries: CustomerState["deliveries"] }>(
    db,
    U.owner,
    "catera_v1_manifest",
    [frozen.id],
  );
  expect(
    manifest.entries.find((x) => x.id === d.id)!.offer.menus[0].items,
  ).toHaveLength(2);
});
it("locks at cutoff, retains unchosen portions, rolls back batches and deduplicates notifications", async () => {
  const f = await fixture();
  await db.query(
    "update v1.delivery_days set service_date=current_date-1 where id=$1",
    [f.calendar.dates[1].dayId],
  );
  await expect(
    cmd(
      "customerMenu.saveBatch",
      {
        ...f.payload,
        days: [
          f.payload.days[0],
          {
            id: f.calendar.dates[1].dayId,
            date: addDays(localDay(), -1),
            deliveryVersion: 1,
            version: 0,
          },
        ],
      },
      U.customer,
    ),
  ).rejects.toThrow("CUTOFF");
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from v1.customer_menus where day_id=$1",
        [f.payload.days[0].id],
      )
    ).rows[0].n,
  ).toBe(0);
  const system = () =>
    localRpc(db, null, "catera_v1_system", ["maintenance", {}], true);
  await system();
  const count = (
    await db.query<{ n: number }>(
      "select count(*)::int n from v1.notifications where kind='menu'",
    )
  ).rows[0].n;
  await system();
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from v1.notifications where kind='menu'",
      )
    ).rows[0].n,
  ).toBe(count);
  const d = (
    await read<CustomerState>("customer", {}, U.customer)
  ).deliveries.find((d) => d.id === f.calendar.dates[1].dayId)!;
  expect(d.status).toBe("scheduled");
  expect(d.portions).toBe(3);
  expect(d.offer.menus[0].items).toEqual([]);
  expect(menuSummary(d.offer.menus[0], "en")).toBe("Caterer chooses");
});
