import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID as A,
  CATERER_IDS as K,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout, type CustomerState } from "@catera/domain";

// Sign-in rethink: the kitchen's WhatsApp and the customer's phone are typed, not OTP-verified.
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
let dayId = "";
let checkoutId = "";
const cmd = (action: string, payload: unknown, user: string | null = U.owner) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const read = (resource: string, params: object, user: string) =>
  localRpc<any>(db, user, "catera_v1_read", [resource, params]);
const sys = (action: string, payload: object) =>
  localRpc<any>(db, null, "catera_v1_system", [action, payload], true);
const catererPhone = async (user: string = U.customer) =>
  ((await read("customer", {}, user)) as CustomerState).deliveries.find((d) => d.id === dayId)
    ?.catererPhone ?? null;
const column = async (cid: string) =>
  (await db.query<{ whatsapp: string | null }>("select whatsapp from v1.caterers where id=$1", [cid])).rows[0]
    .whatsapp;

beforeAll(async () => {
  db = await createDemoDatabase(true);
  const checkout: Checkout = await cmd(
    "checkout.create",
    { acceptedTerms: true, packageId: P[2], addressId: A, portions: 1, startDate: addDays(localDay(), 5), trial: false },
    U.customer,
  );
  checkoutId = checkout.id;
  await cmd("checkout.demo_pay", { id: checkout.id }, U.customer);
  dayId = (
    await db.query<{ id: string }>(
      "select d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date limit 1",
      [checkout.id],
    )
  ).rows[0].id;
});
afterAll(async () => db?.close());

it("seller.create takes an optional E.164 WhatsApp and rejects any other shape", async () => {
  const owner = crypto.randomUUID();
  await db.query("insert into v1.profiles(id,name) values($1,'Synthetic kitchen owner')", [owner]);
  const base = { name: "Synthetic WA Kitchen", description: "Synthetic kitchen", areas: ["Jakarta Selatan"] };
  for (const whatsapp of ["081234567890", "+6281", "+62812345678901234", 6281234567890, "+15551234567"])
    await expect(cmd("seller.create", { ...base, slug: "wa-bad", whatsapp }, owner)).rejects.toThrow("INVALID_INPUT");
  const made = await cmd("seller.create", { ...base, slug: "wa-kitchen", whatsapp: "+6281234567890" }, owner);
  expect(await column(made.id)).toBe("+6281234567890");
  const plain = crypto.randomUUID();
  await db.query("insert into v1.profiles(id,name) values($1,'Synthetic plain owner')", [plain]);
  const none = await cmd("seller.create", { ...base, slug: "wa-none" }, plain);
  expect(await column(none.id)).toBeNull();
});

it("seller.whatsapp is the owner's only, and the seller read shows it to the owner only", async () => {
  await expect(cmd("seller.whatsapp", { whatsapp: "+6281300000002" }, U.staff)).rejects.toThrow("FORBIDDEN");
  await expect(
    cmd("seller.whatsapp", { catererId: K[0], whatsapp: "+6281300000002" }, U.staff),
  ).rejects.toThrow("FORBIDDEN");
  await expect(cmd("seller.whatsapp", { whatsapp: "+6281300000002" }, U.customer)).rejects.toThrow("FORBIDDEN");
  await expect(cmd("seller.whatsapp", { whatsapp: "+6281300000002" }, null)).rejects.toThrow("UNAUTHORIZED");
  await expect(cmd("seller.whatsapp", { catererId: K[1], whatsapp: "+6281300000002" })).rejects.toThrow("FORBIDDEN");
  for (const bad of [{}, { whatsapp: "0813" }, { whatsapp: "+6281300000002", extra: 1 }])
    await expect(cmd("seller.whatsapp", bad)).rejects.toThrow("INVALID_INPUT");
  expect(await column(K[0])).toBeNull();

  expect(await cmd("seller.whatsapp", { whatsapp: "+6281300000002" })).toEqual({
    catererId: K[0],
    whatsapp: "+6281300000002",
  });
  expect(await column(K[0])).toBe("+6281300000002");
  const date = localDay();
  expect((await read("seller", { id: K[0], date }, U.owner)).caterer.whatsapp).toBe("+6281300000002");
  expect((await read("seller", { id: K[0], date }, U.staff)).caterer).not.toHaveProperty("whatsapp");
  expect(JSON.stringify(await read("admin", {}, U.platform_admin))).not.toContain("6281300000002");

  expect(await cmd("seller.whatsapp", { catererId: K[0], whatsapp: null })).toEqual({ catererId: K[0], whatsapp: null });
  expect(await column(K[0])).toBeNull();
});

it("the customer's delivery prefers the kitchen's WhatsApp and falls back to the owner's verified phone", async () => {
  expect(await catererPhone()).toBeNull();
  await db.exec("create table if not exists auth.users(id uuid primary key, phone text, email text, phone_confirmed_at timestamptz)");
  await db.query("insert into auth.users(id,phone,phone_confirmed_at) values($1,'6281200000009',now())", [U.owner]);
  expect(await catererPhone()).toBe("+6281200000009");
  await cmd("seller.whatsapp", { whatsapp: "+6281300000003" });
  expect(await catererPhone()).toBe("+6281300000003");
  // Unchanged visibility: never on the kitchen's own read of the same day.
  expect(await catererPhone(U.owner)).toBeNull();
  await cmd("seller.whatsapp", { whatsapp: null });
  expect(await catererPhone()).toBe("+6281200000009");
  await db.query("delete from auth.users where id=$1", [U.owner]);
});

it("profile.update sets, keeps and clears the customer's phone, and the actor read answers it", async () => {
  const actor = () => read("actor", {}, U.customer);
  expect((await actor()).phone).toBeNull();
  expect(await cmd("profile.update", { phone: "+6281234500001" }, U.customer)).toEqual({ phone: "+6281234500001" });
  expect((await actor()).phone).toBe("+6281234500001");
  expect(await cmd("profile.update", { name: "Nadia P" }, U.customer)).toEqual({ name: "Nadia P" });
  // A trunk 0 kept after +62 is dropped; a number starting with 0 after the code is never stored.
  expect(await cmd("profile.update", { phone: "+6208123450000" }, U.customer)).toEqual({ phone: "+628123450000" });
  expect(await cmd("seller.whatsapp", { whatsapp: "+62081300000009" })).toMatchObject({ whatsapp: "+6281300000009" });
  await cmd("seller.whatsapp", { whatsapp: null });
  await cmd("profile.update", { phone: "+6281234500001" }, U.customer);
  await expect(db.query("update v1.profiles set phone='+6201234567890' where id=$1", [U.customer])).rejects.toThrow("check");
  for (const bad of [{}, { phone: "0812" }, { phone: "+6200812345678" }, { phone: 812 }, { phone: "+6281234500001", id: U.owner }])
    await expect(cmd("profile.update", bad, U.customer)).rejects.toThrow("INVALID_INPUT");
  await expect(cmd("profile.update", { phone: "+6281234500001" }, null)).rejects.toThrow("UNAUTHORIZED");
  expect(await cmd("profile.update", { name: "Nadia Putri", phone: null }, U.customer)).toEqual({
    name: "Nadia Putri",
    phone: null,
  });
  // Without a typed phone the actor read falls back to a verified auth phone.
  await db.query("insert into auth.users(id,phone,phone_confirmed_at) values($1,'6281200000004',now())", [U.customer]);
  expect((await actor()).phone).toBe("+6281200000004");
  await db.query("delete from auth.users where id=$1", [U.customer]);
});

it("the paylater contact prefers the typed phone and still falls back to the auth phone", async () => {
  // provider.payment.customer is the hosted payment-channels action; the demo base lacks it, so stand in for it.
  await db.exec(`create or replace function public.catera_v1_system_contact_base(action text,payload jsonb default '{}') returns jsonb
    language plpgsql set search_path='' as $$ declare ph text; begin
     execute 'select u.phone from auth.users u join v1.checkouts c on c.user_id=u.id where c.id=$1' into ph using (payload->>'id')::uuid;
     return jsonb_build_object('name','n','phone',ph,'email','e@x.test');
    end $$`);
  await db.query("insert into auth.users(id,phone,phone_confirmed_at) values($1,'6281200000005',now())", [U.customer]);
  expect((await sys("provider.payment.customer", { id: checkoutId })).phone).toBe("6281200000005");
  await cmd("profile.update", { phone: "+6281234500006" }, U.customer);
  expect((await sys("provider.payment.customer", { id: checkoutId })).phone).toBe("+6281234500006");
});
