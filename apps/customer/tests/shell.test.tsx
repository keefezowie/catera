import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

/** A fake Supabase client that behaves like supabase-js 2.116 where it matters here:
 * one channel per topic, and no postgres_changes callbacks after subscribe(). */
type FakeChannel = { topic: string; on: () => FakeChannel; subscribe: () => FakeChannel };
const mockClient = (() => {
  const channels = new Map<string, FakeChannel>();
  const listeners = new Set<(event: string, session: unknown) => void>();
  const client = {
    subscriptions: [] as string[],
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      signOut: jest.fn(async () => {
        listeners.forEach((cb) => cb("SIGNED_OUT", null));
        return { error: null };
      }),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
      signInWithPassword: jest.fn(),
    },
    rpc: jest.fn(),
    channel(topic: string) {
      const existing = channels.get(topic);
      if (existing) return existing;
      let subscribed = false;
      const ch: FakeChannel = {
        topic,
        on() {
          if (subscribed)
            throw new Error(`cannot add \`postgres_changes\` callbacks for realtime:${topic} after \`subscribe()\`.`);
          return ch;
        },
        subscribe() {
          subscribed = true;
          client.subscriptions.push(topic);
          return ch;
        },
      };
      channels.set(topic, ch);
      return ch;
    },
    removeChannel: jest.fn(async (ch: FakeChannel) => void channels.delete(ch.topic)),
    reset() {
      channels.clear();
      client.subscriptions = [];
    },
  };
  return client;
})();

const mockResponseListeners: ((r: unknown) => void)[] = [];
jest.mock("react-native-url-polyfill/auto", () => ({}));
jest.mock("@supabase/supabase-js", () => ({ createClient: () => mockClient }));
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
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn((cb: (r: unknown) => void) => {
    mockResponseListeners.push(cb);
    return { remove: () => mockResponseListeners.splice(mockResponseListeners.indexOf(cb), 1) };
  }),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[synthetic]" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "synthetic-project" } } } },
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, []),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://auth.example.test";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";

const { router } = require("expo-router") as typeof import("expo-router");
const { useMobile } = require("@catera/mobile-core") as typeof import("@catera/mobile-core");
const { runtime } = require("../src/runtime") as typeof import("../src/runtime");
const { AppProviders } = require("../src/shell") as typeof import("../src/shell");

const actor = { id: "u-1", role: "customer", name: "Rani Contoh" };
let mockActor: typeof actor | null = null;
let mobile: ReturnType<typeof useMobile>;

function Probe() {
  mobile = useMobile();
  return <Text>{`m:${mobile.ready ? (mobile.actor?.id ?? "-") : "?"}`}</Text>;
}

const renderShell = () =>
  render(
    <AppProviders runtime={runtime}>
      <Probe />
    </AppProviders>,
  );

const tap = (id: string, href: string) => ({
  actionIdentifier: "default",
  notification: { request: { identifier: id, content: { data: { href } } } },
});
const tapAll = (r: unknown) => act(() => [...mockResponseListeners].forEach((cb) => cb(r)));

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.reset();
  mockResponseListeners.length = 0;
  mockActor = null;
  Object.assign(runtime.api, {
    me: jest.fn(async () => ({ actor: mockActor, demo: false })),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    savedPackages: jest.fn(async () => ({ packageIds: [], items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
  });
});

it("a signed-in start opens one realtime subscription per topic", async () => {
  mockActor = actor;
  renderShell();
  expect(await screen.findByText("m:u-1")).toBeTruthy();
  await waitFor(() => expect(mockClient.subscriptions).toEqual(["catera:u-1"]));
});

it("a sign-in reaches the shell and subscribes once", async () => {
  renderShell();
  expect(await screen.findByText("m:-")).toBeTruthy();
  mockActor = actor;
  await act(async () => {
    await mobile.signedIn(actor as never);
  });
  expect(await screen.findByText("m:u-1")).toBeTruthy();
  expect(mockClient.subscriptions).toEqual(["catera:u-1"]);
});

it("logout signs the shell out", async () => {
  mockActor = actor;
  renderShell();
  expect(await screen.findByText("m:u-1")).toBeTruthy();
  mockActor = null;
  await act(async () => {
    await mobile.logout();
  });
  expect(await screen.findByText("m:-")).toBeTruthy();
  expect(mockClient.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});

it("an expired session that signs out during startup ends in the guest state", async () => {
  let release!: () => void;
  (runtime.api.me as jest.Mock).mockImplementationOnce(
    () => new Promise((resolve) => (release = () => resolve({ actor: null, demo: false }))),
  );
  renderShell();
  expect(screen.getByText("m:?")).toBeTruthy();
  await act(async () => {
    await mockClient.auth.signOut();
  });
  expect(await screen.findByText("m:-")).toBeTruthy();
  await act(async () => release());
});

// Ported from the old startup test: a start that cannot reach Catera offers a retry instead of
// silently opening as a guest; a plain signed-out start still opens the app.
it.each(["REQUEST_TIMEOUT", "INVALID_API_RESPONSE"])(
  "a start that fails with %s shows Belum bisa terhubung and Coba lagi recovers",
  async (code) => {
    (runtime.api.me as jest.Mock).mockRejectedValueOnce(Object.assign(new Error(code), { code }));
    renderShell();
    expect(await screen.findByText("Belum bisa terhubung.")).toBeTruthy();
    expect(screen.queryByText(/^m:/)).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    });
    expect(await screen.findByText("m:-")).toBeTruthy();
    expect(screen.queryByText("Belum bisa terhubung.")).toBeNull();
  },
);

it("an expired session (UNAUTHORIZED) opens as a guest without the retry screen", async () => {
  (runtime.api.me as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("UNAUTHORIZED"), { code: "UNAUTHORIZED" }));
  renderShell();
  expect(await screen.findByText("m:-")).toBeTruthy();
  expect(screen.queryByText("Belum bisa terhubung.")).toBeNull();
});

it("a later failed refresh never replaces a started app with the retry screen", async () => {
  renderShell();
  expect(await screen.findByText("m:-")).toBeTruthy();
  (runtime.api.me as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }));
  await act(async () => {
    await mobile.refresh();
  });
  expect(screen.getByText("m:-")).toBeTruthy();
  expect(screen.queryByText("Belum bisa terhubung.")).toBeNull();
});

it("one push tap navigates once, through the customer link mapper", async () => {
  renderShell();
  expect(await screen.findByText("m:-")).toBeTruthy();
  // Only MobileProvider listens now: a tap must not open the screen twice.
  expect(mockResponseListeners).toHaveLength(1);
  tapAll(tap("n-1", "/deliveries/d-1"));
  tapAll(tap("n-1", "/deliveries/d-1"));
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith("/hari/d-1");
  tapAll(tap("n-2", "/payment/ck-1"));
  expect(router.push).toHaveBeenLastCalledWith("/bayar/ck-1");
  tapAll(tap("n-3", "/subscriptions/s-1/menu?date=2026-11-02&meal=lunch"));
  expect(router.push).toHaveBeenLastCalledWith("/pilih-menu/s-1?date=2026-11-02&meal=lunch");
  expect(router.push).toHaveBeenCalledTimes(3);
});

it("registers this phone for push through the shell (device.register)", async () => {
  mockActor = actor;
  renderShell();
  expect(await screen.findByText("m:u-1")).toBeTruthy();
  await act(async () => {
    await mobile.enablePush("Pengantaran & bantuan");
  });
  expect(runtime.api.command).toHaveBeenCalledWith(
    "device.register",
    { token: "ExponentPushToken[synthetic]" },
    expect.any(String),
  );
});

describe("runtime.signInPassword", () => {
  const signIn = () => {
    mockClient.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { id: "u-1", user_metadata: {} } },
      error: null,
    });
    mockClient.rpc.mockImplementation(async (fn: string) =>
      fn === "catera_v1_command" ? { data: { id: "u-1" }, error: null } : { data: actor, error: null },
    );
  };

  it("names a new customer with the name the app passes", async () => {
    signIn();
    await runtime.signInPassword("rani@example.test", "synthetic-password", "req-1", "Pelanggan");
    expect(mockClient.rpc).toHaveBeenCalledWith("catera_v1_command", {
      action: "profile.ensure",
      payload: { name: "Pelanggan" },
      request_id: "req-1",
    });
  });

  it("keeps Katerer as the default for Catera Dapur", async () => {
    signIn();
    await runtime.signInPassword("dapur@example.test", "synthetic-password", "req-2");
    expect(mockClient.rpc).toHaveBeenCalledWith("catera_v1_command", {
      action: "profile.ensure",
      payload: { name: "Katerer" },
      request_id: "req-2",
    });
  });

  // Ported from the old auth.test (signInNative): the same rules now live in runtime.signInPassword.
  it.each([
    [401, "INVALID_CREDENTIALS"],
    [429, "AUTH_RATE_LIMITED"],
  ])("a failed sign-in (HTTP %s) provisions no profile", async (status, code) => {
    mockClient.auth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { status } });
    await expect(runtime.signInPassword("rani@example.test", "wrong", "req-3", "Pelanggan")).rejects.toThrow(code);
    expect(mockClient.rpc).not.toHaveBeenCalled();
  });

  it("failed profile setup removes the partly created local session", async () => {
    signIn();
    mockClient.rpc.mockResolvedValue({ data: null, error: new Error("FORBIDDEN") });
    await expect(runtime.signInPassword("rani@example.test", "synthetic-password", "req-4", "Pelanggan")).rejects.toThrow(
      "FORBIDDEN",
    );
    expect(mockClient.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
