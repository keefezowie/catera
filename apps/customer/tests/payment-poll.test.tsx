import { AppState, type AppStateStatus } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { Checkout } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { customerLink } from "../src/links";
import { PaymentScreen } from "../src/buy/PaymentScreen";
import { offer } from "./fixtures";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]),
}));
jest.mock("expo-router/react-navigation", () => ({
  ...jest.requireActual("expo-router/react-navigation"),
  useNavigation: () => ({ setOptions: jest.fn() }),
  usePreventRemove: jest.fn(),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => false), shareAsync: jest.fn(async () => undefined) }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));

const NOW = new Date("2026-10-07T03:00:00Z");
const HOUR = 60 * 60_000;

/** A direct checkout whose status is `status` for as long as the test runs: nothing ever moves it on. */
function checkoutWith(status: string): Checkout {
  const expiresAt = new Date(NOW.getTime() + 3 * HOUR).toISOString();
  return {
    id: "ck-1",
    state: "pending",
    expires_at: expiresAt,
    subscription_id: null,
    payment_url: null,
    quote: { packageId: "p-1", total: 562500, offer: offer({ id: "p-1" }) },
    payment: {
      mode: "direct",
      availableMethods: ["QRIS"],
      selectedMethod: "QRIS",
      status,
      expiresAt,
      instructions: { kind: "qris", qrContent: "SYNTHETIC" },
    },
  } as unknown as Checkout;
}

function setup(status: string, refresh: () => Promise<unknown> = async () => ({})) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  const command = jest.fn(refresh);
  runtime.api = {
    ...runtime.api,
    usage: jest.fn(async () => undefined),
    me: jest.fn(async () => ({ actor: { id: "u-c1", role: "customer", name: "Rani Contoh" }, demo: false })),
    customer: jest.fn(async () => ({ subscriptions: [], deliveries: [], addresses: [], notifications: [], cases: [] })),
    checkout: jest.fn(async () => checkoutWith(status)),
    command,
  } as unknown as MobileRuntime["api"];
  return { runtime, command };
}

const mount = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <PaymentScreen checkoutId="ck-1" />
    </MobileProvider>,
  );

/** Moves the clock in 10 s steps, letting each ask's promises settle, as a real wait would. */
async function pass(ms: number) {
  for (let left = ms; left > 0; left -= 10_000)
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
}

/** The app comes back to the front, as AppState tells everyone listening. */
let appState: ((s: AppStateStatus) => void)[] = [];
const returnToApp = () =>
  act(async () => {
    for (const listener of appState) listener("active");
  });

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate", "clearImmediate", "queueMicrotask"] });
  appState = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appState.push(listener as (s: AppStateStatus) => void);
    return { remove: () => void (appState = appState.filter((l) => l !== listener)) } as never;
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("Bayar's automatic asks", () => {
  it("skip a tick while the last ask is still out", async () => {
    let answer = () => {};
    const { runtime, command } = setup("awaiting_payment", () => new Promise<unknown>((r) => (answer = () => r({}))));
    await mount(runtime);
    await screen.findByRole("button", { name: "Sudah bayar? Cek status" });
    await pass(30_000);
    expect(command).toHaveBeenCalledTimes(1);
    await act(async () => answer());
    await pass(10_000);
    expect(command).toHaveBeenCalledTimes(2);
  });

  it("back off from 10 s to 30 s to 60 s while the payment is being checked", async () => {
    const { runtime, command } = setup("checking");
    await mount(runtime);
    await screen.findByRole("button", { name: "Cek status" });
    await pass(10_000);
    expect(command).toHaveBeenCalledTimes(1);
    await pass(20_000);
    expect(command).toHaveBeenCalledTimes(1);
    await pass(10_000); // 40 s: 10 + 30
    expect(command).toHaveBeenCalledTimes(2);
    await pass(50_000);
    expect(command).toHaveBeenCalledTimes(2);
    await pass(10_000); // 100 s: 10 + 30 + 60
    expect(command).toHaveBeenCalledTimes(3);
    await pass(60_000);
    expect(command).toHaveBeenCalledTimes(4);
  });

  it("stop after about 15 minutes, and Cek status still asks", async () => {
    const { runtime, command } = setup("checking");
    await mount(runtime);
    await pass(15 * 60_000);
    const asked = command.mock.calls.length;
    expect(asked).toBeGreaterThan(3);
    await pass(10 * 60_000);
    expect(command).toHaveBeenCalledTimes(asked);
    await fireEvent.press(screen.getByRole("button", { name: "Cek status" }));
    await pass(10_000);
    expect(command).toHaveBeenCalledTimes(asked + 1);
  });

  it("start over on returning to the app after the ceiling, one ask at once and the backoff from the top", async () => {
    const { runtime, command } = setup("checking");
    await mount(runtime);
    await pass(25 * 60_000);
    const asked = command.mock.calls.length;
    await pass(10 * 60_000);
    expect(command).toHaveBeenCalledTimes(asked);

    await returnToApp();
    expect(command).toHaveBeenCalledTimes(asked + 1);
    await pass(10_000);
    expect(command).toHaveBeenCalledTimes(asked + 2);
    await pass(20_000);
    expect(command).toHaveBeenCalledTimes(asked + 2);
    await pass(10_000); // 10 + 30
    expect(command).toHaveBeenCalledTimes(asked + 3);
    // A new budget, so it runs out again at the ceiling.
    await pass(15 * 60_000);
    const again = command.mock.calls.length;
    expect(again).toBeGreaterThan(asked + 3);
    await pass(10 * 60_000);
    expect(command).toHaveBeenCalledTimes(again);
  });

  it("do not double up: the wait restarts, and an ask still out is not sent again", async () => {
    let answer = () => {};
    const { runtime, command } = setup("awaiting_payment", () => new Promise<unknown>((r) => (answer = () => r({}))));
    await mount(runtime);
    await screen.findByRole("button", { name: "Sudah bayar? Cek status" });
    await pass(10_000);
    expect(command).toHaveBeenCalledTimes(1);
    await returnToApp();
    expect(command).toHaveBeenCalledTimes(1);
    await act(async () => answer());
    await pass(10_000);
    expect(command).toHaveBeenCalledTimes(2);
    await act(async () => answer());
    await returnToApp();
    await returnToApp();
    expect(command).toHaveBeenCalledTimes(3);
  });

  it("stop when the screen goes", async () => {
    const { runtime, command } = setup("awaiting_payment");
    const view = await mount(runtime);
    await screen.findByRole("button", { name: "Sudah bayar? Cek status" });
    await view.unmount();
    await pass(60_000);
    expect(command).not.toHaveBeenCalled();
  });
});
