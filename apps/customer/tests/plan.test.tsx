import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
import { NavigationContext } from "expo-router/react-navigation";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { shortDate, type CustomerState, type Delivery, type Offer, type Subscription, type UsageName } from "@catera/domain";
import { nativeLayout, nativeThemes } from "@catera/design-tokens";
import { LayoutScaleProvider, ThemeProvider } from "@catera/mobile-ui";
import { PlanDetailScreen } from "../src/plan/PlanDetail";
import { customerLink } from "../src/links";
import * as offline from "../src/today/offline";
import { delivery, offer, subscription } from "./fixtures";
import { goOffline, keptLine } from "./offline";

let mockParams: { id?: string; title?: string } = { id: "s-1" };
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
  forgetCachedCustomer: jest.fn(async () => undefined),
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
    <LayoutScaleProvider value="v2">
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <PlanDetailScreen />
      </MobileProvider>
    </LayoutScaleProvider>,
  );

const flat = (n: { props: { style?: unknown } }) => StyleSheet.flatten(n.props.style as never) as Record<string, unknown>;

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
  it("loading shows the plan skeleton, named Memuat paket, while the read is pending", async () => {
    renderPlan(runtimeWith(() => new Promise(() => undefined)));
    expect(await screen.findByRole("progressbar", { name: "Memuat paket" })).toBeTruthy();
    expect(screen.getByTestId("plan-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("sticky-action")).toBeNull();
  });

  it("a failed read says Belum bisa memuat paket and Coba lagi reads again", async () => {
    const runtime = runtimeWith(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    renderPlan(runtime);
    // Nothing is kept to show: the failure is the page, with the read error's own words and the way to try again.
    expect(await screen.findByText("Terlalu lama menunggu jawaban. Cek koneksi lalu coba lagi.")).toBeTruthy();
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

  it("a link's title names the plan only while it loads; a failed read or a missing plan says Paket", async () => {
    const carried = "Makan Siang Kantor";
    const nativeTitle = () => within(screen.getByTestId("screen-native-title")).getByRole("header").props.children;
    // Loading: the carried name, so "Paket" never flashes.
    mockParams = { id: "s-1", title: carried };
    let view = renderPlan(runtimeWith(() => new Promise(() => undefined)));
    await screen.findByTestId("plan-skeleton");
    expect(nativeTitle()).toBe(carried);
    view.unmount();
    // A failed read: the carried name was never checked against a plan, so the screen is "Paket" again.
    view = renderPlan(
      runtimeWith(async () => {
        throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      }),
    );
    await screen.findByText("Terlalu lama menunggu jawaban. Cek koneksi lalu coba lagi.");
    expect(nativeTitle()).toBe("Paket");
    expect(screen.queryByText(carried)).toBeNull();
    view.unmount();
    // A plan the read does not hold.
    mockParams = { id: "s-cancelled-elsewhere", title: carried };
    view = renderPlan(runtimeWith(async () => planState()));
    await screen.findByText("Paket tidak ditemukan.");
    expect(nativeTitle()).toBe("Paket");
    expect(screen.queryByText(carried)).toBeNull();
    view.unmount();
    // A long carried name is capped at 60 characters, at a word, with "…".
    mockParams = { id: "s-1", title: "Paket Makan Siang Rumahan Sehat Sekeluarga Lima Hari Kerja Penuh Gizi Seimbang" };
    renderPlan(runtimeWith(() => new Promise(() => undefined)));
    await screen.findByTestId("plan-skeleton");
    expect(nativeTitle()).toBe("Paket Makan Siang Rumahan Sehat Sekeluarga Lima Hari Kerja…");
  });

  it("an active plan that is not due: native title, hero with days left, no footer action", async () => {
    renderPlan(runtimeWith(async () => planState()));
    // The package name is the screen's native title (Android's first content line; iOS's large title) and there is no
    // mood header: the back is the platform's own. The caterer moved into the hero's meta line.
    // Waits for the plan itself: before the session is read the screen already has a title, over its skeleton.
    const hero = await screen.findByTestId("plan-hero");
    const title = screen.getByTestId("screen-native-title");
    expect(within(title).getByRole("header", { name: "Makan Siang Rumahan" })).toBeTruthy();
    expect(screen.queryByTestId("plan-caterer")).toBeNull();
    expect(screen.queryByTestId("plan-header")).toBeNull();
    expect(screen.queryByTestId("mood-header")).toBeNull();
    expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull();

    expect(within(hero).getByText("Dapur Contoh · makan siang")).toBeTruthy();
    expect(within(hero).getByText("6 hari lagi")).toBeTruthy();
    expect(within(hero).getByTestId("plan-photo").props.source).toEqual({ uri: "https://images.example.test/rumahan.jpg" });
    expect(within(hero).getByText(`${shortDate(at(-3), "id")} sampai ${shortDate(at(7), "id")}`)).toBeTruthy();
    expect(screen.queryByTestId("sticky-action")).toBeNull();
    expect(screen.queryByText("Sudah diperpanjang")).toBeNull();
  });

  it("the hero card is the Beranda hero's: photo 16:10 on top, radius 16 with no 10 frame, the mood fill with its shadow", async () => {
    renderPlan(runtimeWith(async () => planState()));
    const hero = await screen.findByTestId("plan-hero");
    expect(flat(hero)).toMatchObject({ borderRadius: nativeLayout.radius.card });
    expect(flat(hero).padding).toBeUndefined();
    expect(flat(within(hero).getByTestId("plan-hero-fill-siang"))).toMatchObject({ borderRadius: 16, borderWidth: 1.5 });
    expect(flat(within(hero).getByTestId("plan-hero-fill-siang")).boxShadow).toBeTruthy();
    expect(flat(within(hero).getByTestId("plan-photo-frame"))).toMatchObject({ aspectRatio: 16 / 10 });
    expect(nativeLayout.ratio.card).toBe(16 / 10);
    // The photo is the card's inner width: the 1.5 inset and the top corners are on the layer round it, never on the
    // node that has the ratio (margin and aspect ratio together make a node narrower than its slot on Android).
    const photo = flat(within(hero).getByTestId("plan-photo-frame"));
    for (const key of ["margin", "marginHorizontal", "marginLeft", "marginRight", "width", "padding"]) expect(photo[key]).toBeUndefined();
    expect(flat(within(hero).getByTestId("plan-photo-frame-inset"))).toMatchObject({
      margin: 1.5,
      borderTopLeftRadius: 14.5,
      borderTopRightRadius: 14.5,
      overflow: "hidden",
    });
    // The body pads 16 under the photo.
    expect(flat(within(hero).getByTestId("plan-hero-body"))).toMatchObject({ padding: 16 });
  });

  it("the hero's headline is the 24/30 heroTitle, its caterer and dates are meta lines", async () => {
    renderPlan(runtimeWith(async () => planState()));
    const hero = await screen.findByTestId("plan-hero");
    expect(flat(within(hero).getByText("6 hari lagi"))).toMatchObject({ fontSize: 24, lineHeight: 30 });
    expect(flat(within(hero).getByText("Dapur Contoh · makan siang"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    expect(flat(within(hero).getByText(`${shortDate(at(-3), "id")} sampai ${shortDate(at(7), "id")}`))).toMatchObject({ fontSize: 13 });
  });

  it("Berikutnya is a section heading over one card of this plan's next five days as 72 media rows", async () => {
    renderPlan(runtimeWith(async () => planState()));
    expect(await screen.findByText("Berikutnya")).toBeTruthy();
    expect(flat(screen.getByText("Berikutnya"))).toMatchObject({ fontSize: 20, lineHeight: 26 });
    expect(screen.getAllByTestId("list-card")).toHaveLength(1);
    const rows = screen.getAllByTestId("plan-upcoming-row");
    expect(rows).toHaveLength(5);
    expect(screen.queryByText("Paket Lain")).toBeNull();
    for (const row of rows) {
      expect(flat(row)).toMatchObject({ minHeight: 72 });
      expect(flat(within(row).getByTestId("plan-upcoming-row-thumb"))).toMatchObject({ width: 56, height: 56, borderRadius: 8 });
      expect(within(row).queryByTestId("plan-upcoming-row-chevron")).toBeNull(); // chevron is iOS-only
    }
    // Today's lunch is still to come, so today leads (dated as Beranda dates today), then tomorrow and the dinner day.
    expect(within(rows[0]).getByText(shortDate(DAY, "id"))).toBeTruthy();
    expect(flat(within(rows[1]).getByText(`Besok, ${shortDate(at(1), "id")}`))).toMatchObject({ fontSize: 17, lineHeight: 22 });
    const dishes = within(rows[1]).getByText("Ayam bakar madu, Sayur asem");
    expect(flat(dishes)).toMatchObject({ fontSize: 13, lineHeight: 18 });
    expect(dishes.props.numberOfLines).toBe(1);
    expect(within(rows[2]).getByText(shortDate(at(2), "id"))).toBeTruthy();
    expect(within(rows[2]).getByText("Ikan bakar")).toBeTruthy();
    // The photo is a plain 56 thumb, not the old ring.
    expect(screen.queryByTestId("photo-ring", { includeHiddenElements: true })).toBeNull();
    fireEvent.press(rows[1]);
    // The link carries the day, so the day sheet's bar is final on its first frame.
    expect(router.push).toHaveBeenCalledWith(`/hari/d-1?title=${encodeURIComponent(shortDate(at(1), "id"))}`);
  });

  it("the date is the title the row must show, so it may wrap at large text while the dishes stay one line", async () => {
    renderPlan(runtimeWith(async () => planState()));
    expect(await screen.findByText("Berikutnya")).toBeTruthy();
    const row = screen.getAllByTestId("plan-upcoming-row")[1];
    expect(within(row).getByText(`Besok, ${shortDate(at(1), "id")}`).props.numberOfLines).toBeUndefined();
    expect(within(row).getByText("Ayam bakar madu, Sayur asem").props.numberOfLines).toBe(1);
  });

  it("a day whose menu is not set says so on a not-set thumb", async () => {
    const bare = delivery("d-1", at(1), {}, { offer: offer({ menus: [] }) });
    renderPlan(runtimeWith(async () => planState({}, { deliveries: [bare] })));
    expect(await screen.findByText("Berikutnya")).toBeTruthy();
    const row = screen.getByTestId("plan-upcoming-row");
    expect(within(row).getByText("Menu belum diisi")).toBeTruthy();
    expect(within(row).getByTestId("plan-upcoming-row-thumb-not-set")).toBeTruthy();
  });

  it("the rows carry no per-row ...: every day action lives in the day sheet", async () => {
    renderPlan(runtimeWith(async () => planState()));
    expect(await screen.findByText("Berikutnya")).toBeTruthy();
    expect(screen.queryByTestId("header-more")).toBeNull();
    expect(screen.queryByTestId("day-more-slot", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Pilihan untuk/ })).toBeNull();
  });

  it("offline, the kept copy still lists the rows (they open the day sheet) and offers no action", async () => {
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValueOnce({ savedAt: "2026-10-07T23:12:00Z", data: planState() });
    renderPlan(
      runtimeWith(async () => {
        throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      }),
    );
    expect(await screen.findByText("Berikutnya")).toBeTruthy();
    expect(screen.getAllByTestId("plan-upcoming-row").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("header-more")).toBeNull();
    expect(screen.queryByTestId("sticky-action")).toBeNull();
  });

  it("today's day leaves Berikutnya once its meal has arrived", async () => {
    const deliveries = [delivery("d-today", DAY, { status: "delivered" }), delivery("d-1", at(1))];
    renderPlan(runtimeWith(async () => planState({}, { deliveries })));
    expect(await screen.findByText("Berikutnya")).toBeTruthy();
    const rows = screen.getAllByTestId("plan-upcoming-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText(`Besok, ${shortDate(at(1), "id")}`)).toBeTruthy();
  });

  it("a one-day trial on its day lists that day under Berikutnya, not an empty line", async () => {
    const trial = { offer: offer(), total: 30000, trial: true } as unknown as Subscription["snapshot"];
    renderPlan(
      runtimeWith(async () =>
        planState(
          { snapshot: trial, starts_on: DAY, ends_on: DAY, remaining: 1 },
          { deliveries: [delivery("d-today", DAY)] },
        ),
      ),
    );
    const hero = await screen.findByTestId("plan-hero");
    expect(within(hero).getByText("1 hari lagi")).toBeTruthy();
    const rows = screen.getAllByTestId("plan-upcoming-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText(shortDate(DAY, "id"))).toBeTruthy();
    expect(screen.queryByText("Belum ada pengantaran berikutnya.")).toBeNull();
    fireEvent.press(rows[0]);
    expect(router.push).toHaveBeenCalledWith(`/hari/d-today?title=${encodeURIComponent(shortDate(DAY, "id"))}`);
  });

  it("in dark the hero's text reads the mood's hero inks and the rows sit on the dark surface", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    render(
      <LayoutScaleProvider value="v2">
        <ThemeProvider storageKey="plan-dark-test">
          <MobileProvider runtime={runtimeWith(async () => planState())} linkMapper={customerLink}>
            <PlanDetailScreen />
          </MobileProvider>
        </ThemeProvider>
      </LayoutScaleProvider>,
    );
    const hero = await screen.findByTestId("plan-hero");
    expect(flat(within(hero).getByText("6 hari lagi")).color).toBeTruthy();
    expect(flat(within(hero).getByText("6 hari lagi")).color).not.toBe(nativeThemes.light.charcoal);
    expect(flat(screen.getByTestId("list-card")).backgroundColor).toBe(nativeThemes.dark.surface);
  });

  it("the sticky action keeps its place and conditions under the new hero (renewal due)", async () => {
    renderPlan(runtimeWith(async () => planState({ remaining: 2, ends_on: at(2) })));
    const action = await screen.findByTestId("sticky-action");
    expect(within(action).getByRole("button", { name: "Lanjutkan paket" })).toBeTruthy();
    // The hero carries no second renew button: the one primary control is the footer.
    expect(within(screen.getByTestId("plan-hero")).queryByRole("button")).toBeNull();
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
    // Paket opens named after the package, never "Paket", while it loads.
    expect(router.push).toHaveBeenCalledWith(`/paket/p-rumahan?title=${encodeURIComponent(offer().name)}`);
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
    expect(within(hero).getByText(`${shortDate(at(-7), "id")} sampai ${shortDate(at(-3), "id")}`)).toBeTruthy();
    expect(screen.getByText("Belum ada pengantaran berikutnya.")).toBeTruthy();
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
    expect(within(hero).getByText(`${shortDate(at(-3), "id")} sampai ${shortDate(at(7), "id")}`)).toBeTruthy();
    expect(screen.queryByTestId("sticky-action")).toBeNull();
    expect(screen.queryByText("Berikutnya")).toBeNull();
    expect(screen.queryByTestId("plan-upcoming-row")).toBeNull();
    expect(screen.queryByText("Belum ada pengantaran berikutnya.")).toBeNull();
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
    goOffline();
    renderPlan(runtime);
    expect(await screen.findByText("2 hari lagi")).toBeTruthy();
    expect(await screen.findByText("Tidak ada koneksi")).toBeTruthy();
    expect(screen.getByText(keptLine("2026-10-07T23:12:00Z"))).toBeTruthy();
    expect(screen.queryByText(/Terakhir diperbarui/)).toBeNull();
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
      <LayoutScaleProvider value="v2">
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <PlanDetailScreen />
        </MobileProvider>
      </LayoutScaleProvider>,
    );
    await act(async () => undefined);
    expect(usageNames(usage).filter((n) => n === "plan_sheet_opened")).toHaveLength(1);
    view.unmount();
    renderPlan(runtime);
    expect(await screen.findByText("6 hari lagi")).toBeTruthy();
    await waitFor(() => expect(usageNames(usage).filter((n) => n === "plan_sheet_opened")).toHaveLength(2));
  });
});

describe("Plan detail chat in the native header", () => {
  /** The screen's own stack entry, as the native stack hands it over. */
  const navigation = { setOptions: jest.fn(), isFocused: () => true, addListener: () => () => undefined };
  type HeaderRight = (() => React.ReactElement) | undefined;
  const lastHeaderRight = (): HeaderRight => {
    const calls = navigation.setOptions.mock.calls.filter(([o]) => "headerRight" in (o as object));
    return calls.length ? (calls[calls.length - 1][0] as { headerRight: HeaderRight }).headerRight : undefined;
  };
  const renderInStack = (runtime: MobileRuntime) =>
    render(
      <NavigationContext.Provider value={navigation as never}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <PlanDetailScreen />
        </MobileProvider>
      </NavigationContext.Provider>,
    );
  const PHONE = "081234567890";
  const withPhone = () =>
    planState({}, { deliveries: [delivery("d-today", DAY, {}, { catererPhone: PHONE }), delivery("d-1", at(1))] });

  it("a plan with the caterer's number gets a trailing chat button that opens WhatsApp", async () => {
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    renderInStack(runtimeWith(async () => withPhone()));
    expect(await screen.findByTestId("plan-hero")).toBeTruthy();
    await waitFor(() => expect(lastHeaderRight()).toBeDefined());
    const bar = render(lastHeaderRight()!());
    const chat = bar.getByRole("button", { name: "Chat Dapur Contoh" });
    expect(chat.props.testID).toBe("header-chat");
    fireEvent.press(chat);
    // The same link ChatKatering opens: wa.me with the number in international form and no prefilled text.
    expect(openUrl).toHaveBeenCalledWith("https://wa.me/6281234567890?text=");
    openUrl.mockRestore();
  });

  it("a plan without the caterer's number has no chat button", async () => {
    renderInStack(runtimeWith(async () => planState()));
    expect(await screen.findByTestId("plan-hero")).toBeTruthy();
    await act(async () => undefined);
    expect(navigation.setOptions).toHaveBeenCalledWith(expect.objectContaining({ headerRight: undefined }));
    expect(lastHeaderRight()).toBeUndefined();
  });

  it("another plan's number does not put a chat button on this plan", async () => {
    const other = delivery("d-other", at(2), {}, { subscription_id: "s-other", catererPhone: PHONE });
    renderInStack(runtimeWith(async () => planState({}, { deliveries: [delivery("d-today", DAY), other] })));
    expect(await screen.findByTestId("plan-hero")).toBeTruthy();
    await act(async () => undefined);
    expect(lastHeaderRight()).toBeUndefined();
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
