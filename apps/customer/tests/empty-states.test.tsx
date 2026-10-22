import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet, Text } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { ApiError } from "@catera/api-client";
import { addDays, jakartaDay, monthOf, monthWeeks, type ClaimPreview, type CustomerState } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ThemeProvider, type MascotPose } from "@catera/mobile-ui";
import ClaimRoute from "../app/claim/[token]";
import LoginRoute from "../app/login";
import { Payments } from "../src/account/Payments";
import { Addresses } from "../src/account/Addresses";
import { NotificationsScreen } from "../src/account/Notifications";
import { BuyScreen } from "../src/buy/BuyScreen";
import { PaymentScreen } from "../src/buy/PaymentScreen";
import { Jelajah } from "../src/discover/Jelajah";
import { PackageDetail } from "../src/discover/PackageDetail";
import { SavedList } from "../src/discover/SavedList";
import { ReportList } from "../src/help/ReportList";
import { customerLink } from "../src/links";
import { PlanDetailScreen } from "../src/plan/PlanDetail";
import { PaketSaya, PlanList } from "../src/plan/PlanList";
import { ChooseMenu } from "../src/schedule/ChooseMenu";
import { DayScreen } from "../src/schedule/DayScreen";
import { Jadwal } from "../src/schedule/Jadwal";
import { AppProviders } from "../src/shell";
import { Beranda } from "../src/today/Beranda";
import { TomorrowStoryScreen } from "../src/tomorrow/TomorrowStory";
import { customerState, delivery, offer, subscription, TODAY, morningOf } from "./fixtures";

/**
 * Spec 7.2, Task 13: every empty and error state of the customer app shows its delivered mascot still, 120pt and
 * centred above its title (96 on a 360dp phone at font scale 1.3), decorative for screen readers, and never beside a
 * photo of food. The state's own copy and action are unchanged.
 */

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), dismissTo: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]),
}));
jest.mock("expo-router/react-navigation", () => ({
  ...jest.requireActual("expo-router/react-navigation"),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: () => () => undefined, dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[synthetic]" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "synthetic-project" } } } },
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
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
  forgetCachedCustomer: jest.fn(async () => undefined),
  clearCachedCustomer: jest.fn(async () => undefined),
}));

/** The phone the state is drawn on: a 411dp phone at the default text size unless a test says otherwise. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
/** Mascot art is hidden from screen readers, so the queries that look for it opt in to hidden elements. */
const hidden = { includeHiddenElements: true };
const POSES: MascotPose[] = ["merayakan", "membaca", "tidur", "bingung", "melambai", "mencari", "memasak"];
const offline = () => new ApiError("REQUEST_TIMEOUT");

/** Synthetic claim preview: no real caterer, customer or phone number. */
const claim: ClaimPreview = {
  catererName: "Dapur Contoh",
  packageName: "Makan Siang Rumahan",
  remainingDays: 9,
  nextDate: "2026-10-08",
  nextWindow: "11.00–13.00",
  addressLabel: "Kantor Sudirman",
  maskedPhone: "0812-•••-0001",
};

function runtimeWith(api: Record<string, unknown> = {}, actor: Record<string, unknown> | null = customer): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    customer: jest.fn(async () => customerState(null)),
    customerActions: jest.fn(async () => ({ total: 0, items: [] })),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    savedPackages: jest.fn(async () => ({ packageIds: [], items: [], nextCursor: null })),
    offer: jest.fn(async () => ({ offer: null })),
    request: jest.fn(async () => []),
    claimPreview: jest.fn(async () => claim),
    usage: jest.fn(async () => undefined),
    ...api,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

/** A plan still running whose deliveries are all behind it: nothing today, nothing next. */
function nothingNext(): CustomerState {
  return {
    ...customerState(null),
    deliveries: [delivery("d-past", addDays(TODAY, -2), { status: "delivered" })],
  };
}

const wrap = (runtime: MobileRuntime, ui: ReactElement) => (
  <ThemeProvider storageKey="catera.test.theme">
    <MoodProvider now={() => morningOf(TODAY)}>
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        {ui}
      </MobileProvider>
    </MoodProvider>
  </ThemeProvider>
);

type State = {
  name: string;
  pose: MascotPose;
  runtime: () => MobileRuntime;
  ui: ReactElement;
  params?: Record<string, string>;
  /** The state's own text, unchanged by the art. */
  copy: (string | RegExp)[];
  /** The state's action, unchanged by the art. */
  action?: string;
  /** What the person does before the state shows (a search that matches nothing). */
  reach?: () => Promise<void>;
  /** The startup gate draws its own providers. */
  bare?: boolean;
};

const STATES: State[] = [
  // tidur: nothing scheduled.
  {
    name: "Beranda with no delivery today and nothing next",
    pose: "tidur",
    runtime: () => runtimeWith({ customer: jest.fn(async () => nothingNext()) }),
    ui: <Beranda />,
    copy: [/tidak ada pengantaran\.$/],
  },
  {
    name: "Jadwal month with no meals",
    pose: "tidur",
    runtime: () => runtimeWith({ customer: jest.fn(async () => ({ ...customerState(null), deliveries: [] })) }),
    ui: <Jadwal />,
    copy: ["Tidak ada pengantaran di minggu ini"],
  },
  {
    name: "Notifikasi with no updates",
    pose: "tidur",
    runtime: () => runtimeWith(),
    ui: <NotificationsScreen />,
    copy: ["Belum ada kabar baru.", "Kabar soal makananmu dan permintaan bantuan muncul di sini."],
  },
  // mencari: nothing found.
  {
    name: "Jelajah with nothing on offer",
    pose: "mencari",
    runtime: () => runtimeWith(),
    ui: <Jelajah />,
    copy: ["Belum ada paket."],
  },
  {
    name: "Jelajah with no results for a search",
    pose: "mencari",
    runtime: () => runtimeWith({ catalog: jest.fn(async () => ({ items: [offer()], nextCursor: null })) }),
    ui: <Jelajah />,
    reach: async () => {
      fireEvent.changeText(await screen.findByLabelText("Cari paket"), "rendang");
    },
    copy: ["Belum ada paket yang cocok.", "Coba kata kunci atau pilihan lain."],
    action: "Hapus pilihan",
  },
  {
    name: "an empty Disimpan",
    pose: "mencari",
    runtime: () => runtimeWith(),
    ui: <SavedList />,
    copy: ["Belum ada paket tersimpan.", "Ketuk hati di paket yang kamu suka."],
    action: "Jelajah paket",
  },
  // melambai: hello.
  {
    name: "EmptyHome",
    pose: "melambai",
    runtime: () => runtimeWith({}, null),
    ui: <Beranda />,
    copy: ["Mau makan apa minggu ini?", "Pilih paket katering rumahan, diantar sesuai jadwalmu."],
    action: "Jelajah paket",
  },
  {
    name: "a signed-in Beranda with nothing running",
    pose: "melambai",
    runtime: () => runtimeWith({ customer: jest.fn(async () => ({ ...customerState(null), subscriptions: [], deliveries: [] })) }),
    ui: <Beranda />,
    copy: ["Mau makan apa minggu ini?"],
    action: "Jelajah paket",
  },
  {
    name: "sign-in",
    pose: "melambai",
    runtime: () => runtimeWith({}, null),
    ui: <LoginRoute />,
    copy: ["Pakai nomor HP yang kamu berikan ke katering. Kodenya kami kirim lewat SMS."],
    action: "Kirim kode",
  },
  {
    name: "the claim link preview",
    pose: "melambai",
    runtime: () => runtimeWith({}, null),
    ui: <ClaimRoute />,
    params: { token: "t".repeat(64) },
    copy: ["Dari Dapur Contoh", "Makan Siang Rumahan"],
    action: "Lanjut dengan 0812-•••-0001",
  },
  // bingung: could not connect or load.
  {
    name: "Belum bisa terhubung",
    pose: "bingung",
    runtime: () => runtimeWith({ me: jest.fn(async () => Promise.reject(offline())) }),
    ui: <Text>app</Text>,
    bare: true,
    copy: ["Belum bisa terhubung. Cek koneksimu."],
    action: "Coba lagi",
  },
  {
    name: "Beranda that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ customer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <Beranda />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Jelajah that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ catalog: jest.fn(async () => Promise.reject(offline())) }),
    ui: <Jelajah />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Disimpan that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ savedPackages: jest.fn(async () => Promise.reject(offline())) }),
    ui: <SavedList />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Notifikasi that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ customer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <NotificationsScreen />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "a plan that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ customer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <PlanDetailScreen />,
    params: { id: "s-1" },
    copy: ["Terlalu lama menunggu jawaban. Cek koneksi lalu coba lagi."],
    action: "Coba lagi",
  },
  {
    name: "a claim link that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ claimPreview: jest.fn(async () => Promise.reject(offline())) }, null),
    ui: <ClaimRoute />,
    params: { token: "t".repeat(64) },
    copy: ["Belum bisa memuat. Periksa koneksi lalu coba lagi."],
    action: "Coba lagi",
  },
  {
    name: "a package that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ offer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <PackageDetail />,
    params: { id: "p-rumahan" },
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "tomorrow's story that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ customer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <TomorrowStoryScreen />,
    copy: ["Belum bisa memuat"],
    action: "Coba lagi",
  },
  {
    name: "a day that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ customer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <DayScreen />,
    params: { id: "d-next-1" },
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Pilih menu that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ customer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <ChooseMenu />,
    params: { id: "d-next-1" },
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Riwayat pembayaran that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ customer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <Payments />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Alamat that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ customer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <Addresses />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Laporan that could not load",
    pose: "bingung",
    runtime: () =>
      runtimeWith({
        customer: jest.fn(async () => Promise.reject(offline())),
        request: jest.fn(async () => Promise.reject(offline())),
      }),
    ui: <ReportList />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Beli that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ offer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <BuyScreen packageId="p-rumahan" />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Bayar that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ checkout: jest.fn(async () => Promise.reject(offline())) }),
    ui: <PaymentScreen checkoutId="ck-1" />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Paket aktif that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ customer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <PaketSaya />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "a Jadwal month that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ customer: jest.fn(async () => Promise.reject(offline())) }),
    ui: <Jadwal />,
    copy: [],
    action: "Coba lagi",
  },
];

/** The table rows added in fix round 1, by name. */
const state = (name: string) => STATES.find((s) => s.name === name)!;

/** Opens `state` and waits until its art is drawn. */
async function open(state: State) {
  mockParams = state.params ?? {};
  const runtime = state.runtime();
  render(state.bare ? <AppProviders runtime={runtime}>{state.ui}</AppProviders> : wrap(runtime, state.ui));
  await state.reach?.();
  return screen.findByTestId(`mascot-${state.pose}`, hidden, { timeout: 4000 });
}

/** The art's drawn height: `MascotArt` makes the pose's visible height equal to its size. */
const artHeight = (art: ReturnType<typeof screen.getByTestId>) =>
  StyleSheet.flatten(within(art).getByTestId("mascot-art", hidden).props.style).height as number;

const otherPoses = (pose: MascotPose) => POSES.filter((p) => p !== pose);

beforeEach(() => {
  mockParams = {};
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
  jest.clearAllMocks();
  (require("expo-secure-store") as { __store: Map<string, string> }).__store.clear();
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
});
afterEach(() => jest.restoreAllMocks());

describe("each empty and error state shows its pose and keeps its copy and action", () => {
  describe.each(["light", "dark"] as const)("%s theme", (scheme) => {
    it.each(STATES.map((s) => [s.name, s] as const))("%s", async (_name, state) => {
      jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
      const art = await open(state);
      // 120pt, centred, and the only mascot on the page.
      expect(artHeight(art)).toBe(120);
      expect(StyleSheet.flatten(art.props.style).alignSelf).toBe("center");
      for (const pose of otherPoses(state.pose)) expect(screen.queryByTestId(`mascot-${pose}`, hidden)).toBeNull();
      for (const copy of state.copy) expect(screen.getByText(copy)).toBeTruthy();
      if (state.action) expect(screen.getAllByRole("button", { name: state.action }).length).toBeGreaterThan(0);
    });
  });

  it("draws the art at 96 on a 360dp phone at font scale 1.3, so the title and action stay above the fold", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    for (const state of [STATES[0], STATES[5], STATES[8], STATES[10]]) {
      const art = await open(state);
      expect(artHeight(art)).toBe(96);
      screen.unmount();
    }
    // Enlarged text on a wider phone, or a 360dp phone at the default size, keeps 120.
    mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1.3 };
    expect(artHeight(await open(STATES[5]))).toBe(120);
    screen.unmount();
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1 };
    expect(artHeight(await open(STATES[5]))).toBe(120);
  });

  it("shows the same still under reduced motion: the art never moves", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const art = await open(STATES[2]);
    expect(within(art).getByTestId("mascot-art-image", hidden)).toBeTruthy();
    expect(artHeight(art)).toBe(120);
  });

  it("puts Jadwal's failed month art inside the month frame, which keeps the month's week rows", async () => {
    const art = await open(state("a Jadwal month that could not load"));
    const frame = screen.getByTestId("month-frame", hidden);
    expect(within(frame).getByTestId("mascot-bingung", hidden)).toBe(art);
    // The rows are the weeks the month needs (the frame grows only below them, to hold the message).
    expect(within(frame).getAllByTestId("month-week", hidden)).toHaveLength(monthWeeks(monthOf(jakartaDay(new Date()))).length);
    expect(within(frame).getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  it("keeps Akun's embedded plan list the compact line when its read fails: the page around it still stands", async () => {
    const reload = jest.fn(async () => undefined);
    render(wrap(runtimeWith(), <PlanList customer={{ data: null, loading: false, error: "Belum bisa memuat.", reload }} />));
    expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
    for (const pose of POSES) expect(screen.queryByTestId(`mascot-${pose}`, hidden)).toBeNull();
  });
});

it("mascot art is hidden from screen readers", async () => {
  for (const state of [STATES[0], STATES[3], STATES[6], STATES[11]]) {
    const art = await open(state);
    // Present for the eye, absent for TalkBack and VoiceOver: the state's own text carries the meaning.
    expect(screen.queryByTestId(`mascot-${state.pose}`)).toBeNull();
    expect(art.props.accessible).toBe(false);
    expect(art.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(art.props.accessibilityElementsHidden).toBe(true);
    screen.unmount();
  }
});

describe("no mascot art next to a food photo", () => {
  const noArt = () => {
    for (const pose of POSES) expect(screen.queryByTestId(`mascot-${pose}`, hidden)).toBeNull();
  };

  it("Beranda with today's plate leads with the hero photo, never the mascot", async () => {
    const runtime = runtimeWith({ customer: jest.fn(async () => customerState({ status: "scheduled" })) });
    render(wrap(runtime, <Beranda />));
    expect(await screen.findByTestId("plate-hero", hidden, { timeout: 4000 })).toBeTruthy();
    noArt();
  });

  it("the plan detail's hero photo stands alone", async () => {
    mockParams = { id: "s-1" };
    const runtime = runtimeWith({ customer: jest.fn(async () => customerState({ status: "scheduled" })) });
    render(wrap(runtime, <PlanDetailScreen />));
    await waitFor(() => expect(screen.getByTestId("plan-hero", hidden)).toBeTruthy(), { timeout: 4000 });
    noArt();
  });

  it("an empty Beranda that opens on the Paket selesai photo leaves the mascot out", async () => {
    const ended = subscription({ status: "completed", starts_on: addDays(TODAY, -12), ends_on: addDays(TODAY, -1), remaining: 0 });
    const runtime = runtimeWith({
      customer: jest.fn(async () => ({ ...customerState(null), subscriptions: [ended], deliveries: [] })),
    });
    render(wrap(runtime, <Beranda />));
    await screen.findByText("Mau makan apa minggu ini?", {}, { timeout: 4000 });
    expect(await screen.findByTestId("recap-photo", hidden)).toBeTruthy();
    noArt();
  });

  /** A plan still running with nothing today or next, and a plan that ended yesterday and was not renewed. */
  const quietWithRecap = (): CustomerState => {
    const quiet = nothingNext();
    const ended = subscription({
      id: "s-old",
      status: "completed",
      starts_on: addDays(TODAY, -12),
      ends_on: addDays(TODAY, -1),
      remaining: 0,
    });
    return { ...quiet, subscriptions: [...quiet.subscriptions, ended] };
  };

  it("a Beranda with nothing today or next leaves the resting mascot out while the Paket selesai photo shows", async () => {
    render(wrap(runtimeWith({ customer: jest.fn(async () => quietWithRecap()) }), <Beranda />));
    expect(await screen.findByTestId("recap-photo", hidden, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText(/tidak ada pengantaran\.$/)).toBeTruthy();
    noArt();
    expect(screen.queryByTestId("mascot-tidur-slot", hidden)).toBeNull();
  });

  it("draws the resting mascot on that Beranda once the recap was already seen", async () => {
    const runtime = runtimeWith({ customer: jest.fn(async () => quietWithRecap()) });
    secureStoreMap().set(runtime.storageKey("recap.s-old"), "1");
    render(wrap(runtime, <Beranda />));
    expect(await screen.findByTestId("mascot-tidur", hidden, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByTestId("recap-photo", hidden)).toBeNull();
  });
});

/** The synthetic SecureStore behind the mock. */
const secureStoreMap = () => (require("expo-secure-store") as { __store: Map<string, string> }).__store;

describe("EmptyHome while the recap's seen marks are read", () => {
  it("holds the waving mascot's place at its size, then draws it there with a fade once the recap turns out seen", async () => {
    const ended = subscription({ status: "completed", starts_on: addDays(TODAY, -12), ends_on: addDays(TODAY, -1), remaining: 0 });
    const runtime = runtimeWith({
      customer: jest.fn(async () => ({ ...customerState(null), subscriptions: [ended], deliveries: [] })),
    });
    const store = require("expo-secure-store") as { getItemAsync: jest.Mock };
    const original = store.getItemAsync.getMockImplementation()!;
    let release: (mark: string | null) => void = () => undefined;
    const marks = new Promise<string | null>((resolve) => (release = resolve));
    store.getItemAsync.mockImplementation((key: string) => (key.includes("recap.") ? marks : original(key)));
    const timing = jest.spyOn(Reanimated, "withTiming");
    try {
      render(wrap(runtime, <Beranda />));
      await screen.findByText("Mau makan apa minggu ini?", {}, { timeout: 4000 });
      // Not known yet: the art's box is held where the art will stand, the mascot invisible in it.
      const slot = screen.getByTestId("mascot-melambai-slot", hidden);
      const fade = within(slot).getByTestId("mascot-art-fade", hidden);
      expect(StyleSheet.flatten(fade.props.style).height).toBe(120);
      expect(StyleSheet.flatten(fade.props.style).opacity).toBe(0);
      expect(screen.queryByTestId("mascot-melambai", hidden)).toBeNull();
      timing.mockClear();
      await act(async () => release("1"));
      // The same box, never remounted: only the mascot's opacity goes to 1, over the content token.
      const art = await screen.findByTestId("mascot-melambai", hidden);
      expect(art).toBe(slot);
      expect(within(art).getByTestId("mascot-art-fade", hidden)).toBe(fade);
      expect(artHeight(art)).toBe(120);
      expect(timing.mock.calls.filter(([to, config]) => to === 1 && (config as { duration?: number })?.duration === nativeMotion.content)).toHaveLength(1);
      for (const el of [art, fade]) {
        expect(el.props.entering).toBeUndefined();
        expect(el.props.exiting).toBeUndefined();
      }
      expect(screen.queryByTestId("mascot-melambai-slot", hidden)).toBeNull();
    } finally {
      store.getItemAsync.mockImplementation(original);
    }
  });

  it("draws it at once under reduced motion", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const ended = subscription({ status: "completed", starts_on: addDays(TODAY, -12), ends_on: addDays(TODAY, -1), remaining: 0 });
    const runtime = runtimeWith({
      customer: jest.fn(async () => ({ ...customerState(null), subscriptions: [ended], deliveries: [] })),
    });
    const store = require("expo-secure-store") as { getItemAsync: jest.Mock };
    const original = store.getItemAsync.getMockImplementation()!;
    let release: (mark: string | null) => void = () => undefined;
    const marks = new Promise<string | null>((resolve) => (release = resolve));
    store.getItemAsync.mockImplementation((key: string) => (key.includes("recap.") ? marks : original(key)));
    const timing = jest.spyOn(Reanimated, "withTiming");
    try {
      render(wrap(runtime, <Beranda />));
      await screen.findByTestId("mascot-melambai-slot", hidden, { timeout: 4000 });
      timing.mockClear();
      await act(async () => release("1"));
      const art = await screen.findByTestId("mascot-melambai", hidden);
      expect(StyleSheet.flatten(within(art).getByTestId("mascot-art-fade", hidden).props.style).opacity).toBe(1);
      expect(timing.mock.calls.filter(([, config]) => (config as { duration?: number })?.duration === nativeMotion.content)).toHaveLength(0);
    } finally {
      store.getItemAsync.mockImplementation(original);
    }
  });
});

describe("art leaves with its section", () => {
  it("an empty Beranda that turns into one with a plan leaves no waving mascot behind", async () => {
    // The copy kept on this phone had nothing running; the fresh read, answered later, has today's plate.
    const kept = jest.requireMock("../src/today/offline") as { loadCachedCustomer: jest.Mock };
    kept.loadCachedCustomer.mockResolvedValueOnce({
      savedAt: "2026-10-08T00:00:00Z",
      data: { ...customerState(null), subscriptions: [], deliveries: [] },
    });
    let answer: (state: CustomerState) => void = () => undefined;
    const fresh = new Promise<CustomerState>((resolve) => (answer = resolve));
    render(wrap(runtimeWith({ customer: jest.fn(() => fresh) }), <Beranda />));
    const art = await screen.findByTestId("mascot-melambai", hidden, { timeout: 4000 });
    for (const el of [art, within(art).getByTestId("mascot-art-fade", hidden)]) {
      expect(el.props.exiting).toBeUndefined();
      expect(el.props.entering).toBeUndefined();
    }
    await act(async () => answer(customerState({ status: "scheduled" })));
    expect(await screen.findByTestId("plate-hero", hidden, { timeout: 4000 })).toBeTruthy();
    for (const pose of POSES) {
      expect(screen.queryByTestId(`mascot-${pose}`, hidden)).toBeNull();
      expect(screen.queryByTestId(`mascot-${pose}-slot`, hidden)).toBeNull();
    }
  });
});
