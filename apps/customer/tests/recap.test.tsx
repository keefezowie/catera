import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { addDays, type CustomerState, type Subscription } from "@catera/domain";
import { Beranda } from "../src/today/Beranda";
import { customerLink } from "../src/links";
import * as offline from "../src/today/offline";
import { delivery, offer, subscription } from "./fixtures";

// Whether Beranda is the screen in front. A pushed screen or the sign-in modal on top leaves Beranda mounted but
// unfocused; flipping this re-renders the subscribers, as the navigator does on a focus change.
const mockFocus = { value: true, listeners: new Set<() => void>() };
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
  useIsFocused: () =>
    require("react").useSyncExternalStore(
      (l: () => void) => {
        mockFocus.listeners.add(l);
        return () => mockFocus.listeners.delete(l);
      },
      () => mockFocus.value,
    ),
}));
const setFocused = (value: boolean) =>
  act(async () => {
    mockFocus.value = value;
    mockFocus.listeners.forEach((l) => l());
  });
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
// In-memory SecureStore, so the recap's seen mark persists within a test.
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

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const readStore = async (k: string) => (store.has(k) ? store.get(k)! : null);
const RECAP_KEY = "catera.recap.s-old";

// Thursday 8 October 2026, 10.00 in Jakarta. Only the clock is pinned: timers and microtasks run for real.
const NOW = new Date("2026-10-08T03:00:00Z");
const TODAY = "2026-10-08";
const pinToday = () =>
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };

/** The plan that is still running, with one delivery tomorrow so Beranda has a day to show. */
const livePlan = () =>
  subscription({ id: "s-1", starts_on: addDays(TODAY, -3), ends_on: addDays(TODAY, 8), remaining: 6 });

/** A full plan that ended yesterday, 21 September to 7 October, and was not renewed. */
const endedPlan = (extra: Partial<Subscription> = {}) =>
  subscription({
    id: "s-old",
    package_id: "p-keluarga",
    snapshot: {
      offer: offer({
        id: "p-keluarga",
        name: "Makan Malam Keluarga",
        image: "https://images.example.test/keluarga.jpg",
      }),
      total: 450000,
    } as unknown as Subscription["snapshot"],
    starts_on: "2026-09-21",
    ends_on: addDays(TODAY, -1),
    status: "completed",
    remaining: 0,
    ...extra,
  });

function stateWith(subscriptions: Subscription[], live = true): CustomerState {
  return {
    subscriptions,
    deliveries: live ? [delivery("d-next", addDays(TODAY, 1), { status: "scheduled" })] : [],
    addresses: [],
    notifications: [],
    cases: [],
  };
}

type UsageMock = jest.Mock<Promise<void>, [string, string]>;

function runtimeWith(read: () => Promise<unknown>, usage: UsageMock = jest.fn(async () => undefined)): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    customer: jest.fn(read),
    customerActions: jest.fn(async () => ({ total: 0, items: [] })),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
    usage,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const mount = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <Beranda />
    </MobileProvider>,
  );

/** Lets the session read and the storage reads land inside act, so a test never ends mid-update. */
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 10))));

/** Beranda with the live plan's line on screen, and every storage read settled. */
async function home(runtime: MobileRuntime) {
  const view = mount(runtime);
  await screen.findByRole("button", { name: "Makan Siang Rumahan, lihat detail paket" });
  await settle();
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  mockFocus.value = true;
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(readStore);
  pinToday();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("the Paket selesai recap", () => {
  it("shows the photo, the plan, the caterer and the dates of a plan that ended yesterday, above the plan lines", async () => {
    await home(runtimeWith(async () => stateWith([livePlan(), endedPlan()])));
    const card = within(screen.getByTestId("recap-card"));
    expect(card.getByRole("header", { name: "Paket selesai" })).toBeTruthy();
    expect(card.getByText("Makan Malam Keluarga · Dapur Contoh")).toBeTruthy();
    expect(card.getByText("Senin 21 Sep – Rabu 7 Okt")).toBeTruthy();
    // The photo is decoration for screen readers: the plan's name is in the text beside it.
    expect(card.getByTestId("recap-photo", { includeHiddenElements: true }).props.source).toEqual({ uri: "https://images.example.test/keluarga.jpg" });
    expect(card.getByRole("button", { name: "Lanjutkan paket" })).toBeTruthy();
    expect(card.getByRole("button", { name: "Tutup" })).toBeTruthy();
    // No meal count: the read cannot count an old plan's meals truthfully (Ruling D5).
    expect(card.queryByText(/porsi|kali makan|hari antar/)).toBeNull();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf("Paket selesai")).toBeLessThan(tree.indexOf("lihat detail paket"));
  });

  it("writes the seen mark on its first render and stays for the rest of the visit; the next visit has no card", async () => {
    const runtime = runtimeWith(async () => stateWith([livePlan(), endedPlan()]));
    const first = await home(runtime);
    expect(screen.getByTestId("recap-card")).toBeTruthy();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(RECAP_KEY, "seen");
    expect(store.get(RECAP_KEY)).toBe("seen");
    await settle();
    expect(screen.getByTestId("recap-card")).toBeTruthy();
    first.unmount();

    await home(runtimeWith(async () => stateWith([livePlan(), endedPlan()])));
    expect(screen.queryByTestId("recap-card")).toBeNull();
  });

  it("renders nothing until the seen mark has been read, so it never flashes", async () => {
    let answer: (v: string | null) => void = () => undefined;
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((k: string) =>
      k === RECAP_KEY ? new Promise<string | null>((r) => (answer = r)) : readStore(k),
    );
    await home(runtimeWith(async () => stateWith([livePlan(), endedPlan()])));
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(RECAP_KEY);
    expect(screen.queryByTestId("recap-card")).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(RECAP_KEY, "seen");

    await act(async () => answer(null));
    expect(await screen.findByTestId("recap-card")).toBeTruthy();
  });

  it("does not write the seen mark while Beranda is mounted behind another screen", async () => {
    // A pushed plan detail or the sign-in modal on top: Beranda reads the customer and renders, unseen.
    mockFocus.value = false;
    await home(runtimeWith(async () => stateWith([livePlan(), endedPlan()])));
    await settle();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(RECAP_KEY);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(RECAP_KEY, "seen");
    expect(store.has(RECAP_KEY)).toBe(false);
  });

  it("writes the seen mark on the first render with Beranda in front, once, and keeps the card for the visit", async () => {
    mockFocus.value = false;
    await home(runtimeWith(async () => stateWith([livePlan(), endedPlan()])));
    await setFocused(true);
    await settle();
    expect(screen.getByTestId("recap-card")).toBeTruthy();
    expect(store.get(RECAP_KEY)).toBe("seen");

    // Away to a pushed screen and back: same visit, same card, no second write.
    await setFocused(false);
    await setFocused(true);
    await settle();
    expect(screen.getByTestId("recap-card")).toBeTruthy();
    const writes = (SecureStore.setItemAsync as jest.Mock).mock.calls.filter(([k]) => k === RECAP_KEY);
    expect(writes).toEqual([[RECAP_KEY, "seen"]]);
  });

  it("shows nothing when the plan's seen mark is already stored", async () => {
    store.set(RECAP_KEY, "seen");
    await home(runtimeWith(async () => stateWith([livePlan(), endedPlan()])));
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(RECAP_KEY);
    expect(screen.queryByTestId("recap-card")).toBeNull();
    expect(screen.queryByText("Paket selesai")).toBeNull();
  });

  it("Tutup hides the card at once", async () => {
    await home(runtimeWith(async () => stateWith([livePlan(), endedPlan()])));
    fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
    expect(screen.queryByTestId("recap-card")).toBeNull();
    expect(screen.getByRole("button", { name: "Makan Siang Rumahan, lihat detail paket" })).toBeTruthy();
  });

  it("Lanjutkan paket opens the renewal and counts renew_started on each tap", async () => {
    const usage: UsageMock = jest.fn(async () => undefined);
    await home(runtimeWith(async () => stateWith([livePlan(), endedPlan()]), usage));
    const renew = screen.getByRole("button", { name: "Lanjutkan paket" });
    fireEvent.press(renew);
    expect(router.push).toHaveBeenCalledWith("/renew/s-old");
    fireEvent.press(renew);
    expect(router.push).toHaveBeenCalledTimes(2);
    const renewals = usage.mock.calls.filter(([name]) => name === "renew_started");
    expect(renewals).toEqual([
      ["renew_started", "customer"],
      ["renew_started", "customer"],
    ]);
  });

  it("keeps both buttons at 48dp or taller", async () => {
    await home(runtimeWith(async () => stateWith([livePlan(), endedPlan()])));
    for (const name of ["Lanjutkan paket", "Tutup"]) {
      const button = screen.getByRole("button", { name });
      expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(48);
    }
  });

  it.each([
    ["the plan was renewed", [endedPlan(), subscription({ id: "s-new", renewed_from: "s-old" })]],
    ["the plan was a trial", [livePlan(), endedPlan({ snapshot: { offer: offer(), trial: true, total: 30000 } as unknown as Subscription["snapshot"] })]],
    ["the plan ended 15 days ago", [livePlan(), endedPlan({ ends_on: addDays(TODAY, -15) })]],
    ["the plan ended 180 days ago", [livePlan(), endedPlan({ starts_on: addDays(TODAY, -200), ends_on: addDays(TODAY, -180) })]],
  ])("shows no card when %s", async (_why, subscriptions) => {
    await home(runtimeWith(async () => stateWith(subscriptions as Subscription[])));
    expect(screen.queryByTestId("recap-card")).toBeNull();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(RECAP_KEY, "seen");
  });

  it("names a one-day plan's single date, not the same day twice", async () => {
    await home(runtimeWith(async () => stateWith([livePlan(), endedPlan({ starts_on: addDays(TODAY, -1) })])));
    const card = within(screen.getByTestId("recap-card"));
    expect(card.getByText("Rabu 7 Okt")).toBeTruthy();
    expect(card.queryByText(/–/)).toBeNull();
  });

  it("still shows for a plan that ended 14 days ago", async () => {
    await home(runtimeWith(async () => stateWith([livePlan(), endedPlan({ ends_on: addDays(TODAY, -14) })])));
    expect(screen.getByTestId("recap-card")).toBeTruthy();
  });

  it("shows from the offline copy, and Lanjutkan paket still opens the renewal", async () => {
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValueOnce({
      savedAt: "2026-10-08T02:00:00Z",
      data: stateWith([livePlan(), endedPlan()]),
    });
    await home(
      runtimeWith(async () => {
        throw new Error("Network request failed");
      }),
    );
    expect(screen.getByText(/tidak ada koneksi/)).toBeTruthy();
    fireEvent.press(within(screen.getByTestId("recap-card")).getByRole("button", { name: "Lanjutkan paket" }));
    expect(router.push).toHaveBeenCalledWith("/renew/s-old");
  });

  it("shows on a Beranda with no running plan, above the catalogue invitation", async () => {
    mount(runtimeWith(async () => stateWith([endedPlan()], false)));
    expect(await screen.findByTestId("recap-card")).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf("Paket selesai")).toBeLessThan(tree.indexOf("Mau makan apa minggu ini?"));
  });

  it("shows one card at a time: the plan that ended last, then the next one on a later visit", async () => {
    const older = endedPlan({ id: "s-older", starts_on: "2026-09-14", ends_on: addDays(TODAY, -5) });
    const state = () => stateWith([livePlan(), older, endedPlan()]);
    const first = await home(runtimeWith(async () => state()));
    expect(screen.getAllByTestId("recap-card")).toHaveLength(1);
    expect(screen.getByText("Senin 21 Sep – Rabu 7 Okt")).toBeTruthy();
    expect(store.get("catera.recap.s-older")).toBeUndefined();
    first.unmount();

    await home(runtimeWith(async () => state()));
    expect(screen.getAllByTestId("recap-card")).toHaveLength(1);
    expect(screen.getByText("Senin 14 Sep – Sabtu 3 Okt")).toBeTruthy();
    expect(store.get("catera.recap.s-older")).toBe("seen");
  });

  it("speaks English", async () => {
    store.set("catera.locale", "en");
    mount(runtimeWith(async () => stateWith([livePlan(), endedPlan()])));
    const card = within(await screen.findByTestId("recap-card"));
    expect(card.getByText("Plan finished")).toBeTruthy();
    expect(card.getByText("Mon 21 Sep – Wed 7 Oct")).toBeTruthy();
    expect(card.getByRole("button", { name: "Continue this plan" })).toBeTruthy();
    expect(card.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Makan Siang Rumahan, see plan details" })).toBeTruthy();
    await settle();
  });
});

describe("the plan lines", () => {
  it("are 48dp buttons that open the plan's detail", async () => {
    await home(runtimeWith(async () => stateWith([livePlan()])));
    const line = screen.getByRole("button", { name: "Makan Siang Rumahan, lihat detail paket" });
    expect(StyleSheet.flatten(line.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(within(line).getByText(/6 hari lagi/)).toBeTruthy();
    fireEvent.press(line);
    expect(router.push).toHaveBeenCalledWith("/subscriptions/s-1");
  });

  it("give every running plan its own line", async () => {
    const second = subscription({
      id: "s-2",
      snapshot: { offer: offer({ name: "Makan Malam Hemat" }), total: 150000 } as unknown as Subscription["snapshot"],
      starts_on: addDays(TODAY, -1),
      ends_on: addDays(TODAY, 10),
      remaining: 9,
    });
    await home(runtimeWith(async () => stateWith([livePlan(), second])));
    fireEvent.press(screen.getByRole("button", { name: "Makan Malam Hemat, lihat detail paket" }));
    expect(router.push).toHaveBeenCalledWith("/subscriptions/s-2");
    await waitFor(() => expect(screen.queryByTestId("recap-card")).toBeNull());
  });
});
