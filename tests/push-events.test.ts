import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rpc: vi.fn(), after: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  after: state.after,
}));
vi.mock("../apps/web/src/lib/auth", () => ({
  session: async () => ({
    id: "synthetic-user",
    token: "synthetic-token",
    actor: { role: "owner", catererId: "10000000-0000-4000-8000-000000000001" },
  }),
  supabase: vi.fn(),
  demoToken: vi.fn(),
}));
vi.mock("@catera/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@catera/backend")>();
  return {
    ...actual,
    demoEnabled: () => false,
    // The mock stands in for the hosted RPC; the demo database below is opened from the backend's own files.
    rpc: state.rpc,
  };
});
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { ADDRESS_ID as A, CATERER_IDS as K, DEMO_ACTORS as U, PACKAGE_IDS as P } from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout } from "@catera/domain";
import { setAsideDemoKitchenDay } from "./fixtures/set-aside-demo-day";
import { dispatchPushes } from "../apps/web/src/lib/push-dispatch";

type Day = { id: string; service_date: string; version: number };
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const today = localDay();
const cmd = (action: string, payload: object, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const q = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const pushes = (like: string) =>
  q<{ dedupe: string; body: string; href: string }>(
    "select dedupe,payload->>'body' body,payload->>'href' href from v1.outbox where kind='push' and dedupe like $1 order by dedupe",
    [like],
  );

async function buy(packageId: string, startDate: string): Promise<Day[]> {
  const checkout: Checkout = await cmd("checkout.create", {
    acceptedTerms: true,
    packageId,
    addressId: A,
    portions: 1,
    startDate,
    trial: false,
  });
  await cmd("checkout.demo_pay", { id: checkout.id });
  return q<Day>(
    "select d.id,d.service_date::text service_date,d.version from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date",
    [checkout.id],
  );
}
const toToday = (day: Day) => q("update v1.delivery_days set service_date=$2::date where id=$1", [day.id, today]);

let both: Day[]; // Rantang Nusantara (lunch and dinner), Dapur Senja
let second: Day[]; // Ayam Sambal Rumahan (lunch), Dapur Senja, the same customer
let flexible: Day[];
let flexiblePackage: string;
beforeAll(async () => {
  db = await createDemoDatabase(true);
  await setAsideDemoKitchenDay(db);
  both = await buy(P[2], addDays(today, 30));
  second = await buy(P[4], addDays(today, 30));
  flexiblePackage = (
    await q<any>(
      "select id from v1.packages where caterer_id=$1 and (offer->>'flexible')::boolean and status='published' order by id limit 1",
      [K[0]],
    )
  )[0].id;
  flexible = await buy(flexiblePackage, addDays(today, 60));
  await toToday(both[0]);
  await toToday(second[0]);
});
afterAll(async () => db?.close());

describe("stage pushes queued by the database", () => {
  it("Dimasak and Sampai pushes exist with the approved bodies", async () => {
    await cmd("delivery.cook", { catererId: K[0], date: today, meal: "lunch" }, U.owner);
    const cooking = await pushes("cooking:%");
    // Two packages of one customer, one push.
    expect(cooking.map((r) => r.dedupe)).toEqual([`cooking:${U.customer}:${K[0]}:${today}:lunch`]);
    expect(cooking[0].body).toMatch(/^Makan siangmu sedang dimasak di .+/);
    expect(cooking[0].href).toBe("/today");

    await cmd("delivery.depart", { catererId: K[0], date: today, meal: "lunch" }, U.owner);
    const depart = await pushes("depart:%");
    expect(depart.map((r) => r.dedupe)).toEqual([`depart:${U.customer}:${K[0]}:${today}:lunch`]);
    expect(depart[0].body).toMatch(/^Makan siangmu sedang diantar dari .+/);

    const photo = (d: Day) => `${K[0]}/${d.id}/lunch/${crypto.randomUUID()}.jpg`;
    await cmd(
      "delivery.arrive",
      {
        catererId: K[0],
        date: today,
        meal: "lunch",
        fulfillmentIds: [both[0].id, second[0].id],
        photos: { [both[0].id]: photo(both[0]), [second[0].id]: photo(second[0]) },
      },
      U.owner,
    );
    const arrived = await pushes("arrived:%");
    expect(arrived.map((r) => r.dedupe)).toEqual([`arrived:${U.customer}:${K[0]}:${today}:lunch`]);
    expect(arrived[0].body).toBe("Pesananmu sudah diantar. Sudah diterima?");
  });

  it("one push per customer per stage for a multi-package customer", async () => {
    for (const stage of ["cooking", "depart", "arrived"]) expect(await pushes(`${stage}:%`)).toHaveLength(1);
    const notes = await q("select 1 from v1.notifications where user_id=$1 and kind='delivery'", [U.customer]);
    expect(notes).toHaveLength(3);
  });

  it("a stage repeated queues nothing new", async () => {
    await q("update v1.fulfillments set status='scheduled' where day_id=$1 and meal='lunch'", [second[0].id]);
    await q("update v1.fulfillments set status='preparing' where day_id=$1 and meal='lunch'", [second[0].id]);
    expect(await pushes("cooking:%")).toHaveLength(1);
  });

  let failedDay: Day;
  const versionOf = async (id: string) => (await q<any>("select version from v1.delivery_days where id=$1", [id]))[0].version;
  const status = async (id: string, next: string) =>
    cmd("delivery.status", { id, version: await versionOf(id), meal: "lunch", status: next }, U.owner);
  const trip = `${U.customer}:${K[0]}:${today}:lunch`;

  it("Gagal diantar tells the customer once, in the kamu register, and opens that day", async () => {
    failedDay = (await buy(P[0], addDays(today, 90)))[0];
    await toToday(failedDay);
    await q("update v1.fulfillments set status='out_for_delivery',departed_at=now() where day_id=$1", [failedDay.id]);
    await status(failedDay.id, "issue");
    const failed = await pushes("failed:%");
    expect(failed.map((r) => r.dedupe)).toEqual([`failed:${trip}`]);
    expect(failed[0].body).toMatch(/^Makan siangmu dari .+ gagal diantar\.$/);
    // delivery.status takes past dates too, so the push opens the day it is about, not Beranda.
    expect(failed[0].href).toBe(`/deliveries/${failedDay.id}`);
    // Another package of the same trip failing tells nobody again.
    await q("update v1.fulfillments set status='issue' where day_id=$1 and meal='lunch'", [second[0].id]);
    expect(await pushes("failed:%")).toHaveLength(1);
    // The old "Anda" status notice is gone.
    expect(await q("select 1 from v1.outbox where payload->>'body' like 'Status pengantaran Anda%'")).toHaveLength(0);
  });

  it("a redelivery after Gagal diantar is announced again, once per customer per trip", async () => {
    await status(failedDay.id, "out_for_delivery");
    expect((await pushes("depart:%")).map((r) => r.dedupe)).toEqual([`depart:${trip}`, `depart:${trip}:1`]);
    expect((await pushes(`depart:${trip}:1`))[0].body).toMatch(/^Makan siangmu sedang diantar dari .+/);
    // The other package setting out on the same second trip queues nothing.
    await q("update v1.fulfillments set status='out_for_delivery' where day_id=$1 and meal='lunch'", [second[0].id]);
    expect(await pushes("depart:%")).toHaveLength(2);
    // The second trip failing is news, and so is the third departure.
    await status(failedDay.id, "issue");
    expect((await pushes("failed:%")).map((r) => r.dedupe)).toEqual([`failed:${trip}`, `failed:${trip}:1`]);
    await status(failedDay.id, "out_for_delivery");
    expect((await pushes("depart:%")).map((r) => r.dedupe)).toEqual([`depart:${trip}`, `depart:${trip}:1`, `depart:${trip}:2`]);
  });

  it("Pindah tanggal by the caterer pushes the customer; the customer's own move does not", async () => {
    const day = flexible[0];
    const weekdays: number[] = (await q<any>("select offer->'weekdays' w from v1.packages where id=$1", [flexiblePackage]))[0].w;
    const next = (from: string) => {
      let to = addDays(from, 7);
      while (!weekdays.includes(new Date(`${to}T00:00:00Z`).getUTCDay())) to = addDays(to, 1);
      return to;
    };
    const to = next(day.service_date);
    const moved = await cmd(
      "customer.deliveryChange",
      { catererId: K[0], id: day.id, version: day.version, date: to, reason: "Dapur tutup sehari" },
      U.owner,
    );
    const rows = await pushes("moved:%");
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toMatch(/^Katering memindahkan pengantaranmu dari \d{1,2} \p{L}{3} ke \d{1,2} \p{L}{3}\.$/u);
    expect(rows[0].href).toBe(`/deliveries/${day.id}`);
    // The base command's own "Anda" notice no longer fires for a date move.
    expect(await q("select 1 from v1.outbox where payload->>'body' like 'Katerer memperbarui%'")).toHaveLength(0);

    await cmd("delivery.reschedule", { id: day.id, version: moved.delivery.version, date: next(to) }, U.customer);
    expect(await pushes("moved:%")).toHaveLength(1);
  });

  it("an address change by the caterer keeps its own notice, which names the address", async () => {
    const day = flexible[1];
    const address = (await q<any>("select line,area,city from v1.addresses where id=$1", [A]))[0];
    await cmd("customer.deliveryChange", { catererId: K[0], id: day.id, version: day.version, address, reason: "Pindah kantor sementara" }, U.owner);
    const notes = await q<any>("select body,href from v1.notifications where user_id=$1 and kind='change' and href=$2", [U.customer, `/deliveries/${day.id}`]);
    expect(notes).toEqual([{ body: "Katering mengubah alamat pengantaranmu sesuai permintaanmu.", href: `/deliveries/${day.id}` }]);
  });

  it("a stop without an account queues no push", async () => {
    const address = (await q<any>("select line,area,city,instructions from v1.addresses limit 1"))[0];
    const preview = await cmd(
      "import.preview",
      {
        catererId: K[0],
        rows: [
          {
            customer: { name: "Sari Contoh", phone: "+6281234598002", address },
            packageId: P[4],
            portions: 1,
            startDate: addDays(today, 150),
            remainingDays: 2,
            externalReference: "push-events-no-account",
          },
        ],
      },
      U.owner,
    );
    const { subscriptions } = await cmd("import.commit", { catererId: K[0], id: preview.id }, U.owner);
    const day = (await q<any>("select id from v1.delivery_days where subscription_id=$1 order by service_date limit 1", [subscriptions[0].id]))[0];
    const before = (await q("select 1 from v1.outbox where kind='push'")).length;
    await q("update v1.fulfillments set status='preparing' where day_id=$1", [day.id]);
    expect((await q("select 1 from v1.outbox where kind='push'")).length).toBe(before);
  });
});

describe("dispatch", () => {
  const job = { id: "job-1", payload: { userId: "u1", body: "Halo", href: "/today" } };
  const systemCalls = () =>
    state.rpc.mock.calls.filter((c) => c[2] === "catera_v1_system").map((c) => [c[3].action, c[3].payload]);
  const system = (handlers: Record<string, unknown>) =>
    state.rpc.mockImplementation(async (_i, _t, _n, args) => {
      const h = handlers[args.action];
      if (h instanceof Error) throw h;
      return typeof h === "function" ? h(args.payload) : h;
    });
  beforeEach(() => {
    vi.restoreAllMocks();
    state.rpc.mockReset();
    state.after.mockReset();
  });
  const command = (action: string) =>
    new Request("https://catera.test/api/v1/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload: {}, requestId: crypto.randomUUID() }),
    });
  const context = { params: Promise.resolve({ path: ["commands"] }) };

  it("a command queues and dispatches its push after responding", async () => {
    const { POST } = await import("../apps/web/src/app/api/v1/[...path]/route");
    const actions = ["delivery.cook", "delivery.depart", "delivery.status", "delivery.reschedule", "customer.deliveryChange"];
    for (const action of actions) {
      state.rpc.mockReset();
      state.after.mockReset();
      system({ [action]: { moved: 1 }, "outbox.claimPush": [] });
      expect((await POST(command(action), context)).status).toBe(200);
      expect(state.rpc.mock.calls.map((c) => c[3].action)).toEqual([action]);
      expect(state.after).toHaveBeenCalledTimes(1);
      for (const [callback] of state.after.mock.calls) await callback();
      expect(state.rpc.mock.calls.map((c) => c[3].action)).toEqual([action, "outbox.claimPush"]);
    }
  });

  it("a failed dispatch is retried by the backstop and never sent twice", async () => {
    let queued = [job];
    const sent: string[] = [];
    system({
      "outbox.claimPush": () => {
        const claimed = queued;
        queued = [];
        return claimed;
      },
      "notification.eligible": true,
      devices: ["ExponentPushToken[a]"],
      "push.ticket": null,
      "outbox.complete": null,
      "outbox.retry": (p: { id: string }) => void (queued = [{ ...job, id: p.id }]),
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockImplementation(async (_u, init) => {
        sent.push(JSON.parse(init!.body as string)[0].collapseId);
        return Response.json({ data: [{ status: "ok", id: "t1" }] });
      });
    // The dispatch right after the command fails and hands the job back; the backstop run sends it.
    expect(await dispatchPushes({ limit: 20 })).toEqual({ sent: 0 });
    expect(await dispatchPushes({ limit: 20 })).toEqual({ sent: 1 });
    expect(await dispatchPushes({ limit: 20 })).toEqual({ sent: 0 });
    expect(sent).toEqual(["job-1"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(systemCalls().filter(([a]) => a === "outbox.complete")).toHaveLength(1);
  });

  it("caterer pushes are titled Catera Dapur and customer pushes Catera", async () => {
    system({
      "outbox.claimPush": [
        { id: "c1", payload: { userId: "u1", body: "Pesananmu sudah diantar. Sudah diterima?", href: "/today" } },
        { id: "k1", payload: { userId: "u2", body: "Ada permintaan bantuan baru.", href: "/seller/support" } },
      ],
      "notification.eligible": true,
      devices: ["ExponentPushToken[a]"],
      "push.ticket": null,
      "outbox.complete": null,
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json({ data: [{ status: "ok", id: "t" }] }));
    await dispatchPushes({ limit: 20 });
    const titles = fetchMock.mock.calls.map((c) => JSON.parse(c[1]!.body as string)[0].title);
    expect(titles).toEqual(["Catera", "Catera Dapur"]);
  });
});
