import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID as A,
  CATERER_IDS as K,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Actor, type Checkout } from "@catera/domain";

// The routes run against hosted storage (mocked) while the database decisions come from a real demo database.
const state = vi.hoisted(() => ({
  db: null as unknown as Awaited<ReturnType<typeof createDemoDatabase>>,
  actor: null as Actor | null,
  signed: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("../apps/web/src/lib/auth", () => ({
  session: async () => ({ id: state.actor?.id ?? null, token: "synthetic-token", actor: state.actor }),
}));
vi.mock("@catera/backend", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  demoEnabled: () => false,
  rpc: (actor: string | null, _token: string | null, name: string, args: Record<string, unknown>) =>
    localRpc(state.db, actor, name, Object.values(args)),
}));
vi.mock("../apps/web/src/lib/food-upload", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  uploadStorage: () => ({
    storage: { from: () => ({ createSignedUrl: state.signed, upload: state.upload }) },
  }),
}));
import { GET as proof } from "../apps/web/src/app/api/proof/route";
import { POST as uploadProof } from "../apps/web/src/app/api/uploads/proof/route";

const today = localDay();
const otherStaff = crypto.randomUUID();
const otherCustomer = crypto.randomUUID();
let day = "";
let stored = "";
const as = (id: string, role: Actor["role"], catererId?: string) => {
  state.actor = { id, name: "Contoh", role, catererId };
};
const get = (deliveryId: string, meal = "lunch") =>
  proof(new Request(`https://catera.test/api/proof?deliveryId=${deliveryId}&meal=${meal}`));

beforeAll(async () => {
  state.db = await createDemoDatabase(true);
  const cmd = (action: string, payload: object, user: string) =>
    localRpc<any>(state.db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
  const checkout: Checkout = await cmd(
    "checkout.create",
    { acceptedTerms: true, packageId: P[4], addressId: A, portions: 1, startDate: addDays(today, 40), trial: false },
    U.customer,
  );
  await cmd("checkout.demo_pay", { id: checkout.id }, U.customer);
  day = (
    await state.db.query<{ id: string }>(
      "select d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date limit 1",
      [checkout.id],
    )
  ).rows[0].id;
  await state.db.query("update v1.delivery_days set service_date=$2::date,status='out_for_delivery' where id=$1", [day, today]);
  await state.db.query("update v1.fulfillments set status='out_for_delivery' where day_id=$1", [day]);
  stored = `${K[0]}/${day}/lunch/${crypto.randomUUID()}.jpg`;
  await cmd(
    "delivery.arrive",
    { catererId: K[0], date: today, meal: "lunch", fulfillmentIds: [day], photos: { [day]: stored } },
    U.staff,
  );
  await state.db.query(
    "insert into v1.profiles(id,name,role) values($1,'Staf Contoh Lain','owner'),($2,'Pelanggan Contoh Lain','customer')",
    [otherStaff, otherCustomer],
  );
  await state.db.query("insert into v1.staff values($1,$2,'owner')", [K[1], otherStaff]);
});
afterAll(async () => state.db?.close());
beforeEach(() => {
  vi.clearAllMocks();
  state.signed.mockResolvedValue({ data: { signedUrl: "https://synthetic.invalid/signed" }, error: null });
  state.upload.mockResolvedValue({ error: null });
});

it("signs the photo for the stop's customer and that caterer's staff, for five minutes", async () => {
  as(U.customer, "customer");
  const customer = await get(day);
  expect(customer.status).toBe(302);
  expect(customer.headers.get("Location")).toBe("https://synthetic.invalid/signed");
  expect(customer.headers.get("Cache-Control")).toBe("private, no-store");
  as(U.owner, "owner", K[0]);
  expect((await get(day)).status).toBe(302);
  expect(state.signed).toHaveBeenCalledTimes(2);
  expect(state.signed).toHaveBeenCalledWith(stored, 300);
});

it("refuses another kitchen's staff, another customer and a signed-out caller without touching storage", async () => {
  as(otherStaff, "owner", K[1]);
  expect((await get(day)).status).toBe(403);
  as(otherCustomer, "customer");
  expect((await get(day)).status).toBe(403);
  state.actor = null;
  expect((await get(day)).status).toBe(401);
  as(U.customer, "customer");
  expect((await get(day, "dinner")).status).toBe(404);
  expect((await get("not-a-uuid")).status).toBe(400);
  expect(state.signed).not.toHaveBeenCalled();
});

it("uploads a decoded photo into the caterer's own folder for that stop, for staff only", async () => {
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#ddccbb" } })
    .jpeg()
    .toBuffer();
  const request = (fields: Record<string, string>, file: Blob | null = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" })) => {
    const form = new FormData();
    if (file) form.append("file", file, "sampai.jpg");
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    return uploadProof(new Request("https://catera.test/api/uploads/proof", { method: "POST", body: form }));
  };
  as(U.staff, "staff", K[0]);
  const ok = await request({ deliveryId: day, meal: "lunch" });
  expect(ok.status).toBe(200);
  const { path } = (await ok.json()).data;
  expect(path).toMatch(new RegExp(`^${K[0]}/${day}/lunch/[0-9a-f-]{36}\\.jpg$`));
  expect(state.upload).toHaveBeenCalledWith(path, expect.any(Buffer), { contentType: "image/jpeg", upsert: false });
  as(U.customer, "customer");
  expect((await request({ deliveryId: day, meal: "lunch" })).status).toBe(403);
  as(U.staff, "staff", K[0]);
  expect((await request({ deliveryId: day, meal: "breakfast" })).status).toBe(400);
  expect((await request({ deliveryId: day, meal: "lunch" }, new Blob(["not an image"]))).status).toBe(400);
  expect(state.upload).toHaveBeenCalledTimes(1);
  // Another kitchen's staff, or a stop that does not exist, store nothing.
  as(otherStaff, "owner", K[1]);
  expect((await request({ deliveryId: day, meal: "lunch" })).status).toBe(403);
  as(U.staff, "staff", K[0]);
  expect((await request({ deliveryId: crypto.randomUUID(), meal: "lunch" })).status).toBe(403);
  expect(state.upload).toHaveBeenCalledTimes(1);
});

it("answers a stop that does not exist like one that is not the caller's", async () => {
  as(U.customer, "customer");
  expect((await get(crypto.randomUUID())).status).toBe(403);
  expect(state.signed).not.toHaveBeenCalled();
});
