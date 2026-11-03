import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import type { CustomerActionItem } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { customerLink } from "../src/links";
import { onTabRoot, PaymentBarView, usePaymentBar } from "../src/buy/PaymentBar";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

const NOW = new Date("2026-11-01T05:00:00Z");
const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };

const pay = (id: string, status: CustomerActionItem["status"], ms: number): CustomerActionItem => ({
  id: `payment-${id}`,
  kind: "payment_action",
  status,
  priority: 1,
  dueAt: new Date(NOW.getTime() + ms).toISOString(),
  packageName: "Makan Siang Rumahan",
  href: `/payment/${id}`,
});

function runtimeWith(items: CustomerActionItem[]): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    customerActions: jest.fn(async () => ({ total: items.length, items })),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

function Harness() {
  const { bar, now } = usePaymentBar();
  return bar ? <PaymentBarView bar={bar} now={now} /> : null;
}

const mount = async (items: CustomerActionItem[]) =>
  await render(
    <MobileProvider runtime={runtimeWith(items)} linkMapper={customerLink}>
      <Harness />
    </MobileProvider>,
  );

const settle = async () => await act(async () => void (await new Promise((r) => setTimeout(r, 10))));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "queueMicrotask", "setTimeout", "clearTimeout", "setImmediate"] });
});
afterEach(() => jest.useRealTimers());

describe("onTabRoot", () => {
  it("is true on the four tab roots only", () => {
    expect(onTabRoot(["(tabs)", "(index)"])).toBe(true);
    expect(onTabRoot(["(tabs)", "(jelajah)", "jelajah"])).toBe(true);
    expect(onTabRoot(["(tabs)", "(akun)", "akun"])).toBe(true);
    expect(onTabRoot(["(tabs)", "(jelajah)", "paket", "[id]"])).toBe(false);
    expect(onTabRoot(["(tabs)", "(akun)", "pembayaran"])).toBe(false);
    expect(onTabRoot(["bayar", "[id]"])).toBe(false);
  });
});

describe("the payment bar", () => {
  it("one payment to finish: the countdown, the package and Bayar, opening Bayar", async () => {
    await mount([pay("ck-1", "awaiting_payment", 12 * 60_000 + 48_000)]);
    await settle();
    const button = screen.getByTestId("payment-bar-button");
    expect(button.props.accessibilityLabel).toBe("Selesaikan pembayaran, Makan Siang Rumahan, sisa 12:48, Bayar");
    // Docked strip: the countdown at the end edge, no Bayar pill inside the button.
    expect(screen.getByTestId("payment-bar-clock")).toBeTruthy();
    expect(screen.queryByText("Bayar")).toBeNull();
    await fireEvent.press(button);
    expect(router.push).toHaveBeenLastCalledWith("/bayar/ck-1");
  });

  it("the countdown runs, turns to Segera bayar under 3 minutes, and the bar leaves when the hold ends", async () => {
    await mount([pay("ck-1", "awaiting_payment", 3 * 60_000 + 2_000)]);
    await settle();
    expect(screen.getByTestId("payment-bar-button").props.accessibilityLabel).toContain("sisa 03:02");
    await act(() => void jest.advanceTimersByTime(3_000));
    expect(screen.getByTestId("payment-bar-button").props.accessibilityLabel).toMatch(/^Segera bayar, .*sisa 02:59/);
    await act(() => void jest.advanceTimersByTime(3 * 60_000));
    expect(screen.queryByTestId("payment-bar")).toBeNull();
  });

  it("no method yet asks to continue", async () => {
    await mount([pay("ck-1", "choose_method", 600_000)]);
    await settle();
    expect(screen.getByTestId("payment-bar-button").props.accessibilityLabel).toBe(
      "Lanjutkan pembayaran, Makan Siang Rumahan · pilih cara bayar, sisa 10:00, Lanjut",
    );
  });

  it("a payment being checked says not to pay again, with no clock and no Bayar", async () => {
    await mount([pay("ck-1", "checking_payment", 600_000)]);
    await settle();
    expect(screen.getByTestId("payment-bar-button").props.accessibilityLabel).toBe(
      "Pembayaran sedang dicek, Jangan bayar lagi · Makan Siang Rumahan",
    );
    expect(screen.queryByText("Bayar")).toBeNull();
  });

  it("two to finish open Riwayat pembayaran", async () => {
    await mount([pay("a", "awaiting_payment", 900_000), pay("b", "awaiting_payment", 300_000)]);
    await settle();
    const button = screen.getByTestId("payment-bar-button");
    expect(button.props.accessibilityLabel).toBe("2 pembayaran belum selesai, Yang terdekat habis 05:00, Lihat");
    expect(screen.queryByTestId("payment-bar-clock")).toBeNull();
    await fireEvent.press(button);
    expect(router.push).toHaveBeenLastCalledWith("/pembayaran");
  });

  it("nothing open, nothing drawn", async () => {
    await mount([]);
    await settle();
    expect(screen.queryByTestId("payment-bar")).toBeNull();
  });
});
