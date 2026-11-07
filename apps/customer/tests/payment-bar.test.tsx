import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import * as Reanimated from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { StyleSheet } from "react-native";
import { AppState } from "react-native";
import { router } from "expo-router";
import type { CustomerActionItem } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { customerLink } from "../src/links";
import { onTabRoot, PaymentBarView, usePaymentBar, usePaymentVibration } from "../src/buy/PaymentBar";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Warning: "warning" },
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

  describe("the last 3 minutes", () => {
    const bar = (ms: number, status = "pay") =>
      ({ kind: "one", status, deadline: new Date(NOW.getTime() + ms).toISOString(), packageName: "Makan Siang", href: "/payment/p1" }) as never;
    const draw = async (ms: number) => {
      const shake = jest.spyOn(Reanimated, "withSequence");
      shake.mockClear();
      await render(
        <MobileProvider runtime={runtimeWith([])} linkMapper={customerLink}>
          <PaymentBarView bar={bar(ms)} now={NOW.getTime()} os="android" />
        </MobileProvider>,
      );
      await settle();
      return shake;
    };

    it("the card shakes", async () => {
      expect(await draw(2 * 60_000)).toHaveBeenCalled();
    });

    it("with time to spare it stays still", async () => {
      expect(await draw(10 * 60_000)).not.toHaveBeenCalled();
    });

    it("vibrates once per nudge, every 15 seconds, and never while a payment is being checked or with time to spare", async () => {
      AppState.currentState = "active";
      const buzz = Haptics.notificationAsync as jest.Mock;
      const start = NOW.getTime();
      const { rerender } = await renderHook(({ b, now }: { b: never | null; now: number }) => usePaymentVibration(b, now), {
        initialProps: { b: bar(130_000) as never | null, now: start },
      });
      expect(buzz).toHaveBeenCalledTimes(1);
      await rerender({ b: bar(130_000), now: start + 1_000 });
      expect(buzz).toHaveBeenCalledTimes(1);
      await rerender({ b: bar(130_000), now: start + 16_000 });
      expect(buzz).toHaveBeenCalledTimes(2);
      await rerender({ b: bar(130_000, "checking"), now: start + 31_000 });
      await rerender({ b: bar(10 * 60_000), now: start + 46_000 });
      await rerender({ b: null, now: start + 61_000 });
      expect(buzz).toHaveBeenCalledTimes(2);
    });
  });

  describe("by platform", () => {
    const bar = { kind: "one", status: "pay", deadline: new Date(NOW.getTime() + 10 * 60_000).toISOString(), packageName: "Makan Siang", href: "/payment/p1" } as const;
    const draw = async (os: string) => {
      await render(
        <MobileProvider runtime={runtimeWith([])} linkMapper={customerLink}>
          <PaymentBarView bar={bar as never} now={NOW.getTime()} os={os} />
        </MobileProvider>,
      );
      await settle();
      return StyleSheet.flatten(screen.getByTestId("payment-bar-ground").props.style);
    };

    it("Android is a Material elevated card: a ripple, no border and no chevron", async () => {
      const ground = await draw("android");
      expect(ground.borderWidth).toBeUndefined();
      expect(ground.boxShadow).toContain("0 4px 8px 3px");
      expect(screen.queryByTestId("payment-bar-chevron")).toBeNull();
      // Pressable hands android_ripple to its host view under this name.
      expect(screen.getByTestId("payment-bar-button").props.nativeBackgroundAndroid).toBeTruthy();
    });

    it("older iOS keeps the border, the soft shadow and the chevron", async () => {
      const ground = await draw("ios");
      expect(ground.borderWidth).toBe(1);
      expect(ground.boxShadow).toContain("0 6px 20px");
      expect(screen.getByTestId("payment-bar-chevron")).toBeTruthy();
    });
  });
});
