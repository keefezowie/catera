import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { ActivityIndicator, AppState, BackHandler, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { addDays, currency, type Checkout, type Quote, type RenewalContext } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeMood, nativeThemes } from "@catera/design-tokens";
import { fonts, MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { goToTab, leaveFor } from "../src/nav";
import { BuyScreen } from "../src/buy/BuyScreen";
import { QrisCode } from "../src/buy/QrisCode";
import { PaymentScreen } from "../src/buy/PaymentScreen";
import { offer, subscription } from "./fixtures";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: () => ({}),
  // Focused for the whole test: the effect runs on mount and whenever its callback changes.
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]),
}));
/** The screen's own stack options (Bayar turns the iOS edge swipe off once paid). */
const mockSetOptions = jest.fn();
jest.mock("expo-router/react-navigation", () => ({ useNavigation: () => ({ setOptions: mockSetOptions }) }));
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
/** Tab changes and leaving a screen above the tabs go through nav (navigation.test covers them on the real router). */
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), goToTab: jest.fn(), leaveFor: jest.fn() }));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));

/** Wednesday 7 Oct 2026, 10.00 in Jakarta: before the 17.00 cutoff for Thursday. Only Date is faked. */
const NOW = new Date("2026-10-07T03:00:00Z");
const onlyDate = () =>
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "hrtime",
      "nextTick",
      "performance",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
    ],
  });
beforeAll(onlyDate);
afterAll(() => jest.useRealTimers());

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const kantor = { id: "a-1", label: "Kantor", line: "Jl. Contoh No. 1", area: "Tebet", city: "Jakarta Selatan", instructions: "", version: 1 };
const rumah = { id: "a-2", label: "Rumah", line: "Jl. Jauh No. 9", area: "Bekasi", city: "Bekasi", instructions: "", version: 1 };
const paket = offer({
  id: "p-rumahan",
  name: "Makan Siang Rumahan",
  days: 20,
  price: 28000,
  trialPrice: 30000,
  trialMax: 2,
  durationPricing: { revision: 1, options: [{ cycles: 1, discountPercent: 0 }, { cycles: 2, discountPercent: 5 }] },
});
const current = subscription({ id: "s-1", package_id: "p-rumahan", ends_on: "2026-10-16", remaining: 3, portions: 1 });
const QR = "00020101021226590013ID.CO.QRIS.WWW0118936009153000000000215SYNTHETIC5204581253033605802ID";

type Payload = { packageId: string; addressId: string; portions: number; startDate: string; cycles: number; trial: boolean; renewedFrom?: string };

/** Synthetic server pricing: weekdays from the start, 5% off two cycles, a flat service fee. */
function quoteFor({ addressId, ...p }: Payload): Quote {
  const days = p.trial ? 1 : 20 * p.cycles;
  const dates: string[] = [];
  for (let d = p.startDate; dates.length < days; d = addDays(d, 1)) {
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (wd >= 1 && wd <= 5) dates.push(d);
  }
  const subtotal = (p.trial ? 30000 : 28000) * p.portions * days;
  const durationDiscount = p.cycles === 2 ? Math.round(subtotal * 0.05) : 0;
  return {
    ...p,
    address: addressId === rumah.id ? rumah : kantor,
    renewedFrom: p.renewedFrom ?? null,
    cycles: p.cycles,
    dates,
    subtotal,
    discount: 0,
    discountPercent: 0,
    durationDiscount,
    durationDiscountPercent: p.cycles === 2 ? 5 : 0,
    promotion: 0,
    serviceFee: 2500,
    total: subtotal - durationDiscount + 2500,
    perDay: 0,
    sellerFee: 0,
    source: "marketplace",
    offer: paket,
  };
}
const totalOf = (p: Partial<Payload> = {}) =>
  currency(quoteFor({ packageId: "p-rumahan", addressId: "a-1", portions: 1, startDate: "2026-10-19", cycles: 1, trial: false, ...p }).total, "id");

const in15 = () => new Date(Date.now() + 15 * 60 * 1000).toISOString();
function pendingCheckout(extra: Partial<Checkout> = {}, payment: Partial<NonNullable<Checkout["payment"]>> = {}): Checkout {
  return {
    id: "ck-1",
    state: "pending",
    expires_at: in15(),
    subscription_id: null,
    payment_url: null,
    quote: quoteFor({ packageId: "p-rumahan", addressId: "a-1", portions: 1, startDate: "2026-10-19", cycles: 1, trial: false }),
    payment: {
      mode: "direct",
      availableMethods: ["QRIS", "VIRTUAL_ACCOUNT_BRI"],
      selectedMethod: "QRIS",
      status: "awaiting_payment",
      expiresAt: in15(),
      instructions: { kind: "qris", qrContent: QR },
      ...payment,
    },
    ...extra,
  };
}

/** A small stateful server: commands change the checkout that later reads return. */
function server({
  actor = customer as Record<string, unknown> | null,
  demo = false,
  mode = "direct" as "direct" | "hosted",
  checkout = null as Checkout | null,
  context = {} as Partial<RenewalContext>,
  startFails = false,
  pkg = paket,
  subscriptions = [current],
} = {}) {
  let stored = checkout;
  const paid = (c: Checkout): Checkout => ({
    ...c,
    state: "paid",
    subscription_id: "s-2",
    payment: c.payment ? { ...c.payment, status: "paid" } : c.payment,
  });
  // With an app, so usage counts are sent (to the `usage` double below).
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  runtime.api = {
    ...runtime.api,
    usage: jest.fn(async () => undefined),
    me: jest.fn(async () => ({ actor, demo })),
    offer: jest.fn(async (id: string) => ({ offer: id === pkg.id ? pkg : null })),
    customer: jest.fn(async () => ({ subscriptions, deliveries: [], addresses: [kantor, rumah], notifications: [], cases: [] })),
    request: jest.fn(async (path: string) => {
      if (path === "payment-methods")
        return { mode, availableMethods: mode === "direct" ? ["QRIS", "VIRTUAL_ACCOUNT_BRI"] : [] };
      throw new Error("NOT_FOUND");
    }),
    quote: jest.fn(async (p: Payload) => quoteFor(p)),
    // No startDate: the screen falls back to renewalDefaults for the next operating day.
    renewalContext: jest.fn(async (_id: string, _pkg: string | undefined, cycles: number) => ({
      subscriptionId: "s-1",
      packageId: "p-rumahan",
      portions: 1,
      address: kantor,
      addressId: "a-1",
      replacementRequired: false,
      available: true,
      pendingCheckoutId: null,
      offers: [pkg],
      cycles,
      ...context,
    })),
    checkout: jest.fn(async () => {
      if (!stored) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
      return structuredClone(stored);
    }),
    command: jest.fn(async (action: string, payload: Record<string, unknown>) => {
      if (action === "checkout.create") {
        const created = pendingCheckout({ quote: quoteFor(payload as unknown as Payload) }, { status: "choose_method", selectedMethod: null, instructions: null });
        stored = mode === "direct" ? created : { ...created, payment: undefined };
        return stored;
      }
      if (action === "checkout.payment.start") {
        if (startFails) throw Object.assign(new Error("PAYMENT_UNAVAILABLE"), { code: "PAYMENT_UNAVAILABLE" });
        return stored;
      }
      if (action === "checkout.payment.refresh" || action === "checkout.demo_pay") {
        stored = paid(stored!);
        return stored;
      }
      return {};
    }),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const wrap = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );
const commands = (runtime: MobileRuntime) => (runtime.api.command as jest.Mock).mock.calls;
const bayarReady = () => waitFor(() => expect(screen.getByRole("button", { name: "Bayar" })).toBeEnabled());

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("Beli / Perpanjang", () => {
  it("renew mode prefills the next operating day and one cycle", async () => {
    const runtime = server();
    wrap(runtime, <BuyScreen renewFrom="s-1" />);
    expect(await screen.findByText("Perpanjang Makan Siang Rumahan")).toBeTruthy();
    expect(await screen.findByText("Senin 19 Okt, tepat setelah paket sekarang")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "20 hari" }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole("radio", { name: "40 hari · Hemat 5%" }).props.accessibilityState.checked).toBe(false);
    await waitFor(() =>
      expect(runtime.api.quote).toHaveBeenCalledWith({
        packageId: "p-rumahan",
        addressId: "a-1",
        portions: 1,
        startDate: "2026-10-19",
        cycles: 1,
        trial: false,
        renewedFrom: "s-1",
      }),
    );
    expect(runtime.api.renewalContext).toHaveBeenCalledWith("s-1", undefined, 1);
    expect(await screen.findByText("20 hari antar, Senin–Jumat, sampai Jumat 13 Nov")).toBeTruthy();
    expect(screen.getAllByText(totalOf()).length).toBeGreaterThan(0);
    // A price is read as text, never announced as a heading.
    expect(screen.getAllByText(totalOf()).filter((n) => n.props.accessibilityRole === "header")).toHaveLength(0);
    expect(screen.getByText("Termasuk")).toBeTruthy();
  });

  it("prefers the start date the renewal context returns", async () => {
    const runtime = server({ context: { startDate: "2026-10-20" } });
    wrap(runtime, <BuyScreen renewFrom="s-1" />);
    expect(await screen.findByText("Selasa 20 Okt, tepat setelah paket sekarang")).toBeTruthy();
    await waitFor(() => expect(runtime.api.quote).toHaveBeenCalledWith(expect.objectContaining({ startDate: "2026-10-20" })));
  });

  it("changing length requotes with cycles 2", async () => {
    const runtime = server();
    wrap(runtime, <BuyScreen renewFrom="s-1" />);
    await bayarReady();
    fireEvent.press(screen.getByRole("radio", { name: "40 hari · Hemat 5%" }));
    // Never pay against the old price: Bayar waits for the new quote.
    expect(screen.getByRole("button", { name: "Bayar" })).toBeDisabled();
    await waitFor(() => expect(runtime.api.quote).toHaveBeenLastCalledWith(expect.objectContaining({ cycles: 2, renewedFrom: "s-1" })));
    expect(runtime.api.renewalContext).toHaveBeenCalledWith("s-1", undefined, 2);
    expect(await screen.findByText("Hemat 5% untuk 40 hari")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(totalOf({ cycles: 2 })).length).toBeGreaterThan(0));
    await bayarReady();
  });

  it("Bayar creates the checkout with accepted terms and starts QRIS", async () => {
    const runtime = server();
    wrap(runtime, <BuyScreen packageId="p-rumahan" />);
    expect(await screen.findByText("Dengan membayar, Anda setuju dengan Ketentuan Catera.")).toBeTruthy();
    await bayarReady();
    fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/bayar/ck-1"));
    const calls = commands(runtime);
    expect(calls.map((c) => c[0])).toEqual(["checkout.create", "checkout.payment.start"]);
    const quoted = quoteFor({ packageId: "p-rumahan", addressId: "a-1", portions: 1, startDate: "2026-10-08", cycles: 1, trial: false });
    expect(calls[0][1]).toEqual({
      packageId: "p-rumahan",
      addressId: "a-1",
      portions: 1,
      startDate: "2026-10-08",
      cycles: 1,
      trial: false,
      expectedQuote: quoted,
      acceptedTerms: true,
    });
    expect(calls[1][1]).toEqual({ id: "ck-1", method: "QRIS" });
  });

  it("transfer bank starts the virtual account instead", async () => {
    const runtime = server();
    wrap(runtime, <BuyScreen packageId="p-rumahan" />);
    fireEvent.press(await screen.findByRole("button", { name: "Pakai transfer bank (VA)" }));
    await bayarReady();
    fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/bayar/ck-1"));
    expect(commands(runtime)[1][1]).toEqual({ id: "ck-1", method: "VIRTUAL_ACCOUNT_BRI" });
  });

  it("hosted payment only creates the checkout and opens Bayar", async () => {
    const runtime = server({ mode: "hosted" });
    wrap(runtime, <BuyScreen packageId="p-rumahan" />);
    await bayarReady();
    fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/bayar/ck-1"));
    expect(commands(runtime).map((c) => c[0])).toEqual(["checkout.create"]);
  });

  it("payment card makes no security claim", async () => {
    wrap(server({ mode: "hosted" }), <BuyScreen packageId="p-rumahan" />);
    await bayarReady();
    expect(screen.getByText("Pilih cara bayar di halaman berikutnya.")).toBeTruthy();
    expect(screen.queryByText(/\baman\b/i)).toBeNull();
    expect(screen.queryByText(/secure/i)).toBeNull();
  });

  it("explicit link choices win over defaults and portions requote", async () => {
    const runtime = server();
    wrap(runtime, <BuyScreen packageId="p-rumahan" initial={{ portions: "2", cycles: "2" }} />);
    await waitFor(() => expect(runtime.api.quote).toHaveBeenCalledWith(expect.objectContaining({ portions: 2, cycles: 2 })));
    await bayarReady();
    fireEvent.press(screen.getByRole("button", { name: "Tambah Porsi per hari" }));
    expect(screen.getByRole("button", { name: "Bayar" })).toBeDisabled();
    await waitFor(() => expect(runtime.api.quote).toHaveBeenLastCalledWith(expect.objectContaining({ portions: 3, cycles: 2 })));
    await bayarReady();
  });

  it("a trial is one day at the trial price", async () => {
    const runtime = server();
    wrap(runtime, <BuyScreen packageId="p-rumahan" trial />);
    await waitFor(() => expect(runtime.api.quote).toHaveBeenCalledWith(expect.objectContaining({ trial: true, cycles: 1 })));
    expect(screen.queryByRole("radio", { name: "40 hari · Hemat 5%" })).toBeNull();
    expect(await screen.findByText(`1 hari × 1 porsi × ${currency(30000, "id")}`)).toBeTruthy();
  });

  it("a failed quote keeps Bayar disabled and offers a retry", async () => {
    const runtime = server();
    (runtime.api.quote as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("CAPACITY"), { code: "CAPACITY" }));
    wrap(runtime, <BuyScreen packageId="p-rumahan" />);
    fireEvent.press(await screen.findByRole("button", { name: "Hitung ulang" }));
    expect(screen.getByRole("button", { name: "Bayar" })).toBeDisabled();
    await bayarReady();
  });

  it("offers the next start when the same package is still running", async () => {
    const running = subscription({ id: "s-1", package_id: "p-rumahan", ends_on: "2026-10-15" });
    const runtime = server({ subscriptions: [running] });
    (runtime.api.quote as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("OVERLAP"), { code: "OVERLAP" }));
    wrap(runtime, <BuyScreen packageId="p-rumahan" />);
    expect(await screen.findByText("Paket ini masih berjalan sampai Kamis 15 Okt.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hitung ulang" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: /Mulai Jumat 16 Okt/ }));
    await waitFor(() => expect(runtime.api.quote).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: "2026-10-16" })));
    await bayarReady();
    expect(screen.queryByText(/masih berjalan sampai/)).toBeNull();
  });

  it("keeps the generic retry for other quote errors", async () => {
    const runtime = server({ subscriptions: [subscription({ package_id: "p-rumahan", ends_on: "2026-10-15" })] });
    (runtime.api.quote as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("CAPACITY"), { code: "CAPACITY" }));
    wrap(runtime, <BuyScreen packageId="p-rumahan" />);
    expect(await screen.findByRole("button", { name: "Hitung ulang" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Mulai/ })).toBeNull();
  });

  it("shows a single length as text", async () => {
    wrap(server({ pkg: offer({ id: "p-rumahan", name: "Makan Siang Rumahan", days: 20, price: 28000 }) }), <BuyScreen packageId="p-rumahan" />);
    expect(await screen.findByText("20 hari")).toBeTruthy();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    await bayarReady();
  });

  it("Bayar is a forest primary button", async () => {
    wrap(server(), <BuyScreen packageId="p-rumahan" />);
    await bayarReady();
    expect(StyleSheet.flatten(screen.getByRole("button", { name: "Bayar" }).props.style).backgroundColor).toBe(nativeThemes.light.forest);
  });

  it("signed out goes to sign in and comes back to the same screen", async () => {
    wrap(server({ actor: null }), <BuyScreen packageId="p-rumahan" trial />);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent("/beli/p-rumahan?trial=1")}`),
    );
  });

  it("a renewal already waiting for payment continues it instead of buying twice", async () => {
    // The server reports a renewal with an open checkout as not available.
    const runtime = server({ context: { pendingCheckoutId: "ck-9", available: false } });
    wrap(runtime, <BuyScreen renewFrom="s-1" />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjutkan pembayaran" }));
    expect(router.replace).toHaveBeenCalledWith("/bayar/ck-9");
    expect(screen.getByRole("button", { name: "Bayar" })).toBeDisabled();
    expect(screen.queryByText(/belum bisa diperpanjang/)).toBeNull();
  });

  it("a renewal of a package that is no longer sold points to other packages instead of spinning", async () => {
    const lain = offer({ id: "p-lain", name: "Makan Siang Hemat" });
    const runtime = server({ context: { replacementRequired: true, available: false, offers: [lain] } });
    const view = wrap(runtime, <BuyScreen renewFrom="s-1" />);
    expect(await screen.findByText("Paket sebelumnya sudah tidak tersedia. Pilih paket lain dari Dapur Contoh.")).toBeTruthy();
    expect(view.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Bayar" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Makan Siang Hemat" }));
    // A renewal that cannot go ahead is left for the other package, or for the Jelajah tab.
    expect(leaveFor).toHaveBeenCalledWith("/paket/p-lain");
    fireEvent.press(screen.getByRole("button", { name: "Lihat paket lain" }));
    expect(goToTab).toHaveBeenCalledWith("jelajah");
  });

  it("an unpublished renewal with an open checkout still leads to that payment first", async () => {
    const lain = offer({ id: "p-lain", name: "Makan Siang Hemat" });
    const runtime = server({
      context: { replacementRequired: true, available: false, pendingCheckoutId: "ck-9", offers: [lain] },
    });
    wrap(runtime, <BuyScreen renewFrom="s-1" />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjutkan pembayaran" }));
    expect(router.replace).toHaveBeenCalledWith("/bayar/ck-9");
  });

  it("sheet options are 48dp picks with a selection haptic", async () => {
    wrap(server(), <BuyScreen packageId="p-rumahan" />);
    await bayarReady();
    fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" }));
    const home = screen.getByRole("radio", { name: /Rumah/ });
    expect(StyleSheet.flatten(home.props.style).minHeight).toBeGreaterThanOrEqual(48);
    fireEvent.press(home);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("cycle options give a selection haptic", async () => {
    wrap(server(), <BuyScreen packageId="p-rumahan" />);
    await bayarReady();
    const long = screen.getByRole("radio", { name: "40 hari · Hemat 5%" });
    expect(StyleSheet.flatten(long.props.style).minHeight).toBeGreaterThanOrEqual(48);
    fireEvent.press(long);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("an address outside the area hides the old price", async () => {
    wrap(server(), <BuyScreen packageId="p-rumahan" />);
    await bayarReady();
    expect(screen.getByText("Biaya layanan")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" }));
    fireEvent.press(screen.getByRole("radio", { name: /Rumah/ }));
    expect(await screen.findByText("Alamat ini di luar jangkauan Dapur Contoh. Pilih alamat lain.")).toBeTruthy();
    expect(screen.queryByText("Biaya layanan")).toBeNull();
    expect(screen.queryByText(totalOf({ startDate: "2026-10-08" }))).toBeNull();
    expect(screen.getByRole("button", { name: "Bayar" })).toBeDisabled();
  });

  it("a changed price is explained and requoted before paying", async () => {
    const runtime = server();
    const create = runtime.api.command as jest.Mock;
    const real = create.getMockImplementation()!;
    create.mockImplementationOnce(async () => {
      throw Object.assign(new Error("PRICE_CHANGED"), { code: "PRICE_CHANGED" });
    });
    wrap(runtime, <BuyScreen packageId="p-rumahan" />);
    await bayarReady();
    const quotes = (runtime.api.quote as jest.Mock).mock.calls.length;
    fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    expect(await screen.findByText("Harga atau ketentuan berubah. Tinjau ulang sebelum membayar.")).toBeTruthy();
    await waitFor(() => expect((runtime.api.quote as jest.Mock).mock.calls.length).toBeGreaterThan(quotes));
    expect(router.replace).not.toHaveBeenCalled();
    create.mockImplementation(real);
    await bayarReady();
  });

  it("a two-cycle renewal pays with cycles 2 and renewedFrom", async () => {
    const runtime = server();
    wrap(runtime, <BuyScreen renewFrom="s-1" />);
    await bayarReady();
    fireEvent.press(screen.getByRole("radio", { name: "40 hari · Hemat 5%" }));
    await waitFor(() => expect(runtime.api.quote).toHaveBeenLastCalledWith(expect.objectContaining({ cycles: 2 })));
    await bayarReady();
    fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/bayar/ck-1"));
    const payload = { packageId: "p-rumahan", addressId: "a-1", portions: 1, startDate: "2026-10-19", cycles: 2, trial: false, renewedFrom: "s-1" };
    expect(commands(runtime)[0]).toEqual([
      "checkout.create",
      { ...payload, expectedQuote: quoteFor(payload), acceptedTerms: true },
      expect.any(String),
    ]);
  });

  it("a failed payment start still opens Bayar, which offers the method again", async () => {
    const runtime = server({ startFails: true });
    const view = wrap(runtime, <BuyScreen packageId="p-rumahan" />);
    await bayarReady();
    fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/bayar/ck-1"));
    expect(commands(runtime).map((c) => c[0])).toEqual(["checkout.create", "checkout.payment.start"]);
    view.unmount();
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByRole("button", { name: "Tampilkan QRIS" })).toBeTruthy();
  });
});

describe("Beli and Bayar mood headers", () => {
  // 15.00 in Jakarta and later is Malam; the default theme here is light.
  const MALAM = () => new Date("2026-10-07T08:00:00Z");
  const malam = nativeMood.light.malam;
  const flat = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
  /** The fill of the nearest ancestor that paints one: the card or box the text sits in. */
  const surfaceAround = (node: { parent: unknown; props: { style?: unknown } }) => {
    let at = node.parent as typeof node | null;
    while (at && !flat(at).backgroundColor) at = at.parent as typeof node | null;
    return at ? flat(at).backgroundColor : undefined;
  };
  const wrapMood = (runtime: MobileRuntime, ui: React.ReactElement) =>
    render(
      <MoodProvider now={MALAM}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          {ui}
        </MobileProvider>
      </MoodProvider>,
    );

  it("Beli titles the screen with the package inside a Malam header, with the back button in it", async () => {
    wrapMood(server(), <BuyScreen packageId="p-rumahan" />);
    const header = await screen.findByTestId("buy-header");
    expect(flat(within(header).getByTestId("mood-fill-malam", { includeHiddenElements: true })).backgroundColor).toBe("#0B1F16");
    const title = await within(header).findByText("Makan Siang Rumahan");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title).color).toBe("#FFF7E9");
    expect(screen.queryByRole("tab", { name: "Malam" })).toBeNull();
    // The portions card in the body keeps the theme surface, not the header fill.
    const portions = await screen.findByText("Porsi per hari");
    expect(within(header).queryByText("Porsi per hari")).toBeNull();
    expect(surfaceAround(portions)).toBe("#FFFEFA");
    expect(nativeThemes.light.surface).toBe("#FFFEFA");
    expect(malam.headerText).toBe("#FFF7E9");
    // The form below stays on the page, outside the header.
    expect(within(header).queryByText("Lama paket")).toBeNull();
    expect(screen.getByText("Lama paket")).toBeTruthy();
  });

  it("Beli's back button is 48dp and still goes back", async () => {
    wrapMood(server(), <BuyScreen packageId="p-rumahan" />);
    const back = await within(await screen.findByTestId("buy-header")).findByRole("button", { name: "Kembali" });
    expect([flat(back).width, flat(back).height]).toEqual([48, 48]);
    fireEvent.press(back);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("Perpanjang names the renewal in the header", async () => {
    wrapMood(server(), <BuyScreen renewFrom="s-1" />);
    const header = await screen.findByTestId("buy-header");
    expect(await within(header).findByText("Perpanjang Makan Siang Rumahan")).toBeTruthy();
  });

  it("keeps a header while the package loads, is missing, or cannot be read", async () => {
    const missing = wrapMood(server(), <BuyScreen packageId="p-nope" />);
    const header = await screen.findByTestId("buy-header");
    expect(within(header).getByRole("button", { name: "Kembali" })).toBeTruthy();
    expect(within(header).getByText("Beli")).toBeTruthy();
    expect(await screen.findByText("Paket tidak ditemukan.")).toBeTruthy();
    expect(within(header).queryByText("Paket tidak ditemukan.")).toBeNull();
    missing.unmount();

    const broken = server();
    (broken.api.offer as jest.Mock).mockRejectedValue(new Error("REQUEST_TIMEOUT"));
    wrapMood(broken, <BuyScreen packageId="p-rumahan" />);
    const again = await screen.findByTestId("buy-header");
    expect(within(again).getByText("Beli")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  it("a renewal of a package that is no longer sold keeps the header and its back button", async () => {
    const lain = offer({ id: "p-lain", name: "Makan Siang Hemat" });
    wrapMood(server({ context: { replacementRequired: true, available: false, offers: [lain] } }), <BuyScreen renewFrom="s-1" />);
    const header = await screen.findByTestId("buy-header");
    expect(within(header).getByText("Perpanjang")).toBeTruthy();
    fireEvent.press(within(header).getByRole("button", { name: "Kembali" }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("Bayar titles the QR step in a Malam header and its back button goes back at 48dp", async () => {
    wrapMood(server({ checkout: pendingCheckout() }), <PaymentScreen checkoutId="ck-1" />);
    const header = await screen.findByTestId("payment-header");
    expect(flat(within(header).getByTestId("mood-fill-malam", { includeHiddenElements: true })).backgroundColor).toBe("#0B1F16");
    const title = within(header).getByText("Bayar");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title).color).toBe("#FFF7E9");
    const back = within(header).getByRole("button", { name: "Kembali" });
    expect([flat(back).width, flat(back).height]).toEqual([48, 48]);
    fireEvent.press(back);
    expect(router.back).toHaveBeenCalledTimes(1);
    // The total and the steps stay on the page.
    expect(within(header).queryByText("Total")).toBeNull();
    expect(await screen.findByLabelText("Kode QRIS pembayaran ini")).toBeTruthy();
  });

  it("Bayar's bank-transfer card stays on the theme surface below the header", async () => {
    const va = pendingCheckout(
      {},
      {
        selectedMethod: "VIRTUAL_ACCOUNT_BRI",
        instructions: { kind: "virtual_account", accountNumber: "8808123456789012", accountName: "CATERA SINTETIS", bank: "BRI" },
      },
    );
    wrapMood(server({ checkout: va }), <PaymentScreen checkoutId="ck-1" />);
    const label = await screen.findByText("Nomor virtual account BRI");
    expect(within(screen.getByTestId("payment-header")).queryByText("Nomor virtual account BRI")).toBeNull();
    expect(surfaceAround(label)).toBe("#FFFEFA");
  });

  it("Bayar keeps the header in the outcome and not-found states", async () => {
    const paid = pendingCheckout({ state: "paid", subscription_id: "s-2" }, { status: "paid" });
    const done = wrapMood(server({ checkout: paid }), <PaymentScreen checkoutId="ck-1" />);
    // Paid is its own beat: the header names it instead of the payment step.
    expect(await within(await screen.findByTestId("payment-header")).findByText("Pembayaran diterima")).toBeTruthy();
    expect(within(screen.getByTestId("payment-header")).queryByText("Bayar")).toBeNull();
    done.unmount();

    // The server has no such checkout: the page says so with a retry, under the same header.
    wrapMood(server(), <PaymentScreen checkoutId="ck-1" />);
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    const header = screen.getByTestId("payment-header");
    expect(within(header).getByRole("button", { name: "Kembali" })).toBeTruthy();
    expect(within(header).queryByRole("button", { name: "Coba lagi" })).toBeNull();
    expect(retry).toBeTruthy();
  });
});

describe("Bayar", () => {
  const QR_LABEL = "Kode QRIS pembayaran ini";

  it("payment screen survives reopening", async () => {
    const runtime = server({ checkout: pendingCheckout() });
    const first = wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByLabelText(QR_LABEL)).toBeTruthy();
    expect(screen.getByText("Bayar dalam 15:00")).toBeTruthy();
    expect(screen.getAllByText(totalOf()).length).toBeGreaterThan(0);
    expect(
      screen.getByText("20 hari antar Anda dijaga selama 15 menit. Lewat dari itu, jadwal dicek ulang sebelum dibayar."),
    ).toBeTruthy();
    first.unmount();

    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByLabelText(QR_LABEL)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Saya sudah bayar, cek status" }));
    expect(await screen.findByText("Pembayaran diterima")).toBeTruthy();
    expect(runtime.api.command).toHaveBeenCalledWith("checkout.payment.refresh", { id: "ck-1" }, expect.any(String));
    expect(screen.queryByLabelText(QR_LABEL)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Ke Beranda" }));
    expect(goToTab).toHaveBeenCalledWith("index");
  });

  it("cek status while nothing has been paid says so and keeps the payment open", async () => {
    const runtime = server({ checkout: pendingCheckout() });
    const refresh = runtime.api.command as jest.Mock;
    refresh.mockImplementation(async () => ({}));
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByLabelText(QR_LABEL)).toBeTruthy();
    expect(screen.queryByText("Belum ada pembayaran masuk. Selesaikan pembayaran, lalu cek lagi.")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Saya sudah bayar, cek status" }));
    expect(await screen.findByText("Belum ada pembayaran masuk. Selesaikan pembayaran, lalu cek lagi.")).toBeTruthy();
    expect(refresh).toHaveBeenCalledWith("checkout.payment.refresh", { id: "ck-1" }, expect.any(String));
    expect(screen.getByLabelText(QR_LABEL)).toBeTruthy();
  });

  for (const [name, found] of [
    ["paid", (c: Checkout): Checkout => ({ ...c, state: "paid", subscription_id: "s-2", payment: { ...c.payment!, status: "paid" } })],
    ["being checked", (c: Checkout): Checkout => ({ ...c, payment: { ...c.payment!, status: "checking", instructions: null } })],
  ] as const)
    it(`cek status that finds the payment ${name} never says nothing came in, even when the reload fails`, async () => {
      const runtime = server({ checkout: pendingCheckout() });
      const refresh = runtime.api.command as jest.Mock;
      refresh.mockImplementation(async () => found(pendingCheckout()));
      wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
      expect(await screen.findByLabelText(QR_LABEL)).toBeTruthy();
      (runtime.api.checkout as jest.Mock).mockRejectedValue(Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }));
      fireEvent.press(screen.getByRole("button", { name: "Saya sudah bayar, cek status" }));
      await waitFor(() => expect(refresh).toHaveBeenCalledWith("checkout.payment.refresh", { id: "ck-1" }, expect.any(String)));
      await waitFor(() => expect(screen.getByRole("button", { name: "Saya sudah bayar, cek status" })).toBeEnabled());
      await act(async () => {});
      expect(screen.queryByText("Belum ada pembayaran masuk. Selesaikan pembayaran, lalu cek lagi.")).toBeNull();
    });

  it("cek status on a hosted payment that is still unpaid says so too", async () => {
    const hosted = { ...pendingCheckout(), payment: undefined };
    const runtime = server({ demo: true, checkout: hosted });
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    await screen.findByRole("button", { name: "Bayar (demo)" });
    fireEvent.press(screen.getByRole("button", { name: "Saya sudah bayar, cek status" }));
    expect(await screen.findByText("Belum ada pembayaran masuk. Selesaikan pembayaran, lalu cek lagi.")).toBeTruthy();
    // The first read, the one cek status judged by, and the screen's reload.
    expect(runtime.api.checkout).toHaveBeenCalledTimes(3);
  });

  it("expired payment offers Bayar lagi", async () => {
    const runtime = server({ checkout: pendingCheckout({ state: "expired" }, { status: "expired" }) });
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByText("Waktu habis. Jadwal dicek ulang saat membayar lagi.")).toBeTruthy();
    expect(screen.queryByLabelText(QR_LABEL)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Bayar lagi" }));
    expect(router.replace).toHaveBeenCalledWith("/beli/p-rumahan?portions=1&cycles=1&addressId=a-1");
  });

  it("an expired renewal pays again from Perpanjang", async () => {
    const base = pendingCheckout({ state: "expired" }, { status: "expired" });
    const runtime = server({ checkout: { ...base, quote: { ...base.quote, renewedFrom: "s-1" } } });
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    fireEvent.press(await screen.findByRole("button", { name: "Bayar lagi" }));
    expect(router.replace).toHaveBeenCalledWith("/renew/s-1?portions=1&cycles=1&addressId=a-1");
  });

  it("an elapsed deadline hides the QR and never offers a second purchase", async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const runtime = server({ checkout: pendingCheckout({}, { expiresAt: past }) });
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByText("Memeriksa pembayaran")).toBeTruthy();
    expect(screen.queryByLabelText(QR_LABEL)).toBeNull();
    expect(screen.queryByRole("button", { name: "Bayar lagi" })).toBeNull();
  });

  for (const [status, extra] of [
    ["choose_method", { selectedMethod: null }],
    ["preparing", {}],
    ["checking", {}],
    ["failed", {}],
  ] as const)
    it(`a direct payment past its hold with no instructions ever shown (${status}) ran out, as Riwayat says`, async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      const runtime = server({
        checkout: pendingCheckout({ expires_at: past }, { status, expiresAt: past, instructions: null, ...extra }),
      });
      wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
      expect(await screen.findByText("Waktu habis. Jadwal dicek ulang saat membayar lagi.")).toBeTruthy();
      expect(screen.queryByText("Memeriksa pembayaran")).toBeNull();
      fireEvent.press(screen.getByRole("button", { name: "Bayar lagi" }));
      expect(router.replace).toHaveBeenCalledWith("/beli/p-rumahan?portions=1&cycles=1&addressId=a-1");
    });

  it("paid without a booking stays in checking and refreshes from the provider", async () => {
    const runtime = server({ checkout: pendingCheckout({ state: "paid" }) });
    (runtime.api.command as jest.Mock).mockResolvedValue({});
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByText("Memeriksa pembayaran")).toBeTruthy();
    expect(screen.queryByText("Pembayaran diterima")).toBeNull();
    // No paid beat before the booking exists (Review Focus 4): no hero, no reserved days, the header still says Bayar.
    expect(screen.queryByTestId("paid-hero")).toBeNull();
    expect(screen.queryByText("Jadwal antar Anda sudah tersimpan.")).toBeNull();
    expect(within(screen.getByTestId("payment-header")).getByText("Bayar")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lihat jadwal" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Cek status" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith("checkout.payment.refresh", { id: "ck-1" }, expect.any(String)),
    );
    await waitFor(() => expect(runtime.api.checkout).toHaveBeenCalledTimes(2));
  });

  for (const [state, title] of [
    ["failed", "Pembayaran gagal. Jadwal dicek ulang saat membayar lagi."],
    ["payment_exception", "Pembayaran sedang ditinjau"],
    ["refunded", "Pembayaran dikembalikan"],
    ["partially_refunded", "Sebagian pembayaran dikembalikan"],
  ])
    it(`${state} never offers payment or claims success`, async () => {
      const subscriptionId = ["refunded", "partially_refunded"].includes(state) ? "s-2" : null;
      const runtime = server({ demo: true, checkout: pendingCheckout({ state, subscription_id: subscriptionId }) });
      wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
      expect(await screen.findByText(title)).toBeTruthy();
      expect(screen.queryByText("Pembayaran diterima")).toBeNull();
      expect(screen.queryByRole("button", { name: "Bayar (demo)" })).toBeNull();
      expect(screen.queryByLabelText(QR_LABEL)).toBeNull();
    });

  it("direct payment never shows the demo shortcut", async () => {
    wrap(server({ demo: true, checkout: pendingCheckout() }), <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByLabelText(QR_LABEL)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Bayar (demo)" })).toBeNull();
  });

  it("demo mode pays a hosted checkout with Bayar (demo)", async () => {
    const hosted = { ...pendingCheckout(), payment: undefined };
    const runtime = server({ demo: true, checkout: hosted });
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    fireEvent.press(await screen.findByRole("button", { name: "Bayar (demo)" }));
    expect(await screen.findByText("Pembayaran diterima")).toBeTruthy();
    expect(runtime.api.command).toHaveBeenCalledWith("checkout.demo_pay", { id: "ck-1" }, expect.any(String));
  });

  it("hosted payment opens the provider page", async () => {
    const hosted = { ...pendingCheckout({ payment_url: "https://pay.example.test/ck-1" }), payment: undefined };
    const runtime = server({ checkout: hosted });
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    fireEvent.press(await screen.findByRole("button", { name: "Buka halaman pembayaran" }));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith("https://pay.example.test/ck-1"));
    await waitFor(() => expect(runtime.api.checkout).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Bayar (demo)" })).toBeNull();
  });

  it("a method not started yet can be started from Bayar", async () => {
    const runtime = server({
      checkout: pendingCheckout({}, { status: "choose_method", selectedMethod: null, instructions: null }),
    });
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    fireEvent.press(await screen.findByRole("button", { name: "Tampilkan QRIS" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith("checkout.payment.start", { id: "ck-1", method: "QRIS" }, expect.any(String)),
    );
    await waitFor(() => expect(runtime.api.checkout).toHaveBeenCalledTimes(2));
  });

  it("polls the provider every 10 s while open and stops once paid", async () => {
    jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate", "clearImmediate", "queueMicrotask"] });
    try {
      const runtime = server({ checkout: pendingCheckout() });
      const refreshes = () => commands(runtime).filter((c) => c[0] === "checkout.payment.refresh").length;
      wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
      expect(await screen.findByLabelText(QR_LABEL)).toBeTruthy();
      expect(refreshes()).toBe(0);
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });
      expect(await screen.findByText("Pembayaran diterima")).toBeTruthy();
      expect(refreshes()).toBe(1);
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(refreshes()).toBe(1);
    } finally {
      onlyDate();
    }
  });

  it("a virtual account number can be copied", async () => {
    const runtime = server({
      checkout: pendingCheckout(
        {},
        {
          selectedMethod: "VIRTUAL_ACCOUNT_BRI",
          instructions: { kind: "virtual_account", accountNumber: "8808123456789012", accountName: "CATERA SINTETIS", bank: "BRI" },
        },
      ),
    });
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByText("8808123456789012")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Salin nomor" }));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith("8808123456789012"));
  });

  it("a provider-expired payment before the deadline keeps checking instead of selling again", async () => {
    jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate", "clearImmediate", "queueMicrotask"] });
    try {
      const runtime = server({ checkout: pendingCheckout({}, { status: "expired" }) });
      (runtime.api.command as jest.Mock).mockResolvedValue({});
      const refreshes = () => commands(runtime).filter((c) => c[0] === "checkout.payment.refresh").length;
      wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
      expect(await screen.findByText("Memeriksa pembayaran")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Bayar lagi" })).toBeNull();
      expect(screen.getByRole("button", { name: "Cek status" })).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });
      await waitFor(() => expect(refreshes()).toBe(1));
    } finally {
      onlyDate();
    }
  });

  it("Bayar lagi keeps the customer's choices", async () => {
    const base = pendingCheckout({ state: "expired" }, { status: "expired" });
    const quote = quoteFor({ packageId: "p-rumahan", addressId: "a-2", portions: 2, startDate: "2026-10-19", cycles: 2, trial: false });
    wrap(server({ checkout: { ...base, quote } }), <PaymentScreen checkoutId="ck-1" />);
    fireEvent.press(await screen.findByRole("button", { name: "Bayar lagi" }));
    expect(router.replace).toHaveBeenCalledWith("/beli/p-rumahan?portions=2&cycles=2&addressId=a-2");
  });

  it("a trial pays again as a trial", async () => {
    const base = pendingCheckout({ state: "failed" });
    const quote = quoteFor({ packageId: "p-rumahan", addressId: "a-1", portions: 1, startDate: "2026-10-19", cycles: 1, trial: true });
    wrap(server({ checkout: { ...base, quote } }), <PaymentScreen checkoutId="ck-1" />);
    fireEvent.press(await screen.findByRole("button", { name: "Bayar lagi" }));
    expect(router.replace).toHaveBeenCalledWith("/beli/p-rumahan?trial=1&portions=1&addressId=a-1");
  });

  it("checks the payment once when the app comes back to the front", async () => {
    // React Native's jest setup mocks AppState: the listeners registered while mounted are in its calls.
    const listen = AppState.addEventListener as unknown as jest.Mock;
    expect(jest.isMockFunction(listen)).toBe(true);
    const runtime = server({ checkout: pendingCheckout() });
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByLabelText(QR_LABEL)).toBeTruthy();
    expect(commands(runtime).filter((c) => c[0] === "checkout.payment.refresh")).toHaveLength(0);
    // Only listeners still subscribed (an effect re-run removes its old one).
    const handlers = listen.mock.calls
      .filter((c, i) => c[0] === "change" && !listen.mock.results[i]?.value?.remove?.mock?.calls.length)
      .map((c) => c[1] as (s: string) => void);
    await act(async () => handlers.forEach((h) => h("active")));
    expect(await screen.findByText("Pembayaran diterima")).toBeTruthy();
    expect(commands(runtime).filter((c) => c[0] === "checkout.payment.refresh")).toHaveLength(1);
  });

  it("the bank transfer can be chosen on Bayar", async () => {
    const runtime = server({
      checkout: pendingCheckout({}, { status: "choose_method", selectedMethod: null, instructions: null }),
    });
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    fireEvent.press(await screen.findByRole("button", { name: "Pakai transfer bank (VA)" }));
    fireEvent.press(screen.getByRole("button", { name: "Tampilkan nomor VA" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "checkout.payment.start",
        { id: "ck-1", method: "VIRTUAL_ACCOUNT_BRI" },
        expect.any(String),
      ),
    );
    await waitFor(() => expect(runtime.api.checkout).toHaveBeenCalledTimes(2));
  });

  it("keeps the QRIS quiet zone pure white under the dark theme", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    try {
      render(
        <ThemeProvider storageKey="catera.theme">
          <QrisCode value={QR} label={QR_LABEL} qrRef={{ current: null }} />
        </ThemeProvider>,
      );
      await act(async () => {});
      const box = StyleSheet.flatten(screen.getByLabelText(QR_LABEL).props.style);
      expect(box.backgroundColor).toBe("#FFFFFF");
      // Control: the frame line follows the theme, so this proves dark was in force while the field stayed white.
      expect(box.borderColor).toBe(nativeThemes.dark.line);
    } finally {
      scheme.mockRestore();
    }
  });
});

describe("Pembayaran diterima", () => {
  const QR_LABEL = "Kode QRIS pembayaran ini";
  const flat = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
  /** A paid checkout whose booking exists. purchase_confirmed_viewed is counted once per checkout id for the whole
   * app process, so a test that checks the count passes an id of its own. */
  const paidCheckout = (extra: Partial<Checkout> = {}, quote: Partial<Quote> = {}): Checkout => {
    const base = pendingCheckout({ state: "paid", subscription_id: "s-2", ...extra }, { status: "paid" });
    return { ...base, quote: { ...base.quote, ...quote } };
  };
  /** Three days, out of order on purpose: the screen sorts them. */
  const SHORT = ["2026-10-21", "2026-10-19", "2026-10-20"];
  const footerLabels = () =>
    within(screen.getByTestId("screen-footer"))
      .getAllByRole("button")
      .map((b) => b.props.accessibilityLabel);
  const successes = () => (Haptics.notificationAsync as jest.Mock).mock.calls.filter(([kind]) => kind === "success");
  const viewed = (runtime: MobileRuntime) =>
    (runtime.api.usage as jest.Mock).mock.calls.filter(([name]) => name === "purchase_confirmed_viewed");
  /** Records the hardware back handlers that are still subscribed, and presses back through them. */
  function hardwareBack() {
    const live: (() => boolean | null | undefined)[] = [];
    const spy = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
      live.push(handler);
      return { remove: () => void live.splice(live.indexOf(handler), 1) };
    });
    return { press: () => live.map((h) => h()), count: () => live.length, restore: () => spy.mockRestore() };
  }

  it("shows the food, the package, the first delivery and every reserved day of a short plan", async () => {
    wrap(server({ checkout: paidCheckout({}, { dates: SHORT }) }), <PaymentScreen checkoutId="ck-1" />);
    const header = await screen.findByTestId("payment-header");
    const title = await within(header).findByText("Pembayaran diterima");
    expect(title.props.accessibilityRole).toBe("header");

    // The hero is the mood surface: the food photo at radius 20, the package, its caterer and the first delivery.
    const hero = within(screen.getByTestId("paid-hero"));
    expect(hero.getByTestId("paid-hero-fill-siang", { includeHiddenElements: true })).toBeTruthy();
    expect(flat(hero.getByTestId("paid-photo", { includeHiddenElements: true })).borderRadius).toBe(20);
    expect(hero.getByTestId("paid-photo-image", { includeHiddenElements: true }).props.source).toEqual({
      uri: "https://images.example.test/rumahan.jpg",
    });
    expect(hero.getByText("Makan Siang Rumahan")).toBeTruthy();
    expect(hero.getByText("Dapur Contoh")).toBeTruthy();
    const first = hero.getByText("Antar pertama Senin 19 Okt");
    expect(flat(first).fontVariant).toEqual(["tabular-nums"]);

    expect(screen.getByText("Jadwal antar Anda sudah tersimpan.")).toBeTruthy();
    // Every reserved day, sorted, as plain wrapped chips on the body (not buttons, not in the hero), tabular figures.
    const chips = screen.getAllByTestId("paid-date");
    expect(chips.map((c) => c.props.children)).toEqual(["Senin 19 Okt", "Selasa 20 Okt", "Rabu 21 Okt"]);
    expect(flat(chips[0]).fontVariant).toEqual(["tabular-nums"]);
    // Plain tags, not the chip control look: a quiet sage fill with no outline, regular body ink, continuous corners.
    const tag = flat(screen.getAllByTestId("paid-date-tag")[0]);
    expect(tag.backgroundColor).toBe(nativeThemes.light.sage);
    expect(tag.borderWidth ?? 0).toBe(0);
    expect(tag.borderColor).toBeUndefined();
    expect(tag.borderCurve).toBe("continuous");
    expect(flat(chips[0]).color).toBe(nativeThemes.light.charcoal);
    expect(flat(chips[0]).fontFamily).toBe(fonts.regular);
    expect(hero.queryAllByTestId("paid-date")).toHaveLength(0);
    expect(flat(screen.getByTestId("paid-dates")).flexWrap).toBe("wrap");
    expect(screen.queryByRole("button", { name: /Okt/ })).toBeNull();
    expect(screen.queryByText(/hari lainnya/)).toBeNull();
    // Nothing from paying is left: no QR, no payment help, no total line.
    expect(screen.queryByLabelText(QR_LABEL)).toBeNull();
    expect(screen.queryByRole("button", { name: "Bantuan pembayaran" })).toBeNull();
    expect(screen.queryByText(currency(paidCheckout().quote.total, "id"), { exact: false })).toBeNull();
  });

  it("the reserved-day tags read the dark theme's sage fill and ink", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    try {
      render(
        <ThemeProvider storageKey="catera.theme">
          <MobileProvider runtime={server({ checkout: paidCheckout({}, { dates: SHORT }) })} linkMapper={customerLink}>
            <PaymentScreen checkoutId="ck-1" />
          </MobileProvider>
        </ThemeProvider>,
      );
      await screen.findByTestId("paid-hero");
      await act(async () => {});
      expect(flat(screen.getAllByTestId("paid-date-tag")[0]).backgroundColor).toBe(nativeThemes.dark.sage);
      expect(flat(screen.getAllByTestId("paid-date")[0]).color).toBe(nativeThemes.dark.charcoal);
    } finally {
      scheme.mockRestore();
    }
  });

  it("turns the iOS edge swipe off once paid, so a swipe cannot pop back to checkout", async () => {
    const gesture = () => mockSetOptions.mock.calls.filter(([o]) => "gestureEnabled" in o).map(([o]) => o.gestureEnabled);
    wrap(server({ checkout: pendingCheckout() }), <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByLabelText(QR_LABEL)).toBeTruthy();
    // While paying, the swipe keeps its normal meaning.
    expect(gesture().at(-1)).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: "Saya sudah bayar, cek status" }));
    await screen.findByTestId("paid-hero");
    expect(gesture().at(-1)).toBe(false);
  });

  it("opened already paid has the iOS edge swipe off", async () => {
    wrap(server({ checkout: paidCheckout() }), <PaymentScreen checkoutId="ck-1" />);
    await screen.findByTestId("paid-hero");
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
  });

  it("a long plan shows its first six days, then how many more", async () => {
    wrap(server({ checkout: paidCheckout() }), <PaymentScreen checkoutId="ck-1" />);
    await screen.findByTestId("paid-hero");
    const chips = screen.getAllByTestId("paid-date");
    expect(chips.map((c) => c.props.children)).toEqual([
      "Senin 19 Okt",
      "Selasa 20 Okt",
      "Rabu 21 Okt",
      "Kamis 22 Okt",
      "Jumat 23 Okt",
      "Senin 26 Okt",
    ]);
    expect(screen.queryByText("Selasa 27 Okt")).toBeNull();
    const more = screen.getByText("dan 14 hari lainnya");
    expect(flat(more).fontVariant).toEqual(["tabular-nums"]);
  });

  it("offers the schedule first and home last when the caterer picks the menus", async () => {
    wrap(server({ checkout: paidCheckout() }), <PaymentScreen checkoutId="ck-1" />);
    await screen.findByTestId("paid-hero");
    expect(footerLabels()).toEqual(["Lihat jadwal", "Ke Beranda"]);
    fireEvent.press(screen.getByRole("button", { name: "Lihat jadwal" }));
    expect(goToTab).toHaveBeenLastCalledWith("jadwal");
    fireEvent.press(screen.getByRole("button", { name: "Ke Beranda" }));
    expect(goToTab).toHaveBeenLastCalledWith("index");
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("adds Pilih menu between them when the customer picks the menus, and shows the package photo, not a menu template", async () => {
    const choose = offer({
      menuSelectionMode: "customer",
      menus: [
        {
          meal: "lunch",
          name: "",
          description: "",
          image: "https://images.example.test/template.jpg",
          selectionStatus: "pending",
          items: [],
        } as unknown as ReturnType<typeof offer>["menus"][number],
      ],
    });
    const base = paidCheckout();
    wrap(server({ checkout: { ...base, quote: { ...base.quote, offer: choose } } }), <PaymentScreen checkoutId="ck-1" />);
    await screen.findByTestId("paid-hero");
    expect(screen.getByTestId("paid-photo-image", { includeHiddenElements: true }).props.source).toEqual({
      uri: "https://images.example.test/rumahan.jpg",
    });
    expect(footerLabels()).toEqual(["Lihat jadwal", "Pilih menu", "Ke Beranda"]);
    fireEvent.press(screen.getByRole("button", { name: "Pilih menu" }));
    // Bayar is left for Pilih menu, which opens in the tabs above the screen that started the purchase.
    expect(leaveFor).toHaveBeenLastCalledWith("/subscriptions/s-2/menu");
  });

  it("opened already paid gives no success haptic", async () => {
    wrap(server({ checkout: paidCheckout() }), <PaymentScreen checkoutId="ck-1" />);
    await screen.findByTestId("paid-hero");
    await act(async () => {});
    expect(successes()).toHaveLength(0);
  });

  it("turning paid while the screen is open gives one success haptic", async () => {
    const runtime = server({ checkout: pendingCheckout() });
    wrap(runtime, <PaymentScreen checkoutId="ck-1" />);
    expect(await screen.findByLabelText(QR_LABEL)).toBeTruthy();
    expect(successes()).toHaveLength(0);
    fireEvent.press(screen.getByRole("button", { name: "Saya sudah bayar, cek status" }));
    expect(await screen.findByTestId("paid-hero")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Lihat jadwal" })).toBeEnabled());
    await act(async () => {});
    expect(successes()).toHaveLength(1);
  });

  // Leaving paid selects a tab: goToTab drops Bayar and everything above the tabs (or, opened cold, replaces Bayar with
  // the tab), so no second tabs navigator lands above the package page or Riwayat pembayaran. navigation.test runs both
  // on the real router.
  const exits: [string, (back: ReturnType<typeof hardwareBack>) => void, string][] = [
    [
      "the header back",
      () => fireEvent.press(within(screen.getByTestId("payment-header")).getByRole("button", { name: "Kembali" })),
      "index",
    ],
    ["the hardware back", (back) => expect(back.press()).toEqual([true]), "index"],
    ["Ke Beranda", () => fireEvent.press(screen.getByRole("button", { name: "Ke Beranda" })), "index"],
    ["Lihat jadwal", () => fireEvent.press(screen.getByRole("button", { name: "Lihat jadwal" })), "jadwal"],
  ];
  for (const [exit, leave, target] of exits)
    it(`${exit} after paying selects the ${target === "index" ? "Beranda" : "Jadwal"} tab`, async () => {
      const back = hardwareBack();
      try {
        wrap(server({ checkout: paidCheckout() }), <PaymentScreen checkoutId="ck-1" />);
        await screen.findByTestId("paid-hero");
        leave(back);
        expect(goToTab).toHaveBeenCalledTimes(1);
        expect(goToTab).toHaveBeenCalledWith(target);
        expect(router.replace).not.toHaveBeenCalled();
        expect(router.back).not.toHaveBeenCalled();
        expect(router.push).not.toHaveBeenCalled();
      } finally {
        back.restore();
      }
    });

  for (const [entry, quote, canGoBack] of [
    ["a fresh purchase", {}, true],
    ["a renewal", { renewedFrom: "s-1" }, true],
    ["a checkout opened directly (Payments or a notification)", {}, false],
  ] as const)
    it(`back after paying ${entry} goes home, never back to checkout`, async () => {
      // Opened in a stack there is something to go back to, opened cold there is not: either way back selects Beranda.
      (router.canGoBack as jest.Mock).mockReturnValue(canGoBack);
      const exit = goToTab as jest.Mock;
      const back = hardwareBack();
      try {
        wrap(server({ checkout: paidCheckout({}, quote) }), <PaymentScreen checkoutId="ck-1" />);
        const header = await screen.findByTestId("payment-header");
        await screen.findByTestId("paid-hero");
        fireEvent.press(within(header).getByRole("button", { name: "Kembali" }));
        expect(exit).toHaveBeenLastCalledWith("index");
        // The hardware back is handled (true), so the navigator never pops to the checkout.
        expect(back.press()).toEqual([true]);
        expect(exit).toHaveBeenCalledTimes(2);
        expect(exit).toHaveBeenLastCalledWith("index");
        expect(router.back).not.toHaveBeenCalled();
      } finally {
        back.restore();
        (router.canGoBack as jest.Mock).mockReturnValue(true);
      }
    });

  it("handles the hardware back only once paid", async () => {
    const back = hardwareBack();
    try {
      wrap(server({ checkout: pendingCheckout() }), <PaymentScreen checkoutId="ck-1" />);
      expect(await screen.findByLabelText(QR_LABEL)).toBeTruthy();
      // While paying, back keeps its normal meaning.
      expect(back.count()).toBe(0);
      fireEvent.press(within(screen.getByTestId("payment-header")).getByRole("button", { name: "Kembali" }));
      expect(router.back).toHaveBeenCalledTimes(1);
      fireEvent.press(screen.getByRole("button", { name: "Saya sudah bayar, cek status" }));
      await screen.findByTestId("paid-hero");
      expect(back.count()).toBe(1);
      expect(back.press()).toEqual([true]);
      expect(goToTab).toHaveBeenLastCalledWith("index");
    } finally {
      back.restore();
    }
  });

  it("counts purchase_confirmed_viewed once per checkout id, however often it is opened", async () => {
    const runtime = server({ checkout: paidCheckout({ id: "ck-viewed-1" }) });
    const first = wrap(runtime, <PaymentScreen checkoutId="ck-viewed-1" />);
    await screen.findByTestId("paid-hero");
    await waitFor(() => expect(viewed(runtime)).toHaveLength(1));
    expect(viewed(runtime)[0]).toEqual(["purchase_confirmed_viewed", "customer"]);
    first.unmount();

    const second = wrap(runtime, <PaymentScreen checkoutId="ck-viewed-1" />);
    await screen.findByTestId("paid-hero");
    await act(async () => {});
    expect(viewed(runtime)).toHaveLength(1);
    second.unmount();

    // A second purchase counts again.
    const other = server({ checkout: paidCheckout({ id: "ck-viewed-2" }) });
    wrap(other, <PaymentScreen checkoutId="ck-viewed-2" />);
    await screen.findByTestId("paid-hero");
    await waitFor(() => expect(viewed(other)).toHaveLength(1));
  });

  it("does not count purchase_confirmed_viewed while the payment is still being checked", async () => {
    const runtime = server({ checkout: pendingCheckout({ id: "ck-viewed-3", state: "paid" }) });
    (runtime.api.command as jest.Mock).mockResolvedValue({});
    wrap(runtime, <PaymentScreen checkoutId="ck-viewed-3" />);
    expect(await screen.findByText("Memeriksa pembayaran")).toBeTruthy();
    await act(async () => {});
    expect(viewed(runtime)).toHaveLength(0);
  });
});
