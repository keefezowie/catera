import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { shortDate, type CustomerState, type Delivery, type Offer, type Subscription, type UsageName } from "@catera/domain";
import { nativeThemes } from "@catera/design-tokens";
import { PlanDetailScreen } from "../src/plan/PlanDetail";
import { customerLink } from "../src/links";
import * as offline from "../src/today/offline";
import { delivery, offer, subscription } from "./fixtures";

let mockParams: { id?: string } = { id: "s-1" };
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
}));

// 10.00 in Jakarta on Thursday 8 October 2026. Only the clock is pinned: timers and microtasks keep running.
const DAY = "2026-10-08";
const pinToday = () =>
  jest.useFakeTimers({
    now: new Date("2026-10-08T03:00:00Z"),
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });

const at = (offset: number) => {
  const d = new Date(`${DAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
type UsageMock = jest.Mock<Promise<void>, [UsageName, "customer" | "dapur"]>;

function runtimeWith(read: () => Promise<unknown>, usage: UsageMock = jest.fn(async () => undefined)): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    customer: jest.fn(read),
    usage,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const renderPlan = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <PlanDetailScreen />
    </MobileProvider>,
  );

const dinnerOffer = (): Offer =>
  offer({
    meal: "dinner",
    menus: [
      {
        meal: "dinner",
        name: "Ikan",
        description: "",
        image: "",
        items: [{ id: "i-9", name: "Ikan bakar" }],
      } as unknown as Offer["menus"][number],
    ],
  });

/** A five-day lunch plan running this week, with seven days still ahead and one day of another plan in between. */
function planState(sub: Partial<Subscription> = {}, extra: { subscriptions?: Subscription[]; deliveries?: Delivery[] } = {}) {
  const main = subscription({ starts_on: at(-3), ends_on: at(7), remaining: 6, ...sub });
  const state: CustomerState = {
    subscriptions: [main, ...(extra.subscriptions ?? [])],
    deliveries: extra.deliveries ?? [
      delivery("d-today", DAY),
      delivery("d-1", at(1)),
      delivery("d-2", at(2), { meal: "dinner" }, { offer: dinnerOffer() }),
      delivery("d-other", at(2), {}, { subscription_id: "s-other", offer: offer({ name: "Paket Lain" }) }),
      delivery("d-3", at(3)),
      delivery("d-4", at(4)),
      delivery("d-5", at(5)),
      delivery("d-6", at(6)),
    ],
    addresses: [],
    notifications: [],
    cases: [],
  };
  return state;
}

const usageNames = (usage: UsageMock) => usage.mock.calls.map(([name]) => name);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: "s-1" };
  pinToday();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("Plan detail states", () => {
  it("loading reads Memuat paket… while the read is pending", async () => {
    renderPlan(runtimeWith(() => new Promise(() => undefined)));
    expect(await screen.findByText("Memuat paket…")).toBeTruthy();
    expect(screen.queryByTestId("sticky-action")).toBeNull();
  });

  it("a failed read says Belum bisa memuat and Coba lagi reads again", async () => {
    const runtime = runtimeWith(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    renderPlan(runtime);
    expect(await screen.findByText("Belum bisa memuat")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalledTimes(2));
  });

  it("a cold link to a plan the read does not hold says so and goes home (Review Focus 1)", async () => {
    mockParams = { id: "s-cancelled-elsewhere" };
    const usage: UsageMock = jest.fn(async () => undefined);
    renderPlan(runtimeWith(async () => planState(), usage));
    expect(await screen.findByText("Paket tidak ditemukan.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Ke Beranda" }));
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(usageNames(usage)).not.toContain("plan_sheet_opened");
  });

  it("an active plan that is not due: header, hero with days left, no footer action", async () => {
    renderPlan(runtimeWith(async () => planState()));
    const header = await screen.findByTestId("plan-header");
    expect(within(header).getByRole("header", { name: "Makan Siang Rumahan" })).toBeTruthy();
    expect(within(header).getByText("Dapur Contoh")).toBeTruthy();
    fireEvent.press(within(header).getByRole("button", { name: "Kembali" }));
    expect(router.back).toHaveBeenCalled();

    const hero = screen.getByTestId("plan-hero");
    expect(within(hero).getByText("6 hari lagi")).toBeTruthy();
    expect(within(hero).getByTestId("plan-photo").props.source).toEqual({ uri: "https://images.example.test/rumahan.jpg" });
    expect(within(hero).getByText(`${shortDate(at(-3), "id")} – ${shortDate(at(7), "id")}`)).toBeTruthy();
    expect(screen.queryByTestId("sticky-action")).toBeNull();
    expect(screen.queryByText("Sudah diperpanjang")).toBeNull();
  });

  it("Berikutnya lists this plan's next five days with their photo ring, day and dishes", async () => {
    renderPlan(runtimeWith(async () => planState()));
    expect(await screen.findByText("Berikutnya")).toBeTruthy();
    const rows = screen.getAllByTestId("plan-upcoming-row");
    expect(rows).toHaveLength(5);
    expect(screen.queryByText("Paket Lain")).toBeNull();
    // Tomorrow, then the dinner day, then three more lunches; today is not "coming up".
    expect(within(rows[0]).getByText(`Besok, ${shortDate(at(1), "id")}`)).toBeTruthy();
    expect(within(rows[0]).getByText("Ayam bakar madu, Sayur asem")).toBeTruthy();
    expect(within(rows[1]).getByText(shortDate(at(2), "id"))).toBeTruthy();
    expect(within(rows[1]).getByText("Ikan bakar")).toBeTruthy();
    // The row speaks for its ring, so the ring is hidden from screen readers and found with the hidden elements.
    const ring = (row: (typeof rows)[number]) =>
      StyleSheet.flatten(within(row).getByTestId("photo-ring", { includeHiddenElements: true }).props.style);
    expect(ring(rows[0])).toMatchObject({ width: 60, borderColor: nativeThemes.light.sunriseInk });
    expect(ring(rows[1])).toMatchObject({ width: 60, borderColor: nativeThemes.light.forest });
    fireEvent.press(rows[0]);
    expect(router.push).toHaveBeenCalledWith("/hari/d-1");
  });

  it("an active plan due for renewal: Lanjutkan paket opens Perpanjang and counts renew_started", async () => {
    const usage: UsageMock = jest.fn(async () => undefined);
    renderPlan(runtimeWith(async () => planState({ remaining: 2, ends_on: at(2) }), usage));
    const action = await screen.findByTestId("sticky-action");
    fireEvent.press(within(action).getByRole("button", { name: "Lanjutkan paket" }));
    expect(router.push).toHaveBeenCalledWith("/renew/s-1");
    expect(usageNames(usage).filter((n) => n === "renew_started")).toHaveLength(1);
  });

  it("a plan already renewed says Sudah diperpanjang and offers no renewal (Review Focus 2)", async () => {
    const next = subscription({ id: "s-2", renewed_from: "s-1", starts_on: at(3), ends_on: at(10), remaining: 5 });
    renderPlan(runtimeWith(async () => planState({ remaining: 2, ends_on: at(2) }, { subscriptions: [next] })));
    expect(await screen.findByText("Sudah diperpanjang")).toBeTruthy();
    expect(screen.queryByTestId("sticky-action")).toBeNull();
    expect(screen.queryByText("Lanjutkan paket")).toBeNull();
  });

  it("a trial invites the full package and counts no renewal", async () => {
    const usage: UsageMock = jest.fn(async () => undefined);
    const trial = { offer: offer(), total: 30000, trial: true } as unknown as Subscription["snapshot"];
    renderPlan(runtimeWith(async () => planState({ snapshot: trial, remaining: 1, ends_on: at(1) }), usage));
    const action = await screen.findByTestId("sticky-action");
    fireEvent.press(within(action).getByRole("button", { name: "Lanjutkan dengan paket penuh" }));
    expect(router.push).toHaveBeenCalledWith("/paket/p-rumahan");
    expect(usageNames(usage)).not.toContain("renew_started");
  });

  it("a completed plan reads Paket selesai with its dates, no upcoming days, and offers to continue", async () => {
    renderPlan(
      runtimeWith(async () =>
        planState({ status: "completed", remaining: 0, starts_on: at(-7), ends_on: at(-3) }, { deliveries: [] }),
      ),
    );
    const hero = await screen.findByTestId("plan-hero");
    expect(within(hero).getByText("Paket selesai")).toBeTruthy();
    expect(within(hero).getByText(`${shortDate(at(-7), "id")} – ${shortDate(at(-3), "id")}`)).toBeTruthy();
    expect(screen.getByText("Tidak ada antaran mendatang.")).toBeTruthy();
    expect(within(screen.getByTestId("sticky-action")).getByRole("button", { name: "Lanjutkan paket" })).toBeTruthy();
  });

  it.each([
    ["an active one-day plan", { starts_on: at(2), ends_on: at(2), remaining: 1 }, at(2)],
    ["a completed one-day plan", { status: "completed", starts_on: at(-1), ends_on: at(-1), remaining: 0 }, at(-1)],
    ["a cancelled one-day plan", { status: "cancelled", starts_on: at(3), ends_on: at(3), remaining: 1 }, at(3)],
  ] as const)("%s shows its single date, not the same day twice", async (_why, sub, day) => {
    renderPlan(runtimeWith(async () => planState(sub as Partial<Subscription>, { deliveries: [] })));
    const hero = await screen.findByTestId("plan-hero");
    expect(within(hero).getByText(shortDate(day, "id"))).toBeTruthy();
    expect(within(hero).queryByText(/–/)).toBeNull();
  });

  it("a cancelled plan reads Paket dibatalkan with its dates, and offers nothing and lists nothing", async () => {
    // The plan's later days are still in the read; a cancelled plan does not list them as coming up.
    renderPlan(runtimeWith(async () => planState({ status: "cancelled", remaining: 4 })));
    const hero = await screen.findByTestId("plan-hero");
    expect(within(hero).getByText("Paket dibatalkan")).toBeTruthy();
    expect(within(hero).getByText(`${shortDate(at(-3), "id")} – ${shortDate(at(7), "id")}`)).toBeTruthy();
    expect(screen.queryByTestId("sticky-action")).toBeNull();
    expect(screen.queryByText("Berikutnya")).toBeNull();
    expect(screen.queryByTestId("plan-upcoming-row")).toBeNull();
    expect(screen.queryByText("Tidak ada antaran mendatang.")).toBeNull();
  });

  it("a plan in a status the screen does not know reads as not found and goes home", async () => {
    const usage: UsageMock = jest.fn(async () => undefined);
    renderPlan(runtimeWith(async () => planState({ status: "paused" }), usage));
    expect(await screen.findByText("Paket tidak ditemukan.")).toBeTruthy();
    expect(screen.queryByTestId("plan-hero")).toBeNull();
    expect(screen.queryByTestId("sticky-action")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Ke Beranda" }));
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(usageNames(usage)).not.toContain("plan_sheet_opened");
  });

  it("offline: the cached read shows the plan with no renew action", async () => {
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValueOnce({
      savedAt: "2026-10-07T23:12:00Z",
      data: planState({ remaining: 2, ends_on: at(2) }),
    });
    const runtime = runtimeWith(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    renderPlan(runtime);
    expect(await screen.findByText("2 hari lagi")).toBeTruthy();
    expect(screen.getByText(/Terakhir diperbarui 06\.12/)).toBeTruthy();
    expect(screen.queryByTestId("sticky-action")).toBeNull();
    expect(screen.queryByText("Lanjutkan paket")).toBeNull();
    expect(offline.loadCachedCustomer).toHaveBeenCalledWith("u-c1");
  });

  it("counts plan_sheet_opened once per open, however often the screen renders", async () => {
    const usage: UsageMock = jest.fn(async () => undefined);
    const runtime = runtimeWith(async () => planState(), usage);
    const view = renderPlan(runtime);
    expect(await screen.findByText("6 hari lagi")).toBeTruthy();
    view.rerender(
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <PlanDetailScreen />
      </MobileProvider>,
    );
    await act(async () => undefined);
    expect(usageNames(usage).filter((n) => n === "plan_sheet_opened")).toHaveLength(1);
    view.unmount();
    renderPlan(runtime);
    expect(await screen.findByText("6 hari lagi")).toBeTruthy();
    await waitFor(() => expect(usageNames(usage).filter((n) => n === "plan_sheet_opened")).toHaveLength(2));
  });
});

describe("plan links", () => {
  it("customerLink opens the plan detail and keeps the menu route", () => {
    expect(customerLink("/subscriptions/s-1")).toBe("/subscriptions/s-1");
    expect(customerLink("/subscriptions/s-1/menu?date=2026-11-02&meal=lunch")).toBe(
      "/pilih-menu/s-1?date=2026-11-02&meal=lunch",
    );
  });
});
