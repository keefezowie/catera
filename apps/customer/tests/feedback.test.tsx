import { StrictMode } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import * as Reanimated from "react-native-reanimated";
import { addDays, type Checkout, type CustomerState, type Quote, type Subscription } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeMotion, nativeThemes } from "@catera/design-tokens";
import {
  Confetti,
  MoodProvider,
  Sparkle,
  SuccessBeat,
  SuccessRig,
  ThemeProvider,
  ToastProvider,
  useListMotion,
} from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { PaymentScreen } from "../src/buy/PaymentScreen";
import { Jelajah } from "../src/discover/Jelajah";
import { SavedList } from "../src/discover/SavedList";
import { Addresses } from "../src/account/Addresses";
import { WaitingList } from "../src/today/WaitingList";
import { offer, subscription } from "./fixtures";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]),
}));
const mockNavigation = { setOptions: jest.fn(), addListener: jest.fn(() => () => undefined) };
jest.mock("expo-router/react-navigation", () => ({
  ...jest.requireActual("expo-router/react-navigation"),
  useNavigation: () => mockNavigation,
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
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), goToTab: jest.fn(), leaveFor: jest.fn() }));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));

// React Native's jest environment reports a font scale of 2; each test states the one it means.
let mockFontScale = 1;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 800, scale: 3, fontScale: mockFontScale }),
}));

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const kantor = { id: "a-1", label: "Kantor", line: "Jl. Contoh No. 1", area: "Tebet", city: "Jakarta Selatan", instructions: "", version: 1 };
const rumah = { id: "a-2", label: "Rumah", line: "Jl. Jauh No. 9", area: "Bekasi", city: "Bekasi", instructions: "", version: 1 };
const paket = offer({ id: "p-rumahan", name: "Makan Siang Rumahan", days: 20, price: 28000 });
const DATES = ["2026-10-19", "2026-10-20", "2026-10-21"];
const QR = "00020101021226590013ID.CO.QRIS.WWW0118936009153000000000215SYNTHETIC5204581253033605802ID";
const in15 = () => new Date(Date.now() + 15 * 60 * 1000).toISOString();

const quote = (extra: Partial<Quote> = {}): Quote =>
  ({
    packageId: "p-rumahan",
    portions: 1,
    startDate: DATES[0],
    cycles: 1,
    trial: false,
    renewedFrom: null,
    address: kantor,
    dates: DATES,
    subtotal: 84000,
    discount: 0,
    discountPercent: 0,
    durationDiscount: 0,
    durationDiscountPercent: 0,
    promotion: 0,
    serviceFee: 2500,
    total: 86500,
    perDay: 0,
    sellerFee: 0,
    source: "marketplace",
    offer: paket,
    ...extra,
  }) as Quote;

function pending(extra: Partial<Quote> = {}): Checkout {
  return {
    id: "ck-1",
    state: "pending",
    expires_at: in15(),
    subscription_id: null,
    payment_url: null,
    quote: quote(extra),
    payment: {
      mode: "direct",
      availableMethods: ["QRIS"],
      selectedMethod: "QRIS",
      status: "awaiting_payment",
      expiresAt: in15(),
      instructions: { kind: "qris", qrContent: QR },
    } as Checkout["payment"],
  };
}
const paid = (c: Checkout): Checkout => ({
  ...c,
  state: "paid",
  subscription_id: "s-2",
  payment: c.payment ? { ...c.payment, status: "paid" } : c.payment,
});

type Purchase = Subscription & { checkout_id?: string | null };

/** A checkout server: "Saya sudah bayar, cek status" turns the checkout paid, as the provider refresh does. */
function payServer({ checkout, subscriptions = [] as Purchase[] }: { checkout: Checkout; subscriptions?: Purchase[] }) {
  let stored = checkout;
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  runtime.api = {
    ...runtime.api,
    usage: jest.fn(async () => undefined),
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    customer: jest.fn(async () => ({ subscriptions, deliveries: [], addresses: [kantor], notifications: [], cases: [] })),
    checkout: jest.fn(async () => structuredClone(stored)),
    command: jest.fn(async (action: string) => {
      if (action === "checkout.payment.refresh") stored = paid(stored);
      return stored;
    }),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const wrap = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MoodProvider now={() => new Date("2026-10-09T03:00:00Z")}>
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <ToastProvider os="android">{ui}</ToastProvider>
      </MobileProvider>
    </MoodProvider>,
  );

const successes = () => (Haptics.notificationAsync as jest.Mock).mock.calls.filter(([kind]) => kind === "success");
const rig = () => screen.UNSAFE_getByType(SuccessRig);
const confetti = () => screen.UNSAFE_queryByType(Confetti);
const flat = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
const reduced = (on: boolean) => (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(on);

async function payWhileOpen(runtime: MobileRuntime) {
  wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
  expect(await screen.findByLabelText("Kode QRIS pembayaran ini")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Saya sudah bayar, cek status" }));
  expect(await screen.findByTestId("paid-hero")).toBeTruthy();
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFontScale = 1;
  reduced(false);
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("Pembayaran diterima: the success beat", () => {
  it("turning paid while open plays the beat with one success haptic", async () => {
    await payWhileOpen(payServer({ checkout: pending() }));
    expect(screen.getByTestId("success-beat")).toBeTruthy();
    expect(rig().props.play).toBe(true);
    expect(successes()).toHaveLength(1);
    // The facts are the beat's children: the hero and the reserved days, and the beat names the moment.
    const beat = within(screen.getByTestId("success-beat"));
    expect(beat.getByText("Pembayaran diterima")).toBeTruthy();
    expect(beat.getByTestId("paid-hero")).toBeTruthy();
    // Re-renders (the footer, a reload) never play it again.
    await act(async () => {});
    expect(successes()).toHaveLength(1);
  });

  it("the header stays Bayar, the beat is the one heading that names the payment, and its arrival is announced once", async () => {
    const announce = jest.spyOn(ReactNative.AccessibilityInfo, "announceForAccessibility");
    await payWhileOpen(payServer({ checkout: pending() }));
    expect(within(screen.getByTestId("screen-native-title")).getByText("Bayar")).toBeTruthy();
    const headings = screen.getAllByText("Pembayaran diterima");
    expect(headings).toHaveLength(1);
    expect(headings[0].props.accessibilityRole).toBe("header");
    expect(announce.mock.calls.filter(([said]) => said === "Pembayaran diterima")).toHaveLength(1);
    await act(async () => {});
    expect(announce.mock.calls.filter(([said]) => said === "Pembayaran diterima")).toHaveLength(1);
    announce.mockRestore();
  });

  it("Bayar reads the customer's plans once, not again on each status check", async () => {
    const runtime = payServer({ checkout: pending() });
    await payWhileOpen(runtime);
    // The cek status command bumped the revision; the plans read only decides the confetti at the paid moment.
    expect(runtime.api.command).toHaveBeenCalledWith("checkout.payment.refresh", { id: "ck-1" }, expect.any(String));
    expect(runtime.api.customer).toHaveBeenCalledTimes(1);
  });

  it("opened already paid shows the resting frame with no haptic", async () => {
    const announce = jest.spyOn(ReactNative.AccessibilityInfo, "announceForAccessibility");
    wrap(payServer({ checkout: paid(pending()) }), <PaymentScreen checkoutId="ck-1" />);
    await screen.findByTestId("paid-hero");
    await act(async () => {});
    expect(rig().props.play).toBe(false);
    expect(successes()).toHaveLength(0);
    // Nothing arrived: the resting frame announces nothing. The heading is there in reading order.
    expect(announce).not.toHaveBeenCalled();
    announce.mockRestore();
    expect(confetti()?.props.play).toBe(false);
    expect(screen.queryByTestId("confetti", { includeHiddenElements: true })).toBeNull();
    // At rest the facts are already there, at full opacity.
    expect(flat(screen.getByTestId("success-beat-facts")).opacity).toBe(1);
  });

  it("reduced motion shows merayakan and still fires the haptic", async () => {
    reduced(true);
    const announce = jest.spyOn(ReactNative.AccessibilityInfo, "announceForAccessibility");
    await payWhileOpen(payServer({ checkout: pending() }));
    expect(announce.mock.calls.filter(([said]) => said === "Pembayaran diterima")).toHaveLength(1);
    announce.mockRestore();
    const beat = within(screen.getByTestId("success-beat"));
    expect(beat.getByTestId("mascot-art", { includeHiddenElements: true })).toBeTruthy();
    expect(beat.queryByTestId("success-rig", { includeHiddenElements: true })).toBeNull();
    expect(beat.queryByTestId("success-ring", { includeHiddenElements: true })).toBeNull();
    expect(beat.queryAllByTestId("sparkle", { includeHiddenElements: true })).toHaveLength(0);
    expect(screen.queryByTestId("confetti", { includeHiddenElements: true })).toBeNull();
    expect(flat(screen.getByTestId("success-beat-facts")).opacity).toBe(1);
    expect(successes()).toHaveLength(1);
  });

  it("confetti only on the first paid plan", async () => {
    // A plan the caterer recorded outside Catera has no checkout: it is not an earlier paid plan.
    const imported: Purchase = { ...subscription({ id: "s-import" }), checkout_id: null };
    const view = wrap(payServer({ checkout: pending(), subscriptions: [imported] }), <PaymentScreen checkoutId="ck-1" />);
    await screen.findByLabelText("Kode QRIS pembayaran ini");
    await act(async () => {});
    fireEvent.press(screen.getByRole("button", { name: "Saya sudah bayar, cek status" }));
    await screen.findByTestId("paid-hero");
    await act(async () => {});
    expect(confetti()?.props.play).toBe(true);
    // It plays once and never takes a touch: the vector does not loop, and its wrapper lets presses through.
    const lottie = screen.getByTestId("confetti", { includeHiddenElements: true });
    expect(lottie.props.loop).toBe(false);
    expect(lottie.props.autoPlay).toBe(true);
    let holder = lottie.parent;
    while (holder && holder.props.pointerEvents === undefined) holder = holder.parent;
    expect(holder?.props.pointerEvents).toBe("none");
    view.unmount();

    // A later purchase: an earlier plan was paid through Catera.
    const earlier: Purchase = { ...subscription({ id: "s-1" }), checkout_id: "ck-0" };
    wrap(payServer({ checkout: pending(), subscriptions: [earlier] }), <PaymentScreen checkoutId="ck-1" />);
    await screen.findByLabelText("Kode QRIS pembayaran ini");
    await act(async () => {});
    fireEvent.press(screen.getByRole("button", { name: "Saya sudah bayar, cek status" }));
    await screen.findByTestId("paid-hero");
    await act(async () => {});
    expect(rig().props.play).toBe(true);
    expect(confetti()?.props.play ?? false).toBe(false);
    expect(screen.queryByTestId("confetti", { includeHiddenElements: true })).toBeNull();
  });

  it("a read that cannot tell gives no confetti", async () => {
    const runtime = payServer({ checkout: pending() });
    (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    await payWhileOpen(runtime);
    expect(rig().props.play).toBe(true);
    expect(screen.queryByTestId("confetti", { includeHiddenElements: true })).toBeNull();
  });

  it("a renewal paid while open plays the beat once, with no confetti after an earlier paid plan", async () => {
    const earlier: Purchase = { ...subscription({ id: "s-1", remaining: 2 }), checkout_id: "ck-0" };
    await payWhileOpen(payServer({ checkout: pending({ renewedFrom: "s-1" }), subscriptions: [earlier] }));
    expect(rig().props.play).toBe(true);
    expect(successes()).toHaveLength(1);
    expect(screen.queryByTestId("confetti", { includeHiddenElements: true })).toBeNull();
  });

  it("the beat burst uses sunrise ink, sunrise and forest from the theme, and its title is the outcome type, free to wrap", async () => {
    render(
      <SuccessBeat title="Pembayaran diterima untuk paket yang panjang" play>
        <ReactNative.Text>Fakta</ReactNative.Text>
      </SuccessBeat>,
    );
    const sparkles = screen.getAllByTestId("sparkle", { includeHiddenElements: true });
    expect(sparkles).toHaveLength(5);
    const fills = screen.UNSAFE_getAllByType(Sparkle).map((s) => s.props.color as string);
    expect(new Set(fills)).toEqual(new Set([nativeThemes.light.sunriseInk, nativeThemes.light.sunrise, nativeThemes.light.forest]));
    const title = screen.getByText("Pembayaran diterima untuk paket yang panjang");
    expect(title.props.numberOfLines).toBeUndefined();
    expect(flat(title).textAlign).toBe("center");
    expect(title.props.accessibilityRole).toBe("header");
    // 26/32 is a named type step, not a size set inline on this one title.
    expect(screen.UNSAFE_getByProps({ variant: "outcome" }).props.children).toBe("Pembayaran diterima untuk paket yang panjang");
    expect(flat(title)).toMatchObject({ fontSize: 26, lineHeight: 32 });
  });

  it("the disc and the burst share the Catera ease", () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    render(
      <SuccessBeat title="Pembayaran diterima" play>
        <ReactNative.Text>Fakta</ReactNative.Text>
      </SuccessBeat>,
    );
    const easingOf = (duration: number) =>
      (timing.mock.calls.find(([, config]) => (config as { duration?: number })?.duration === duration)?.[1] as { easing?: unknown })?.easing;
    // The disc grows over 420ms on the Catera ease; the sparkles burst over 600ms on the same curve.
    expect(easingOf(420)).toBeDefined();
    expect(easingOf(600)).toBe(easingOf(420));
    timing.mockRestore();
  });

  it("in the dark theme the beat title and burst read the dark palette", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    try {
      render(
        <ThemeProvider storageKey="catera.theme">
          <SuccessBeat title="Pembayaran diterima" play={false}>
            <ReactNative.Text>Fakta</ReactNative.Text>
          </SuccessBeat>
        </ThemeProvider>,
      );
      await act(async () => {});
      expect(flat(screen.getByText("Pembayaran diterima")).color).toBe(nativeThemes.dark.charcoal);
      const fills = screen.UNSAFE_getAllByType(Sparkle).map((s) => s.props.color as string);
      expect(fills).toContain(nativeThemes.dark.sunriseInk);
    } finally {
      scheme.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The heart and its toasts.

const cheap = offer({ id: "p-murah", name: "Nasi Ayam Bakar", price: 25000 });
const pricey = offer({ id: "p-mahal", name: "Menu Sehat Premium", caterer: "Dapur Sehat", price: 45000 });

function savedRuntime(initial: string[] = []) {
  const ids = new Set(initial);
  const all = [cheap, pricey];
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    catalog: jest.fn(async () => ({ items: all, nextCursor: null })),
    request: jest.fn(async () => []),
    savedPackages: jest.fn(async () => ({
      packageIds: [...ids],
      items: [...ids].map((id) => ({ packageId: id, savedAt: "2026-10-01T00:00:00Z", summary: {}, offer: all.find((o) => o.id === id) ?? null })),
      nextCursor: null,
    })),
    command: jest.fn(async (_action: string, payload: { packageId: string; saved: boolean }) => {
      if (payload.saved) ids.add(payload.packageId);
      else ids.delete(payload.packageId);
      return payload;
    }),
  } as unknown as MobileRuntime["api"];
  return runtime;
}
const setCalls = (runtime: MobileRuntime) =>
  (runtime.api.command as jest.Mock).mock.calls.filter(([action]) => action === "savedPackage.set").map(([, p]) => p);

describe("the heart", () => {
  it("saving a package pops the heart, haptics and toasts Disimpan with Lihat", async () => {
    const sequence = jest.spyOn(Reanimated, "withSequence");
    const timing = jest.spyOn(Reanimated, "withTiming");
    const runtime = savedRuntime();
    wrap(runtime, <Jelajah />);
    const heart = await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" });
    expect(flat(heart)).toMatchObject({ width: 44, height: 44 });
    fireEvent.press(heart);
    // The pop: scale up to 1.22, then a spring back to 1; the five dots burst within 680ms.
    expect(sequence).toHaveBeenCalledWith(1.22, 1);
    expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 680 }));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("heart-dot", { includeHiddenElements: true })).toHaveLength(5);
    // The dots ride the same Catera ease as the pop.
    const easingOf = (duration: number) =>
      (timing.mock.calls.find(([, config]) => (config as { duration?: number })?.duration === duration)?.[1] as { easing?: unknown })?.easing;
    expect(easingOf(200)).toBeDefined();
    expect(easingOf(680)).toBe(easingOf(200));
    // They burst out well past the 32dp disc (radius 16) the tile heart draws, not inside its rim; the control itself is 44dp.
    for (const dot of screen.getAllByTestId("heart-dot", { includeHiddenElements: true })) {
      const [{ translateX }, { translateY }] = flat(dot).transform as [{ translateX: number }, { translateY: number }];
      const reach = Math.hypot(translateX, translateY);
      expect(reach).toBeGreaterThanOrEqual(30);
      expect(reach).toBeLessThanOrEqual(32);
    }
    // The filled heart is forest (a saved heart is a selection).
    const filled = await screen.findByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" });
    expect(within(filled).UNSAFE_getByType(Ionicons).props.color).toBe(nativeThemes.light.forest);
    expect(await screen.findByText("Disimpan")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Lihat" }));
    expect(router.push).toHaveBeenCalledWith("/disimpan");
    sequence.mockRestore();
    timing.mockRestore();
  });

  it("unsaving toasts with Urungkan and undo saves again", async () => {
    const sequence = jest.spyOn(Reanimated, "withSequence");
    const runtime = savedRuntime(["p-murah"]);
    wrap(runtime, <Jelajah />);
    fireEvent.press(await screen.findByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" }));
    // The outline comes back at once, with no pop and no haptic.
    expect(screen.getByRole("button", { name: "Simpan Nasi Ayam Bakar" })).toBeTruthy();
    expect(sequence).not.toHaveBeenCalledWith(1.22, 1);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(await screen.findByText("Dihapus dari simpanan")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Urungkan" }));
    await waitFor(() => expect(setCalls(runtime)).toEqual([
      { packageId: "p-murah", saved: false },
      { packageId: "p-murah", saved: true },
    ]));
    expect(await screen.findByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" })).toBeTruthy();
    // Undo is not a new save: no second toast asks to look.
    expect(screen.queryByText("Disimpan")).toBeNull();
    sequence.mockRestore();
  });

  it("a save the server refuses puts the heart back and says so in an error toast as well as inline", async () => {
    const runtime = savedRuntime();
    (runtime.api.command as jest.Mock).mockImplementation(async () => {
      throw Object.assign(new Error("NETWORK"), { code: "NETWORK" });
    });
    wrap(runtime, <Jelajah />);
    fireEvent.press(await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" }));
    expect(await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" })).toBeTruthy();
    const toast = within(await screen.findByTestId("toast"));
    expect(toast.getByText("Belum tersimpan. Coba lagi.")).toBeTruthy();
    expect(toast.getByTestId("toast-error", { includeHiddenElements: true })).toBeTruthy();
    // The existing inline text stays where it was.
    expect(screen.getAllByText("Belum tersimpan. Coba lagi.")).toHaveLength(2);
  });

  it("under reduced motion the heart swaps without the pop and still gives the selection haptic", async () => {
    reduced(true);
    const sequence = jest.spyOn(Reanimated, "withSequence");
    wrap(savedRuntime(), <Jelajah />);
    fireEvent.press(await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" }));
    expect(sequence).not.toHaveBeenCalledWith(1.22, 1);
    expect(screen.queryAllByTestId("heart-dot", { includeHiddenElements: true })).toHaveLength(0);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" })).toBeTruthy();
    sequence.mockRestore();
  });

  it("in the dark theme the filled heart is the dark forest", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    try {
      render(
        <ThemeProvider storageKey="catera.theme">
          <MoodProvider now={() => new Date("2026-10-09T03:00:00Z")}>
            <MobileProvider runtime={savedRuntime(["p-murah"])} linkMapper={customerLink}>
              <Jelajah />
            </MobileProvider>
          </MoodProvider>
        </ThemeProvider>,
      );
      const filled = await screen.findByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" });
      expect(within(filled).UNSAFE_getByType(Ionicons).props.color).toBe(
        nativeThemes.dark.forest,
      );
    } finally {
      scheme.mockRestore();
    }
  });
});

describe("row motion", () => {
  it("removed rows use the row motion and no first load staggers", async () => {
    const runtime = savedRuntime(["p-murah", "p-mahal"]);
    wrap(runtime, <SavedList />);
    await screen.findByText("Nasi Ayam Bakar");
    await act(async () => {});
    const rows = () => screen.getAllByTestId("saved-row");
    // The first load enters as one block: no row has its own entrance, but each can leave and the rest can move.
    expect(rows()).toHaveLength(2);
    for (const row of rows()) {
      expect(row.props.entering).toBeUndefined();
      expect(row.props.exiting).toBeDefined();
      expect(row.props.layout).toBeDefined();
    }
    fireEvent.press(screen.getByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" }));
    await waitFor(() => expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull());
    expect(rows()).toHaveLength(1);
    expect(await screen.findByText("Dihapus dari simpanan")).toBeTruthy();
    // Urungkan brings it back as a row the customer's own action inserted.
    fireEvent.press(screen.getByRole("button", { name: "Urungkan" }));
    expect(await screen.findByText("Nasi Ayam Bakar")).toBeTruthy();
    const back = rows().find((r) => within(r).queryByText("Nasi Ayam Bakar"))!;
    expect(back.props.entering).toBeDefined();
    const stayed = rows().find((r) => within(r).queryByText("Menu Sehat Premium"))!;
    expect(stayed.props.entering).toBeUndefined();
  });

  it("a page from Lihat lebih banyak joins the one grid and fades in tile by tile, not as rows the customer inserted", async () => {
    const item = (o: typeof cheap) => ({ packageId: o.id, savedAt: "2026-10-01T00:00:00Z", summary: {}, offer: o });
    const runtime = savedRuntime(["p-murah", "p-mahal"]);
    (runtime.api.savedPackages as jest.Mock).mockImplementation(async (cursor?: string) =>
      cursor
        ? { packageIds: ["p-murah", "p-mahal"], items: [item(pricey)], nextCursor: null }
        : { packageIds: ["p-murah", "p-mahal"], items: [item(cheap)], nextCursor: "c-2" },
    );
    wrap(runtime, <SavedList />);
    await screen.findByText("Nasi Ayam Bakar");
    await act(async () => {});
    fireEvent.press(screen.getByRole("button", { name: "Lihat lebih banyak" }));
    expect(await screen.findByText("Menu Sehat Premium")).toBeTruthy();
    // One grid holds every page, so an odd page never leaves a hole mid-list; the new page's tiles fade in as the page
    // lands, and the first page's tiles keep no entrance (the list's first load is one block).
    expect(screen.getAllByTestId("package-grid")).toHaveLength(1);
    const rows = screen.getAllByTestId("saved-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].props.entering).toBeUndefined();
    expect(rows[1].props.entering).toBeDefined();
    expect(within(rows[1]).getByText("Menu Sehat Premium")).toBeTruthy();
    // Its rows still leave as rows when the customer removes one.
    expect(rows[1].props.exiting).toBeDefined();
  });

  it("an insertion forgets its entrance once it has run, even when React renders twice before it commits", async () => {
    const { result, rerender } = renderHook(({ keys }: { keys: string[] }) => useListMotion(keys), {
      initialProps: { keys: ["a"] },
      wrapper: StrictMode,
    });
    expect(result.current("a").entering).toBeUndefined();
    rerender({ keys: ["a", "b"] });
    expect(result.current("b").entering).toBeDefined();
    expect(result.current("a").entering).toBeUndefined();
    // After `content` (220ms) the row is an ordinary row again: a later remount (a filter return) has no entrance.
    await act(async () => void (await new Promise((r) => setTimeout(r, 500))));
    rerender({ keys: ["a", "b"] });
    expect(result.current("b").entering).toBeUndefined();
  });

  it("only a row put back soon after it left takes the returning fade; a quiet read or a later insert does not", async () => {
    const motion = jest.requireMock("react-native-reanimated") as { FadeIn: unknown; FadeInDown: unknown };
    const hook = () =>
      renderHook(({ keys, quiet }: { keys: string[]; quiet?: boolean }) => useListMotion(keys, quiet), {
        initialProps: { keys: ["a", "b"] } as { keys: string[]; quiet?: boolean },
      });
    // An undo: b leaves and comes straight back, so it waits for the rows to make room and fades in.
    let h = hook();
    h.rerender({ keys: ["a"] });
    h.rerender({ keys: ["a", "b"] });
    expect(h.result.current("b").entering).toBe(motion.FadeIn);
    h.unmount();
    // A quiet read (a refresh) forgets what left, so a key the user adds afterwards is an ordinary insert.
    h = hook();
    h.rerender({ keys: ["a"] });
    h.rerender({ keys: ["a"], quiet: true });
    h.rerender({ keys: ["a", "b"] });
    expect(h.result.current("b").entering).toBe(motion.FadeInDown);
    h.unmount();
    // What left is forgotten after one content window: added again later, it rises in like any new row.
    h = hook();
    h.rerender({ keys: ["a"] });
    await act(async () => void (await new Promise((r) => setTimeout(r, nativeMotion.content + 60))));
    h.rerender({ keys: ["a", "b"] });
    expect(h.result.current("b").entering).toBe(motion.FadeInDown);
    h.unmount();
  });

  it("row motion is off under reduced motion", async () => {
    reduced(true);
    wrap(savedRuntime(["p-murah"]), <SavedList />);
    await screen.findByText("Nasi Ayam Bakar");
    const row = screen.getByTestId("saved-row");
    expect(row.props.exiting).toBeUndefined();
    expect(row.props.layout).toBeUndefined();
  });

  it("a new address enters as an inserted row; the first load does not", async () => {
    let addresses = [kantor];
    const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
    runtime.api = {
      ...runtime.api,
      me: jest.fn(async () => ({ actor: customer, demo: false })),
      customer: jest.fn(async () => ({ subscriptions: [], deliveries: [], addresses, notifications: [], cases: [] })),
      command: jest.fn(async () => ({})),
    } as unknown as MobileRuntime["api"];
    let commandRef: ((action: string, payload: Record<string, unknown>) => Promise<unknown>) | null = null;
    function Grab() {
      commandRef = require("@catera/mobile-core").useMobile().command;
      return null;
    }
    wrap(
      runtime,
      <>
        <Addresses />
        <Grab />
      </>,
    );
    await screen.findByText("Kantor");
    await act(async () => {});
    expect(screen.getByTestId("address-row").props.entering).toBeUndefined();
    expect(screen.getByTestId("address-row").props.exiting).toBeDefined();
    // Saving the form is a command: the list reads again and the new address arrives.
    addresses = [kantor, rumah];
    await act(async () => void (await commandRef!("address.save", {})));
    expect(await screen.findByText("Rumah")).toBeTruthy();
    const [first, added] = screen.getAllByTestId("address-row");
    expect(first.props.entering).toBeUndefined();
    expect(added.props.entering).toBeDefined();
  });

  it("a waiting row leaves after its action, with the rest moving up; the offline copy never animates", () => {
    const due = (id: string, name: string) =>
      subscription({ id, remaining: 2, snapshot: { offer: offer({ id: `p-${id}`, name }), total: 1 } as never });
    const a = due("s-a", "Paket Satu");
    const b = due("s-b", "Paket Dua");
    const state = (subs: Subscription[]): CustomerState =>
      ({ subscriptions: subs, deliveries: [], addresses: [], notifications: [], cases: [] }) as CustomerState;
    const now = new Date("2026-10-09T03:00:00Z");
    const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
    const ui = (s: CustomerState, offline = false) => (
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <WaitingList state={s} actions={[]} offline={offline} now={now} />
      </MobileProvider>
    );
    const view = render(ui(state([a, b])));
    const rows = () => screen.getAllByTestId("waiting-row-motion");
    expect(rows()).toHaveLength(2);
    for (const row of rows()) {
      expect(row.props.entering).toBeUndefined();
      expect(row.props.exiting).toBeDefined();
      expect(row.props.layout).toBeDefined();
    }
    // Paket Satu is renewed: its row leaves.
    const renewal = subscription({ id: "s-a2", renewed_from: "s-a", starts_on: addDays("2026-10-09", 3) });
    view.rerender(ui(state([a, b, renewal])));
    expect(rows()).toHaveLength(1);
    expect(screen.queryByText(/Paket Satu/)).toBeNull();
    view.rerender(ui(state([a, b]), true));
    for (const row of rows()) expect(row.props.exiting).toBeUndefined();
  });
});
