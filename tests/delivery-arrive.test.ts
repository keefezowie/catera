import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID as A,
  CATERER_IDS as K,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, deliveryArriveSchema, localDay, type Checkout } from "@catera/domain";
import { setAsideDemoKitchenDay } from "./fixtures/set-aside-demo-day";

type Day = { id: string; service_date: string };
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const today = localDay();
const cmd = (action: string, payload: object, user: string = U.customer, id: string = crypto.randomUUID()) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, id]);
const read = (resource: string, params: object, user: string) =>
  localRpc<any>(db, user, "catera_v1_read", [resource, params]);
const system = (action: string, payload: object = {}) =>
  localRpc<any>(db, null, "catera_v1_system", [action, payload], true);
const q = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const meal = async (id: string, m = "lunch") =>
  (
    await q<{
      status: string;
      arrived_at: string | null;
      arrived_by: string | null;
      arrived_photo: string | null;
      confirmed_by: string | null;
      confirmed_at: string | null;
    }>(
      "select status,arrived_at::text,arrived_by::text,arrived_photo,confirmed_by,confirmed_at::text from v1.fulfillments where day_id=$1 and meal=$2",
      [id, m],
    )
  )[0];
const dayStatus = async (id: string) =>
  (await q<{ status: string }>("select status from v1.delivery_days where id=$1", [id]))[0].status;
const photo = (day: string, m = "lunch", catererId = K[0]) => `${catererId}/${day}/${m}/${crypto.randomUUID()}.jpg`;
const arrive = (ids: string[], user: string = U.owner, over: Record<string, unknown> = {}, id?: string) =>
  cmd(
    "delivery.arrive",
    {
      catererId: K[0],
      date: today,
      meal: "lunch",
      fulfillmentIds: ids,
      photos: Object.fromEntries(ids.map((d) => [d, photo(d)])),
      ...over,
    },
    user,
    id,
  );
const arrivedPushes = () =>
  q<{ dedupe: string }>("select dedupe from v1.outbox where kind='push' and dedupe like 'arrived:%' order by dedupe");

async function buy(packageId: string, start: string): Promise<Day[]> {
  const checkout: Checkout = await cmd("checkout.create", {
    acceptedTerms: true,
    packageId,
    addressId: A,
    portions: 1,
    startDate: start,
    trial: false,
  });
  await cmd("checkout.demo_pay", { id: checkout.id });
  return q<Day>(
    "select d.id,d.service_date::text service_date from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date",
    [checkout.id],
  );
}
/** One day of each purchase moved to today and set on its way, as a departure would. */
async function outToday(day: Day) {
  day.service_date = today;
  await q("update v1.delivery_days set service_date=$2::date,status='out_for_delivery' where id=$1", [day.id, today]);
  await q("update v1.fulfillments set status='out_for_delivery',departed_at=now() where day_id=$1", [day.id]);
}

let both: Day[]; // Rantang Nusantara, lunch and dinner, Dapur Senja
let senja: Day[]; // Ayam Sambal Rumahan, lunch, Dapur Senja
let hijau: Day[]; // Plant-based Everyday, lunch, Hijau Kitchen
let plain: Day, reported: Day, belum: Day; // one Dapur Senja lunch each, for auto-confirm
const otherStaff = crypto.randomUUID();
const otherCustomer = crypto.randomUUID();
beforeAll(async () => {
  db = await createDemoDatabase(true);
  await setAsideDemoKitchenDay(db);
  const start = addDays(today, 30);
  both = await buy(P[2], start);
  senja = await buy(P[4], start);
  hijau = await buy(P[3], start);
  plain = (await buy(P[0], addDays(today, 70)))[0];
  reported = (await buy(P[4], addDays(today, 90)))[0];
  belum = (await buy(P[2], addDays(today, 110)))[0];
  // Another kitchen's staff member and another customer, both synthetic.
  await q("insert into v1.profiles(id,name,role) values($1,'Staf Contoh Lain','owner'),($2,'Pelanggan Contoh Lain','customer')", [
    otherStaff,
    otherCustomer,
  ]);
  await q("insert into v1.staff values($1,$2,'owner')", [K[1], otherStaff]);
});
afterAll(async () => db?.close());

describe("delivery.arrive", () => {
  it("arrive moves selected stops from out_for_delivery and keeps the meal open", async () => {
    await outToday(both[0]);
    await outToday(senja[0]);
    const result = await arrive([both[0].id, senja[0].id]);
    expect(result.arrived).toBe(2);
    expect(Object.keys(result.arrivedAt).sort()).toEqual([both[0].id, senja[0].id].sort());
    for (const day of [both[0], senja[0]]) {
      const row = await meal(day.id);
      expect(row.status).toBe("out_for_delivery");
      expect(row.arrived_at).not.toBeNull();
      expect(row.arrived_by).toBe(U.owner);
      expect(row.arrived_photo).toMatch(new RegExp(`^${K[0]}/${day.id}/lunch/`));
      expect(row.confirmed_by).toBeNull();
      expect(await dayStatus(day.id)).toBe("out_for_delivery");
    }
    // The dinner of the same day was not selected and is untouched.
    expect((await meal(both[0].id, "dinner")).arrived_at).toBeNull();
    // One push for the customer, although two of their packages arrived.
    expect((await arrivedPushes()).map((r) => r.dedupe)).toEqual([`arrived:${U.customer}:${K[0]}:${today}:lunch`]);
    const [note] = await q<{ body: string; href: string }>(
      "select body,href from v1.notifications where user_id=$1 and body like 'Pesananmu sudah diantar%'",
      [U.customer],
    );
    expect(note).toEqual({ body: "Pesananmu sudah diantar. Sudah diterima?", href: "/today" });
  });

  it("a second arrive writes nothing and returns the first arrived_at", async () => {
    const before = await meal(senja[0].id);
    const audits = (await q("select 1 from v1.audit where action='delivery.arrive'")).length;
    const again = await arrive([senja[0].id], U.staff);
    expect(again.arrived).toBe(0);
    expect(Date.parse(again.arrivedAt[senja[0].id])).toBe(Date.parse(before.arrived_at!));
    const after = await meal(senja[0].id);
    expect(after).toEqual(before);
    expect(await q("select 1 from v1.audit where action='delivery.arrive'")).toHaveLength(audits);
    expect(await arrivedPushes()).toHaveLength(1);
    // The same request replays its stored answer; a changed payload under that request is a conflict.
    const request = crypto.randomUUID();
    const first = await arrive([senja[0].id], U.owner, {}, request);
    const payload = {
      catererId: K[0],
      date: today,
      meal: "lunch",
      fulfillmentIds: [senja[0].id],
      photos: { [senja[0].id]: photo(senja[0].id) },
    };
    await expect(cmd("delivery.arrive", payload, U.owner, request)).rejects.toThrow("CONFLICT");
    expect(first.arrived).toBe(0);
  });

  it("arrive rejects ids from another caterer, date or meal", async () => {
    await outToday(hijau[0]);
    const tomorrow = both[1];
    await q("update v1.delivery_days set service_date=$2::date,status='out_for_delivery' where id=$1", [
      tomorrow.id,
      addDays(today, 1),
    ]);
    await q("update v1.fulfillments set status='out_for_delivery' where day_id=$1", [tomorrow.id]);
    const before = await meal(hijau[0].id);
    // Another caterer's stop, listed with Dapur Senja's: nothing at all is marked.
    await expect(arrive([hijau[0].id, both[0].id])).rejects.toThrow("NOT_FOUND");
    expect(await meal(hijau[0].id)).toEqual(before);
    // Another date.
    await expect(arrive([tomorrow.id])).rejects.toThrow("NOT_FOUND");
    expect((await meal(tomorrow.id)).arrived_at).toBeNull();
    // Another meal: Ayam Sambal Rumahan has no dinner.
    await expect(
      arrive([senja[0].id], U.owner, { meal: "dinner", photos: { [senja[0].id]: photo(senja[0].id, "dinner") } }),
    ).rejects.toThrow("NOT_FOUND");
    // A date that is not the Jakarta day itself, and someone who is not the kitchen's staff.
    await expect(arrive([both[0].id], U.owner, { date: addDays(today, 1) })).rejects.toThrow("INVALID_DATE");
    await expect(arrive([both[0].id], U.customer)).rejects.toThrow("FORBIDDEN");
    await expect(arrive([both[0].id], otherStaff)).rejects.toThrow("FORBIDDEN");
    // A stop not yet on its way.
    await q("update v1.fulfillments set status='scheduled' where day_id=$1 and meal='dinner'", [both[0].id]);
    await expect(
      arrive([both[0].id], U.owner, { meal: "dinner", photos: { [both[0].id]: photo(both[0].id, "dinner") } }),
    ).rejects.toThrow("INVALID_STATE");
    await q("update v1.fulfillments set status='out_for_delivery' where day_id=$1 and meal='dinner'", [both[0].id]);
  });

  it("arrive without a photo for every id is rejected", async () => {
    const id = both[0].id;
    const base = { catererId: K[0], date: today, meal: "dinner", fulfillmentIds: [id] };
    for (const photos of [
      {},
      { [id]: "" },
      { [id]: photo(id, "lunch") }, // another meal's folder
      { [id]: photo(id, "dinner", K[1]) }, // another caterer's folder
      { [id]: `${K[0]}/${id}/dinner/../../x.jpg` },
      { [id]: photo(id, "dinner"), [senja[0].id]: photo(senja[0].id, "dinner") }, // a photo for a stop not listed
    ])
      await expect(cmd("delivery.arrive", { ...base, photos }, U.owner)).rejects.toThrow("INVALID_INPUT");
    for (const payload of [
      { ...base, fulfillmentIds: [], photos: {} },
      { ...base, fulfillmentIds: [id, id], photos: { [id]: photo(id, "dinner") } },
      { ...base, photos: { [id]: photo(id, "dinner") }, extra: 1 },
    ])
      await expect(cmd("delivery.arrive", payload, U.owner)).rejects.toThrow("INVALID_INPUT");
    expect((await meal(id, "dinner")).arrived_at).toBeNull();
    // The route's schema says the same before the database is asked.
    expect(deliveryArriveSchema.safeParse({ ...base, photos: {} }).success).toBe(false);
    expect(deliveryArriveSchema.safeParse({ ...base, photos: { [id]: photo(id, "dinner") } }).success).toBe(true);
  });

  it("customer confirm after arrive sets confirmed_by customer", async () => {
    const confirmed = await cmd("delivery.confirm", { deliveryId: senja[0].id, meal: "lunch" });
    expect(confirmed.status).toBe("delivered");
    const row = await meal(senja[0].id);
    expect(row).toMatchObject({ status: "delivered", confirmed_by: "customer" });
    expect(row.arrived_at).not.toBeNull();
    expect(await dayStatus(senja[0].id)).toBe("delivered");
    // Arriving a stop the customer already confirmed marks nothing.
    const again = await arrive([senja[0].id]);
    expect(again.arrived).toBe(0);
    expect(Date.parse(again.arrivedAt[senja[0].id])).toBe(Date.parse(row.arrived_at!));
    expect(await meal(senja[0].id)).toEqual(row);
  });

  it("the workspace can no longer mark a meal delivered itself", async () => {
    await expect(
      cmd(
        "delivery.statusBatch",
        { catererId: K[0], date: today, meal: "dinner", status: "delivered", items: [{ id: both[0].id, version: 1 }] },
        U.owner,
      ),
    ).rejects.toThrow("NOT_ALLOWED");
  });
});

describe("auto-confirm", () => {
  const confirm = (now: string) => system("delivery.autoConfirm", { now });

  it("auto-confirm skips an open report and a Belum mark", async () => {
    // Three Dapur Senja stops of their own purchases, marked Sampai together.
    for (const day of [plain, reported, belum]) await outToday(day);
    expect((await arrive([plain.id, reported.id, belum.id])).arrived).toBe(3);
    const at = Date.parse((await meal(plain.id)).arrived_at!);
    // An open report, and a "Belum" the caterer has since resolved: both keep their meal open.
    const open = await cmd("deliveryIssue.create", { deliveryId: reported.id, meal: "lunch", subject: "Belum sampai", body: "Belum ada pesanan di depan rumah" });
    const late = await cmd("deliveryIssue.create", { deliveryId: belum.id, meal: "lunch", subject: "Belum sampai", body: "Belum ada pesanan di depan rumah" });
    await q("update v1.delivery_issues set status='resolved' where id=$1", [late.id]);
    expect(open.id).toBeTruthy();
    // One minute short of two hours: nothing closes.
    expect(await confirm(new Date(at + 2 * 3600_000 - 60_000).toISOString())).toBe(0);
    expect((await meal(plain.id)).status).toBe("out_for_delivery");
    // Exactly two hours after the mark: the plain stop closes, the reported and the Belum one stay open.
    // The first test's arrived lunch closes in the same run: it was marked a moment earlier.
    expect(await confirm(new Date(at + 2 * 3600_000).toISOString())).toBe(2);
    expect(await meal(both[0].id)).toMatchObject({ status: "delivered", confirmed_by: "auto" });
    expect(await meal(plain.id)).toMatchObject({ status: "delivered", confirmed_by: "auto" });
    expect(await dayStatus(plain.id)).toBe("delivered");
    expect((await meal(reported.id)).status).toBe("out_for_delivery");
    expect((await meal(belum.id)).status).toBe("out_for_delivery");
    // A second run finds nothing new.
    expect(await confirm(new Date(at + 3 * 3600_000).toISOString())).toBe(0);
    // Only the service role runs it.
    await expect(localRpc(db, U.owner, "catera_v1_system", ["delivery.autoConfirm", {}])).rejects.toThrow("FORBIDDEN");
  });

  it("auto-deliver stays the next-morning backstop and holds a meal with an open report", async () => {
    await q("update v1.auto_deliver_policy set since=$1::date", [addDays(today, -400)]);
    await system("delivery.autoDeliver", { today: addDays(today, 1) });
    // The open report holds its meal; the resolved Belum no longer holds the nightly backstop.
    expect((await meal(reported.id)).status).toBe("out_for_delivery");
    expect(await meal(belum.id)).toMatchObject({ status: "delivered", confirmed_by: "auto" });
  });
});

describe("delivery-proof read", () => {
  it("lets the stop's customer and that caterer's staff read the photo, and nobody else", async () => {
    const day = plain.id;
    const { arrived_photo: stored } = await meal(day);
    const params = { deliveryId: day, meal: "lunch" };
    expect(await read("delivery-proof", params, U.customer)).toEqual({ path: stored });
    expect(await read("delivery-proof", params, U.staff)).toEqual({ path: stored });
    await expect(read("delivery-proof", params, otherStaff)).rejects.toThrow("FORBIDDEN");
    await expect(read("delivery-proof", params, otherCustomer)).rejects.toThrow("FORBIDDEN");
    // The storage policy's check agrees, role by role.
    const canRead = async (user: string) =>
      (
        await db.transaction(async (tx) => {
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
          return (await tx.query<{ ok: boolean }>("select v1.can_read_proof($1) ok", [stored])).rows[0].ok;
        })
      );
    expect(await canRead(U.customer)).toBe(true);
    expect(await canRead(U.owner)).toBe(true);
    expect(await canRead(otherStaff)).toBe(false);
    expect(await canRead(otherCustomer)).toBe(false);
    // A meal not yet marked has no photo to read.
    await expect(read("delivery-proof", { deliveryId: hijau[0].id, meal: "lunch" }, U.customer)).rejects.toThrow("NOT_FOUND");
  });

  it("carries the arrival into the customer's delivery read", async () => {
    const state = await read("customer", {}, U.customer);
    const day = state.deliveries.find((d: { id: string }) => d.id === plain.id);
    const lunch = day.meals.find((m: { meal: string }) => m.meal === "lunch");
    expect(lunch.arrived_at).toBeTruthy();
    expect(lunch.arrived_photo).toMatch(new RegExp(`^${K[0]}/`));
  });
});
