import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { ActivityIndicator, AppState, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { addDays, currency, type Checkout, type Quote, type RenewalContext } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeThemes } from "@catera/design-tokens";
import { ThemeProvider } from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { BuyScreen } from "../src/buy/BuyScreen";
import { QrisCode } from "../src/buy/QrisCode";
import { PaymentScreen } from "../src/buy/PaymentScreen";
import { offer, subscription } from "./fixtures";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({}),
  // Focused for the whole test: the effect runs on mount and whenever its callback changes.
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]),
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
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
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
    expect(router.push).toHaveBeenCalledWith("/paket/p-lain");
    fireEvent.press(screen.getByRole("button", { name: "Lihat paket lain" }));
    expect(router.push).toHaveBeenCalledWith("/jelajah");
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
    expect(router.replace).toHaveBeenCalledWith("/");
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
