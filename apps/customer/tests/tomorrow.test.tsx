import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Image, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import {
  addDays,
  shortDate,
  tomorrowStory,
  type CustomerState,
  type Delivery,
  type Offer,
} from "@catera/domain";
import { nativeThemes } from "@catera/design-tokens";
import { Beranda } from "../src/today/Beranda";
import { TomorrowRow } from "../src/tomorrow/TomorrowRow";
import { TomorrowStoryScreen } from "../src/tomorrow/TomorrowStory";
import { customerLink } from "../src/links";
import { delivery, offer, subscription, TODAY } from "./fixtures";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: jest.fn(() => ({})),
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

const TOMORROW = addDays(TODAY, 1);
// 12.00 Jakarta, before the fixtures' 17.00 cutoff of tomorrow, and 18.00, after it.
const BEFORE_CUTOFF = new Date(`${TODAY}T05:00:00Z`);
const AFTER_CUTOFF = new Date(`${TODAY}T11:00:00Z`);

// Only the clock is pinned: timers, microtasks and animation frames keep running for real.
const pinClock = (now: Date) =>
  jest.useFakeTimers({
    now,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });

const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;
const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };

const PACKAGE_PHOTO = "https://images.example.test/paket-senja.jpg";
const AYAM_PHOTO = "https://images.example.test/ayam-bakar.jpg";
const SATE_PHOTO = "https://images.example.test/sate.jpg";

const lunchMenu = {
  meal: "lunch",
  name: "Nasi putih, Ayam bakar madu, Sayur asem",
  description: "",
  image: "",
  contentModel: "slots",
  items: [
    { id: "l-1", name: "Nasi putih", groupId: "g-nasi", image: "" },
    { id: "l-2", name: "Ayam bakar madu", groupId: "g-lauk", categoryId: "main", image: AYAM_PHOTO },
    { id: "l-3", name: "Sayur asem", groupId: "g-sayur", image: "" },
  ],
} as unknown as Offer["menus"][number];
const dinnerMenu = {
  meal: "dinner",
  name: "Sate ayam madura, Tumis kangkung",
  description: "",
  image: "",
  contentModel: "slots",
  items: [
    { id: "d-1", name: "Sate ayam madura", groupId: "g-lauk", categoryId: "main", image: SATE_PHOTO },
    { id: "d-2", name: "Tumis kangkung", groupId: "g-sayur", image: "" },
  ],
} as unknown as Offer["menus"][number];
// A dinner nobody has filled in yet.
const emptyDinner = { meal: "dinner", name: "", description: "", image: "" } as unknown as Offer["menus"][number];

const senja = (menus: Offer["menus"], meal: Offer["meal"] = "both") =>
  offer({ caterer: "Dapur Senja", image: PACKAGE_PHOTO, meal, menus });

/** A delivery tomorrow; its cutoff is the fixtures' 17.00 the day before. */
function tomorrowDelivery(id: string, o: Offer, meals: ("lunch" | "dinner")[]): Delivery {
  return delivery(id, TOMORROW, {}, { offer: o, meals: meals.map((meal) => ({ meal, status: "scheduled" })) });
}

const stateWith = (...deliveries: Delivery[]): CustomerState => ({
  subscriptions: [subscription()],
  deliveries,
  addresses: [],
  notifications: [],
  cases: [],
});

const bothState = () => stateWith(tomorrowDelivery("d-both", senja([lunchMenu, dinnerMenu]), ["lunch", "dinner"]));
const lunchOnlyState = () => stateWith(tomorrowDelivery("d-one", senja([lunchMenu], "lunch"), ["lunch"]));
const unsetDinnerState = () =>
  stateWith(tomorrowDelivery("d-both", senja([lunchMenu, emptyDinner]), ["lunch", "dinner"]));
/** A plan whose days cannot move (a fixed package): `canChange` is false, but its cutoff still comes and goes. */
const fixedState = () =>
  stateWith({
    ...tomorrowDelivery("d-fixed", senja([lunchMenu, dinnerMenu]), ["lunch", "dinner"]),
    canChange: false,
  });
const twoLunchesState = () =>
  stateWith(
    tomorrowDelivery("d-a", senja([lunchMenu], "lunch"), ["lunch"]),
    tomorrowDelivery("d-b", senja([lunchMenu], "lunch"), ["lunch"]),
  );
const noTomorrowState = () => stateWith(delivery("d-later", addDays(TODAY, 2)));

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

const wrap = (runtime: MobileRuntime, node: ReactNode) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {node}
    </MobileProvider>,
  );

/** Lets the provider's session read and the seen-mark reads land inside act, so a test never ends mid-update. */
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 10))));

const storyOf =(state: CustomerState, now: Date) => tomorrowStory(state, now, "id")!;
const ringStyles = () => screen.getAllByTestId("photo-ring").map((r) => StyleSheet.flatten(r.props.style));
const coveredCount = () => screen.queryAllByTestId("photo-ring-covered").length;
const seenKey = (runtime: MobileRuntime, id: string, meal: string) => runtime.storageKey(`story.${id}.${meal}`);

beforeEach(() => {
  jest.clearAllMocks();
  store().clear();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("Menu besok row", () => {
  it("before the cutoff shows one 60dp ring per part, lunch in sunrise ink and dinner in forest, none covered", async () => {
    pinClock(BEFORE_CUTOFF);
    const runtime = runtimeWith(async () => bothState());
    wrap(runtime, <TomorrowRow story={storyOf(bothState(), BEFORE_CUTOFF)} />);
    await settle();
    expect(screen.getByText("Menu besok")).toBeTruthy();
    expect(screen.getByText(shortDate(TOMORROW, "id"))).toBeTruthy();
    expect(screen.getByText("Bisa diubah sampai hari ini 17.00")).toBeTruthy();
    const rings = ringStyles();
    expect(rings).toHaveLength(2);
    expect(rings.map((r) => r.width)).toEqual([60, 60]);
    expect(rings.map((r) => r.borderColor)).toEqual([nativeThemes.light.sunriseInk, nativeThemes.light.forest]);
    expect(coveredCount()).toBe(0);
  });

  it("after the cutoff says the day is closed and covers every ring until its part has been seen", async () => {
    pinClock(AFTER_CUTOFF);
    const runtime = runtimeWith(async () => bothState());
    store().set(seenKey(runtime, "d-both", "dinner"), "seen");
    wrap(runtime, <TomorrowRow story={storyOf(bothState(), AFTER_CUTOFF)} />);
    expect(screen.getByText("Sudah lewat batas ubah")).toBeTruthy();
    expect(screen.queryByText(/Bisa diubah sampai/)).toBeNull();
    // Dinner was seen, so only lunch stays covered once the stored marks have been read.
    await waitFor(() => expect(coveredCount()).toBe(1));
    expect(screen.UNSAFE_getAllByType(Image).some((i) => i.props.source?.uri === SATE_PHOTO)).toBe(true);
    expect(screen.UNSAFE_getAllByType(Image).some((i) => i.props.source?.uri === AYAM_PHOTO)).toBe(false);
  });

  it("covers both rings after the cutoff when nothing was seen", async () => {
    pinClock(AFTER_CUTOFF);
    const runtime = runtimeWith(async () => bothState());
    wrap(runtime, <TomorrowRow story={storyOf(bothState(), AFTER_CUTOFF)} />);
    await waitFor(() =>
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(seenKey(runtime, "d-both", "dinner")),
    );
    expect(coveredCount()).toBe(2);
  });

  it("before the cutoff, a plan whose days cannot move shows its dishes and no closed message", async () => {
    pinClock(BEFORE_CUTOFF);
    const runtime = runtimeWith(async () => fixedState());
    wrap(runtime, <TomorrowRow story={storyOf(fixedState(), BEFORE_CUTOFF)} />);
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalled());
    expect(coveredCount()).toBe(0);
    expect(screen.queryByText("Sudah lewat batas ubah")).toBeNull();
    expect(screen.queryByText(/Bisa diubah sampai/)).toBeNull();
    expect(screen.getByRole("button", { name: "Menu besok, makan siang, Ayam bakar madu" })).toBeTruthy();
  });

  it("after the cutoff, a plan whose days cannot move is closed and covered until seen like any other", async () => {
    pinClock(AFTER_CUTOFF);
    const runtime = runtimeWith(async () => fixedState());
    wrap(runtime, <TomorrowRow story={storyOf(fixedState(), AFTER_CUTOFF)} />);
    expect(screen.getByText("Sudah lewat batas ubah")).toBeTruthy();
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalled());
    expect(coveredCount()).toBe(2);
  });

  it("names each ring by meal and dish, or says the menu is not set", async () => {
    pinClock(BEFORE_CUTOFF);
    const runtime = runtimeWith(async () => unsetDinnerState());
    wrap(runtime, <TomorrowRow story={storyOf(unsetDinnerState(), BEFORE_CUTOFF)} />);
    await settle();
    expect(screen.getByRole("button", { name: "Menu besok, makan siang, Ayam bakar madu" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Menu besok, makan malam, Menu belum diisi" })).toBeTruthy();
  });

  it("does not name the dish on a covered ring, and names it once the part has been seen", async () => {
    pinClock(AFTER_CUTOFF);
    const runtime = runtimeWith(async () => bothState());
    store().set(seenKey(runtime, "d-both", "dinner"), "seen");
    wrap(runtime, <TomorrowRow story={storyOf(bothState(), AFTER_CUTOFF)} />);
    expect(screen.getByRole("button", { name: "Menu besok, makan siang, tertutup, buka untuk melihat" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ayam bakar madu/ })).toBeNull();
    // Dinner was seen, so once the marks are read it is named again.
    expect(await screen.findByRole("button", { name: "Menu besok, makan malam, Sate ayam madura" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Menu besok, makan siang, tertutup, buka untuk melihat" })).toBeTruthy();
  });

  it("opens the story at the pressed ring", async () => {
    pinClock(BEFORE_CUTOFF);
    const runtime = runtimeWith(async () => bothState());
    wrap(runtime, <TomorrowRow story={storyOf(bothState(), BEFORE_CUTOFF)} />);
    await settle();
    fireEvent.press(screen.getByRole("button", { name: "Menu besok, makan malam, Sate ayam madura" }));
    expect(router.push).toHaveBeenCalledWith("/tomorrow?part=1");
    fireEvent.press(screen.getByRole("button", { name: "Menu besok, makan siang, Ayam bakar madu" }));
    expect(router.push).toHaveBeenLastCalledWith("/tomorrow?part=0");
  });

  it("is on Beranda when tomorrow has a delivery and absent when it has none", async () => {
    pinClock(BEFORE_CUTOFF);
    const view = wrap(runtimeWith(async () => bothState()), <Beranda />);
    expect(await screen.findByText("Menu besok")).toBeTruthy();
    expect(screen.getAllByTestId("photo-ring")).toHaveLength(2);
    view.unmount();
    wrap(runtimeWith(async () => noTomorrowState()), <Beranda />);
    await screen.findByText(/hari lagi/);
    expect(screen.queryByText("Menu besok")).toBeNull();
  });

  it("gives two lunches on one day one ring each", async () => {
    pinClock(BEFORE_CUTOFF);
    const state = twoLunchesState();
    wrap(runtimeWith(async () => state), <TomorrowRow story={storyOf(state, BEFORE_CUTOFF)} />);
    await settle();
    expect(ringStyles().map((r) => r.borderColor)).toEqual([nativeThemes.light.sunriseInk, nativeThemes.light.sunriseInk]);
  });
});

describe("Menu besok story", () => {
  const open = async (state: () => CustomerState, now: Date, usage?: UsageMock) => {
    pinClock(now);
    const runtime = runtimeWith(async () => state(), usage);
    wrap(runtime, <TomorrowStoryScreen />);
    await screen.findByTestId("story-viewer");
    await settle();
    return runtime;
  };
  const header = () => screen.getByTestId("story-viewer-header").props.accessibilityLabel as string;

  it("opens on lunch with the date and position in the header, the sticker and the dish", async () => {
    await open(bothState, BEFORE_CUTOFF);
    expect(header()).toBe(`Menu besok · ${shortDate(TOMORROW, "id")} · 1 dari 2`);
    expect(screen.getByText("Makan siang · 11.00–13.00")).toBeTruthy();
    expect(screen.getByText("Ayam bakar madu")).toBeTruthy();
    expect(screen.getByText("Dapur Senja · Nasi putih, Sayur asem")).toBeTruthy();
    expect(screen.UNSAFE_getAllByType(Image).some((i) => i.props.source?.uri === AYAM_PHOTO)).toBe(true);
  });

  it("moves to dinner with Lihat menu malam, then ends with Selesai, which closes", async () => {
    await open(bothState, BEFORE_CUTOFF);
    fireEvent.press(screen.getByRole("button", { name: "Lihat menu malam" }));
    await settle();
    expect(header()).toBe(`Menu besok · ${shortDate(TOMORROW, "id")} · 2 dari 2`);
    expect(screen.getByText("Makan malam · 17.00–19.00")).toBeTruthy();
    expect(screen.getByText("Sate ayam madura")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lihat menu malam" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("starts at the part the row pressed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ part: "1" });
    await open(bothState, BEFORE_CUTOFF);
    expect(header()).toBe(`Menu besok · ${shortDate(TOMORROW, "id")} · 2 dari 2`);
    expect(screen.getByRole("button", { name: "Selesai" })).toBeTruthy();
  });

  it("keeps a part out of range on the last one", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ part: "9" });
    await open(bothState, BEFORE_CUTOFF);
    expect(header()).toBe(`Menu besok · ${shortDate(TOMORROW, "id")} · 2 dari 2`);
  });

  it("says the menu is not set by the caterer, over the package photo", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ part: "1" });
    await open(unsetDinnerState, BEFORE_CUTOFF);
    expect(screen.getByText("Menu belum diisi oleh Dapur Senja")).toBeTruthy();
    expect(screen.UNSAFE_getAllByType(Image).some((i) => i.props.source?.uri === PACKAGE_PHOTO)).toBe(true);
  });

  it("writes the seen mark of each part as it is shown", async () => {
    const runtime = await open(bothState, BEFORE_CUTOFF);
    await waitFor(() =>
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(seenKey(runtime, "d-both", "lunch"), "seen"),
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(seenKey(runtime, "d-both", "dinner"), "seen");
    fireEvent.press(screen.getByRole("button", { name: "Lihat menu malam" }));
    await waitFor(() =>
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(seenKey(runtime, "d-both", "dinner"), "seen"),
    );
    await settle();
  });

  it("counts tomorrow_story_viewed once per open, however many parts are shown", async () => {
    const usage: UsageMock = jest.fn(async () => undefined);
    await open(bothState, BEFORE_CUTOFF, usage);
    const counts = () => usage.mock.calls.filter(([name]) => name === "tomorrow_story_viewed");
    await waitFor(() => expect(counts()).toHaveLength(1));
    expect(counts()[0]).toEqual(["tomorrow_story_viewed", "customer"]);
    fireEvent.press(screen.getByRole("button", { name: "Lihat menu malam" }));
    await screen.findByText("Sate ayam madura");
    await settle();
    expect(counts()).toHaveLength(1);
  });

  it("offers Ubah hari before the cutoff and opens the day", async () => {
    await open(bothState, BEFORE_CUTOFF);
    expect(screen.getByText("Bisa diubah sampai hari ini 17.00")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Ubah hari" }));
    expect(router.push).toHaveBeenCalledWith("/hari/d-both");
  });

  it("after the cutoff says the day is closed and offers no Ubah hari", async () => {
    await open(bothState, AFTER_CUTOFF);
    expect(screen.getByText("Sudah lewat batas ubah")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ubah hari" })).toBeNull();
    expect(screen.queryByText(/Bisa diubah sampai/)).toBeNull();
  });

  it("before the cutoff, a plan whose days cannot move has no deadline line and no Ubah hari", async () => {
    await open(fixedState, BEFORE_CUTOFF);
    expect(screen.getByText("Ayam bakar madu")).toBeTruthy();
    expect(screen.queryByText("Sudah lewat batas ubah")).toBeNull();
    expect(screen.queryByText(/Bisa diubah sampai/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Ubah hari" })).toBeNull();
    // The way on is still there.
    expect(screen.getByRole("button", { name: "Lihat menu malam" })).toBeTruthy();
  });

  it("after the cutoff, a plan whose days cannot move reads as closed", async () => {
    await open(fixedState, AFTER_CUTOFF);
    expect(screen.getByText("Sudah lewat batas ubah")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ubah hari" })).toBeNull();
  });

  it("offers Lihat menu siang when the next part is a second lunch", async () => {
    await open(twoLunchesState, BEFORE_CUTOFF);
    expect(header()).toBe(`Menu besok · ${shortDate(TOMORROW, "id")} · 1 dari 2`);
    expect(screen.queryByRole("button", { name: "Lihat menu malam" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Lihat menu siang" }));
    await settle();
    expect(header()).toBe(`Menu besok · ${shortDate(TOMORROW, "id")} · 2 dari 2`);
    expect(screen.getByRole("button", { name: "Selesai" })).toBeTruthy();
  });

  it("gives a one-meal day one bar and Selesai", async () => {
    await open(lunchOnlyState, BEFORE_CUTOFF);
    // The bars are decoration, hidden from screen readers, so they are found with `hidden`.
    expect(screen.getByTestId("story-viewer-bar-0", { hidden: true })).toBeTruthy();
    expect(screen.queryByTestId("story-viewer-bar-1", { hidden: true })).toBeNull();
    expect(header()).toBe(`Menu besok · ${shortDate(TOMORROW, "id")} · 1 dari 1`);
    fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("closes with the close button", async () => {
    await open(bothState, BEFORE_CUTOFF);
    fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("reads Memuat menu besok while the read is out, with a way out", async () => {
    pinClock(BEFORE_CUTOFF);
    wrap(runtimeWith(() => new Promise(() => undefined)), <TomorrowStoryScreen />);
    expect(await screen.findByText("Memuat menu besok…")).toBeTruthy();
    await settle();
    fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("reads Belum bisa memuat with Coba lagi, which reads again", async () => {
    pinClock(BEFORE_CUTOFF);
    const read = jest
      .fn<Promise<unknown>, []>()
      .mockRejectedValueOnce(new Error("NETWORK"))
      .mockResolvedValue(bothState());
    wrap(runtimeWith(read), <TomorrowStoryScreen />);
    expect(await screen.findByText("Belum bisa memuat")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByText("Ayam bakar madu")).toBeTruthy();
    await settle();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("reads Belum ada antaran besok with a close button when tomorrow has no delivery", async () => {
    pinClock(BEFORE_CUTOFF);
    wrap(runtimeWith(async () => noTomorrowState()), <TomorrowStoryScreen />);
    expect(await screen.findByText("Belum ada antaran besok.")).toBeTruthy();
    await settle();
    expect(screen.queryByTestId("story-viewer")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("shows the unveiled photo on the row after the story has been opened", async () => {
    pinClock(AFTER_CUTOFF);
    const runtime = runtimeWith(async () => bothState());
    const view = wrap(
      runtime,
      <>
        <TomorrowRow story={storyOf(bothState(), AFTER_CUTOFF)} />
        <TomorrowStoryScreen />
      </>,
    );
    await screen.findByTestId("story-viewer");
    // Lunch was shown by the story, and the row, still mounted behind it, uncovers that ring.
    await waitFor(() => expect(coveredCount()).toBe(1));
    await settle();
    view.unmount();
  });
});

describe("Menu besok story look", () => {
  it("sets the sticker on a cream fill with a sunrise ink border, tilted two degrees", async () => {
    pinClock(BEFORE_CUTOFF);
    wrap(runtimeWith(async () => bothState()), <TomorrowStoryScreen />);
    const sticker = await screen.findByTestId("tomorrow-sticker");
    await settle();
    const style = StyleSheet.flatten(sticker.props.style);
    expect(style.backgroundColor).toBe(nativeThemes.light.cream);
    expect(style.borderColor).toBe(nativeThemes.light.sunriseInk);
    expect(style.borderWidth).toBe(1.5);
    expect(style.transform).toEqual([{ rotate: "-2deg" }]);
    expect(within(sticker).getByText("Makan siang · 11.00–13.00")).toBeTruthy();
  });

  it("keeps the bottom text on a scrim that is at least 0.85 opaque where the text starts", async () => {
    pinClock(BEFORE_CUTOFF);
    wrap(runtimeWith(async () => bothState()), <TomorrowStoryScreen />);
    const scrim = await screen.findByTestId("tomorrow-scrim");
    await settle();
    const image = String(StyleSheet.flatten(scrim.props.style).experimental_backgroundImage);
    expect(image).toContain("rgba(11,31,22,0.92)");
    const solid = /rgba\(11,31,22,(0\.\d+)\) (\d+)px/.exec(image);
    expect(Number(solid?.[1])).toBeGreaterThanOrEqual(0.85);
  });
});
