import { act, render, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, useTrack, type MobileRuntime } from "@catera/mobile-core";
import type { UsageName } from "@catera/domain";
import { customerLink } from "../src/links";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
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

// 10.00 in Jakarta on 8 October 2026. Only the clock is pinned: timers and microtasks keep running.
const pinClock = (iso: string) =>
  jest.useFakeTimers({
    now: new Date(iso),
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });
const MORNING = "2026-10-08T03:00:00Z";
const AFTER_MIDNIGHT_JAKARTA = "2026-10-08T17:30:00Z";
const LATER_SAME_DAY = "2026-10-08T16:30:00Z";

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
type UsageMock = jest.Mock<Promise<void>, [UsageName, "customer" | "dapur"]>;

function runtimeWith(actor: Record<string, unknown> | null, usage: UsageMock) {
  const runtime = createMobileRuntime({
    apiUrl: "https://api.example.test",
    storagePrefix: "catera",
    app: "customer",
  });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    usage,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

let track: (name: UsageName) => void = () => undefined;
function Probe() {
  track = useTrack();
  return null;
}
const mount = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <Probe />
    </MobileProvider>,
  );

let changeHandlers: ((state: string) => void)[] = [];
const appOpenCalls = (usage: UsageMock) => usage.mock.calls.filter(([name]) => name === "app_open");
const becomeActive = async () => {
  await act(async () => {
    changeHandlers.forEach((h) => h("active"));
  });
};
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 20))));

beforeEach(() => {
  pinClock(MORNING);
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  changeHandlers = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, handler: (s: string) => void) => {
    changeHandlers.push(handler);
    return { remove: () => void (changeHandlers = changeHandlers.filter((h) => h !== handler)) };
  }) as never);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("usage counts", () => {
  it("useTrack sends the name with this app", async () => {
    const usage: UsageMock = jest.fn(async () => undefined);
    const runtime = runtimeWith(customer, usage);
    mount(runtime);
    await waitFor(() => expect(runtime.api.me).toHaveBeenCalled());
    await waitFor(() => expect(appOpenCalls(usage)).toHaveLength(1));
    act(() => track("journey_viewed"));
    expect(usage).toHaveBeenCalledWith("journey_viewed", "customer");
  });

  it("a rejected request raises nothing and logs nothing", async () => {
    const usage: UsageMock = jest.fn(async () => {
      throw new Error("REQUEST_TIMEOUT");
    });
    const runtime = runtimeWith(customer, usage);
    const logged = [
      jest.spyOn(console, "error").mockImplementation(() => undefined),
      jest.spyOn(console, "warn").mockImplementation(() => undefined),
      jest.spyOn(console, "log").mockImplementation(() => undefined),
    ];
    mount(runtime);
    await waitFor(() => expect(appOpenCalls(usage)).toHaveLength(1));
    let result: unknown = "unset";
    expect(() => act(() => void (result = track("plan_sheet_opened")))).not.toThrow();
    expect(result).toBeUndefined();
    await settle();
    expect(usage).toHaveBeenCalledWith("plan_sheet_opened", "customer");
    // No retry loop: one call per event.
    expect(usage).toHaveBeenCalledTimes(2);
    for (const spy of logged) expect(spy).not.toHaveBeenCalled();
  });

  it("a request that throws before it is sent is swallowed too", async () => {
    const usage: UsageMock = jest.fn(() => {
      throw new Error("synchronous failure");
    });
    const runtime = runtimeWith(customer, usage);
    mount(runtime);
    await waitFor(() => expect(usage).toHaveBeenCalled());
    expect(() => act(() => track("journey_viewed"))).not.toThrow();
  });

  it("does nothing without an actor", async () => {
    const usage: UsageMock = jest.fn(async () => undefined);
    const runtime = runtimeWith(null, usage);
    mount(runtime);
    await waitFor(() => expect(runtime.api.me).toHaveBeenCalled());
    await settle();
    act(() => track("journey_viewed"));
    await becomeActive();
    await settle();
    expect(usage).not.toHaveBeenCalled();
  });

  it("app_open is sent once on mount, not on a later foreground the same Jakarta day", async () => {
    const usage: UsageMock = jest.fn(async () => undefined);
    const runtime = runtimeWith(customer, usage);
    mount(runtime);
    await waitFor(() => expect(appOpenCalls(usage)).toHaveLength(1));
    expect(appOpenCalls(usage)[0]).toEqual(["app_open", "customer"]);
    await waitFor(() =>
      expect(SecureStore.getItemAsync("catera.usage.app_open")).resolves.toBe("2026-10-08"),
    );
    // Two foreground events in the same tick still make one count.
    jest.setSystemTime(new Date(LATER_SAME_DAY));
    await becomeActive();
    await becomeActive();
    await settle();
    expect(appOpenCalls(usage)).toHaveLength(1);
  });

  it("app_open counts again once the clock passes midnight in Jakarta", async () => {
    const usage: UsageMock = jest.fn(async () => undefined);
    const runtime = runtimeWith(customer, usage);
    mount(runtime);
    await waitFor(() => expect(appOpenCalls(usage)).toHaveLength(1));
    jest.setSystemTime(new Date(AFTER_MIDNIGHT_JAKARTA));
    // Two foreground events at once, before the store has answered, still make one count.
    await act(async () => {
      changeHandlers.forEach((h) => h("active"));
      changeHandlers.forEach((h) => h("active"));
    });
    await waitFor(() => expect(appOpenCalls(usage)).toHaveLength(2));
    await waitFor(() =>
      expect(SecureStore.getItemAsync("catera.usage.app_open")).resolves.toBe("2026-10-09"),
    );
    await becomeActive();
    await settle();
    expect(appOpenCalls(usage)).toHaveLength(2);
  });

  it("a fresh process on the same day does not count a second open", async () => {
    const usage: UsageMock = jest.fn(async () => undefined);
    await SecureStore.setItemAsync("catera.usage.app_open", "2026-10-08");
    const runtime = runtimeWith(customer, usage);
    mount(runtime);
    await waitFor(() => expect(runtime.api.me).toHaveBeenCalled());
    await settle();
    expect(appOpenCalls(usage)).toHaveLength(0);
  });
});
