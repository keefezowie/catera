import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { CATERER_IDS as K, DEMO_ACTORS as U, PACKAGE_IDS as P } from "../packages/backend/src/seed";
import { addDays, localDay, type CustomerState } from "@catera/domain";

// G13: address.delete soft-deletes an unused address; address.replace moves the movable days of an address
// still in use. Each test owns a synthetic customer, so the seeded demo customer's plans never interfere.
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const today = localDay();
const cmd = (action: string, payload: unknown, user: string) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const read = (resource: string, params: object, user: string) =>
  localRpc<any>(db, user, "catera_v1_read", [resource, params]);
const q = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

let starts = 0;
async function customer() {
  const user = crypto.randomUUID();
  await q("insert into v1.profiles(id,name,role) values($1,'Pelanggan Sintetis','customer')", [user]);
  return user;
}
async function address(user: string, label: string, area = "Jakarta Selatan") {
  return (
    await cmd("address.save", { label, line: "Jl. Sintetis No. 7", area, city: "Jakarta", instructions: "" }, user)
  ).id as string;
}
/** Buys a plan and returns its day ids in date order. */
async function buy(user: string, packageId: string, addressId: string) {
  const checkout = await cmd(
    "checkout.create",
    { acceptedTerms: true, packageId, addressId, portions: 1, startDate: addDays(today, 20 + 7 * (starts++ % 3)), trial: false },
    user,
  );
  await cmd("checkout.demo_pay", { id: checkout.id }, user);
  return (
    await q<{ id: string }>(
      "select d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date",
      [checkout.id],
    )
  ).map((d) => d.id);
}
const addressIdOf = async (day: string) =>
  (await q<{ id: string }>("select address->>'id' id from v1.delivery_days where id=$1", [day]))[0].id;
const listed = async (user: string) =>
  ((await read("customer", {}, user)) as CustomerState).addresses.map((a) => a.id);

beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());

it("an unused address is soft-deleted and leaves the list and the pickers", async () => {
  const user = await customer();
  const home = await address(user, "Rumah");
  const office = await address(user, "Kantor");
  expect(await read("address-use", { id: office }, user)).toMatchObject({ count: 0, from: null, to: null, kitchens: [], pendingCheckouts: 0 });
  await expect(cmd("address.delete", { addressId: office }, user)).resolves.toEqual({ id: office, deleted: true });
  expect(await listed(user)).toEqual([home]);
  expect((await q("select archived_at from v1.addresses where id=$1", [office]))[0].archived_at).not.toBeNull();
  await expect(
    cmd("checkout.create", { acceptedTerms: true, packageId: P[0], addressId: office, portions: 1, startDate: addDays(today, 20), trial: false }, user),
  ).rejects.toThrow("NOT_FOUND");
  await expect(read("quote", { packageId: P[0], addressId: office, portions: 1, startDate: addDays(today, 20), trial: false }, user)).rejects.toThrow("NOT_FOUND");
  await expect(
    cmd("address.save", { id: office, version: 2, label: "Kantor", line: "Jl. Sintetis No. 8", area: "Jakarta Selatan", city: "Jakarta" }, user),
  ).rejects.toThrow("NOT_FOUND");
  await expect(read("address-use", { id: office }, user)).rejects.toThrow("NOT_FOUND");
  // Deleting it again is the same answer, not an error.
  await expect(cmd("address.delete", { addressId: office }, user)).resolves.toEqual({ id: office, deleted: true });
});

it("the last address can be deleted when nothing uses it", async () => {
  const user = await customer();
  const only = await address(user, "Satu-satunya");
  await cmd("address.delete", { addressId: only }, user);
  expect(await listed(user)).toEqual([]);
});

it("an address in use cannot be deleted", async () => {
  const user = await customer();
  const home = await address(user, "Rumah");
  const days = await buy(user, P[0], home);
  const dates = (await q<{ d: string }>("select service_date::text d from v1.delivery_days where id=any($1) order by 1", [days])).map((r) => r.d);
  await expect(cmd("address.delete", { addressId: home }, user)).rejects.toThrow("ADDRESS_IN_USE");
  expect(await listed(user)).toEqual([home]);
  expect(await read("address-use", { id: home }, user)).toEqual({
    addressId: home,
    count: days.length,
    from: dates[0],
    to: dates.at(-1),
    kitchens: [{ id: K[0], name: "Dapur Senja" }],
    pendingCheckouts: 0,
  });
  // Days cancelled or before today do not count.
  await q("update v1.delivery_days set status='cancelled' where id=$1", [days[0]]);
  await q("update v1.delivery_days set service_date=$2::date where id=$1", [days[1], addDays(today, -2)]);
  expect((await read("address-use", { id: home }, user)).count).toBe(days.length - 2);
});

it("a pending checkout keeps its address in use", async () => {
  const user = await customer();
  const home = await address(user, "Rumah");
  await cmd("checkout.create", { acceptedTerms: true, packageId: P[0], addressId: home, portions: 1, startDate: addDays(today, 20), trial: false }, user);
  expect(await read("address-use", { id: home }, user)).toMatchObject({ count: 0, pendingCheckouts: 1 });
  await expect(cmd("address.delete", { addressId: home }, user)).rejects.toThrow("ADDRESS_IN_USE");
});

it("replace moves every movable day in one transaction and reports the days that stayed", async () => {
  const user = await customer();
  const home = await address(user, "Rumah");
  const office = await address(user, "Kantor");
  const senja = await buy(user, P[0], home); // Dapur Senja
  const hijau = await buy(user, P[1], home); // Hijau Kitchen
  // One Senja day is today (past its one-day cutoff); one Hijau day is already cooking.
  await q("update v1.delivery_days set service_date=$2::date where id=$1", [senja[0], today]);
  await q("update v1.delivery_days set status='preparing' where id=$1", [hijau[0]]);
  const versions = await q<{ id: string; version: number }>("select id,version from v1.delivery_days where id=any($1)", [[...senja, ...hijau]]);
  const result = await cmd("address.replace", { fromAddressId: home, toAddressId: office }, user);
  const until = (await q<{ d: string }>("select max(service_date)::text d from v1.delivery_days where id=any($1)", [[senja[0], hijau[0]]]))[0].d;
  expect(result).toEqual({
    fromAddressId: home,
    toAddressId: office,
    moved: senja.length + hijau.length - 2,
    stayed: 2,
    stayedUntil: until,
    kitchens: [
      { id: K[0], name: "Dapur Senja", reason: "CUTOFF" },
      { id: K[1], name: "Hijau Kitchen", reason: "CUTOFF" },
    ],
    pendingCheckouts: 0,
    deleted: false,
  });
  for (const id of [...senja.slice(1), ...hijau.slice(1)]) expect(await addressIdOf(id)).toBe(office);
  for (const id of [senja[0], hijau[0]]) expect(await addressIdOf(id)).toBe(home);
  const after = new Map((await q<{ id: string; version: number }>("select id,version from v1.delivery_days where id=any($1)", [[...senja, ...hijau]])).map((r) => [r.id, r.version]));
  for (const v of versions) expect(after.get(v.id)).toBe([senja[0], hijau[0]].includes(v.id) ? v.version : v.version + 1);
  // The copy is the target address without the owner or the archive stamp.
  const copy = (await q<{ address: Record<string, unknown> }>("select address from v1.delivery_days where id=$1", [senja[1]]))[0].address;
  expect(Object.keys(copy).sort()).toEqual(["area", "city", "id", "instructions", "label", "line", "version"]);
  expect(await read("address-use", { id: home }, user)).toMatchObject({ count: 2 });
});

it("replace leaves the days of a kitchen outside the target's area and names that kitchen", async () => {
  const user = await customer();
  const home = await address(user, "Rumah");
  const central = await address(user, "Kantor Pusat", "Jakarta Pusat"); // Dapur Senja covers it, Hijau Kitchen does not
  const senja = await buy(user, P[0], home);
  const hijau = await buy(user, P[1], home);
  const result = await cmd("address.replace", { fromAddressId: home, toAddressId: central }, user);
  expect(result).toMatchObject({
    moved: senja.length,
    stayed: hijau.length,
    kitchens: [{ id: K[1], name: "Hijau Kitchen", reason: "COVERAGE" }],
    deleted: false,
  });
  for (const id of senja) expect(await addressIdOf(id)).toBe(central);
  for (const id of hijau) expect(await addressIdOf(id)).toBe(home);
});

it("replace archives the old address when every day moved", async () => {
  const user = await customer();
  const home = await address(user, "Rumah");
  const office = await address(user, "Kantor");
  const days = await buy(user, P[0], home);
  await expect(cmd("address.replace", { fromAddressId: home, toAddressId: office }, user)).resolves.toMatchObject({
    moved: days.length,
    stayed: 0,
    stayedUntil: null,
    kitchens: [],
    deleted: true,
  });
  expect(await listed(user)).toEqual([office]);
  expect(await q("select 1 from public.catera_v1_events where user_id=$1 and topic='delivery.changed'", [user])).toHaveLength(1);
});

it("a customer acts only on their own addresses", async () => {
  const [a, b] = [await customer(), await customer()];
  const mine = await address(a, "Rumah");
  const theirs = await address(b, "Rumah");
  await buy(b, P[0], theirs);
  await expect(cmd("address.delete", { addressId: theirs }, a)).rejects.toThrow("NOT_FOUND");
  await expect(cmd("address.replace", { fromAddressId: theirs, toAddressId: mine }, a)).rejects.toThrow("NOT_FOUND");
  await expect(cmd("address.replace", { fromAddressId: mine, toAddressId: theirs }, a)).rejects.toThrow("NOT_FOUND");
  await expect(read("address-use", { id: theirs }, a)).rejects.toThrow("NOT_FOUND");
  await expect(cmd("address.delete", { addressId: mine }, U.owner)).rejects.toThrow("NOT_FOUND");
  expect(await listed(b)).toEqual([theirs]);
  for (const bad of [{}, { addressId: "x" }, { addressId: mine, extra: 1 }])
    await expect(cmd("address.delete", bad, a)).rejects.toThrow("INVALID_INPUT");
  await expect(cmd("address.replace", { fromAddressId: mine, toAddressId: mine }, a)).rejects.toThrow("INVALID_INPUT");
  await expect(localRpc(db, null, "catera_v1_command", ["address.delete", { addressId: mine }, crypto.randomUUID()])).rejects.toThrow("UNAUTHORIZED");
});

it("editing an address leaves the copies on booked days as they were", async () => {
  const user = await customer();
  const home = await address(user, "Rumah");
  const [day] = await buy(user, P[0], home);
  await cmd("address.save", { id: home, version: 1, label: "Rumah", line: "Jl. Baru No. 99", area: "Jakarta Selatan", city: "Jakarta" }, user);
  const copy = (await q<{ line: string }>("select address->>'line' line from v1.delivery_days where id=$1", [day]))[0];
  expect(copy.line).toBe("Jl. Sintetis No. 7");
});

it("the sheet lines name the count, the dates and the kitchen in both languages", async () => {
  const { addressUseLine, addressReplaceLine } = await import("@catera/domain");
  const use = { addressId: "a", count: 1, from: "2026-10-13", to: "2026-10-13", kitchens: [], pendingCheckouts: 0 };
  expect(addressUseLine(use, "id")).toBe("Alamat ini masih dipakai untuk 1 pengantaran, 13 Okt.");
  expect(addressUseLine({ ...use, count: 12, to: "2026-10-31" }, "en")).toBe("This address is still used for 12 deliveries, 13 Oct to 31 Oct.");
  const result = { fromAddressId: "a", toAddressId: "b", moved: 3, stayed: 1, stayedUntil: "2026-10-14", kitchens: [{ id: "k", name: "Dapur Senja", reason: "CUTOFF" as const }], pendingCheckouts: 0, deleted: false };
  expect(addressReplaceLine(result, "id")).toBe("1 pengantaran tetap ke alamat lama sampai 14 Okt, karena sudah lewat batas waktu.");
  expect(addressReplaceLine(result, "en")).toBe("1 delivery stays at the old address until 14 Oct, because the change deadline has passed.");
  expect(addressReplaceLine({ ...result, stayed: 0 }, "id")).toBe("");
});

let imports = 0;
/** A caterer's prepaid import row for an existing customer at one of their saved addresses. */
const importRow = (user: string, addressId: string) => ({
  customerId: user,
  addressId,
  packageId: P[2],
  portions: 1,
  startDate: addDays(today, 30 + 7 * (imports % 20)),
  remainingDays: 1,
  externalReference: "alamat-impor-" + imports++,
});

it("an import cannot use a removed address, in its preview or its commit", async () => {
  const user = await customer();
  await q("insert into v1.relationships(user_id,caterer_id,source) values($1,$2,'legacy')", [user, K[0]]);
  const gone = await address(user, "Lama");
  const kept = await address(user, "Rumah");
  const preview = await cmd("import.preview", { catererId: K[0], rows: [importRow(user, gone)] }, U.owner);
  await cmd("address.delete", { addressId: gone }, user);
  await expect(cmd("import.commit", { catererId: K[0], id: preview.id }, U.owner)).rejects.toThrow("NOT_FOUND");
  await expect(cmd("import.preview", { catererId: K[0], rows: [importRow(user, gone)] }, U.owner)).rejects.toThrow("NOT_FOUND");
  const ok = await cmd("import.preview", { catererId: K[0], rows: [importRow(user, kept)] }, U.owner);
  await expect(cmd("import.commit", { catererId: K[0], id: ok.id }, U.owner)).resolves.toMatchObject({ id: ok.id });
});

it("replace checks each kitchen's area as it is now, not as it was bought", async () => {
  const user = await customer();
  const home = await address(user, "Rumah");
  const west = await address(user, "Kantor Barat", "Jakarta Barat");
  const hijau = await buy(user, P[1], home); // Hijau Kitchen delivered to Jakarta Barat when this was bought
  const [{ areas }] = await q<{ areas: string[] }>("select areas from v1.caterers where id=$1", [K[1]]);
  await q("update v1.caterers set areas=array['Jakarta Selatan'] where id=$1", [K[1]]);
  try {
    await expect(cmd("address.replace", { fromAddressId: home, toAddressId: west }, user)).resolves.toMatchObject({
      moved: 0,
      stayed: hijau.length,
      kitchens: [{ id: K[1], name: "Hijau Kitchen", reason: "COVERAGE" }],
    });
  } finally {
    await q("update v1.caterers set areas=$2 where id=$1", [K[1], areas]);
  }
});

it("a retried checkout keeps its stored answer after the address is removed", async () => {
  const user = await customer();
  const home = await address(user, "Rumah");
  const key = crypto.randomUUID();
  const payload = { acceptedTerms: true, packageId: P[0], addressId: home, portions: 1, startDate: addDays(today, 20), trial: false };
  const first = await localRpc<any>(db, user, "catera_v1_command", ["checkout.create", payload, key]);
  await q("update v1.checkouts set state='expired' where id=$1", [first.id]);
  await cmd("address.delete", { addressId: home }, user);
  await expect(localRpc<any>(db, user, "catera_v1_command", ["checkout.create", payload, key])).resolves.toMatchObject({ id: first.id });
});

it("the stayed line names the deadline whenever a kitchen missed it, also beside a kitchen outside the area", async () => {
  const { addressReplaceLine } = await import("@catera/domain");
  const result = {
    fromAddressId: "a",
    toAddressId: "b",
    moved: 0,
    stayed: 3,
    stayedUntil: "2026-10-20",
    kitchens: [
      { id: "s", name: "Dapur Senja", reason: "CUTOFF" as const },
      { id: "h", name: "Hijau Kitchen", reason: "COVERAGE" as const },
    ],
    pendingCheckouts: 0,
    deleted: false,
  };
  expect(addressReplaceLine(result, "id")).toBe(
    "3 pengantaran tetap ke alamat lama sampai 20 Okt. Hijau Kitchen tidak mengantar ke alamat baru, dan sebagian pengantaran sudah lewat batas waktu.",
  );
  expect(addressReplaceLine(result, "en")).toBe(
    "3 deliveries stay at the old address until 20 Oct. Hijau Kitchen does not deliver to the new address, and some deliveries are past the change deadline.",
  );
});
