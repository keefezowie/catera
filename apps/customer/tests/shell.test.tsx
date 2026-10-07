import { act, render, screen, waitFor } from "@testing-library/react-native";
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
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, []),
}));
jest.mock("@react-native-community/datetimepicker", () => ({ __esModule: true, default: () => null }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://auth.example.test";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";

const { router } = require("expo-router") as typeof import("expo-router");
const { useMobile } = require("@catera/mobile-core") as typeof import("@catera/mobile-core");
const { runtime } = require("../src/runtime") as typeof import("../src/runtime");
const { useNative } = require("../src/context") as typeof import("../src/context");
const { AppProviders } = require("../src/shell") as typeof import("../src/shell");

const actor = { id: "u-1", role: "customer", name: "Rani Contoh" };
let mockActor: typeof actor | null = null;
let mobile: ReturnType<typeof useMobile>;
let legacy: ReturnType<typeof useNative>;

function Probe() {
  mobile = useMobile();
  legacy = useNative();
  const id = (v: { ready: boolean; actor: { id: string } | null }) => (v.ready ? (v.actor?.id ?? "-") : "?");
  return <Text>{`m:${id(mobile)} l:${id(legacy)}`}</Text>;
}

const renderShell = () =>
  render(
    <AppProviders runtime={runtime}>
      <Probe />
    </AppProviders>,
  );

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
  expect(await screen.findByText("m:u-1 l:u-1")).toBeTruthy();
  await waitFor(() => expect(mockClient.subscriptions).toEqual(["catera:u-1"]));
});

it("a sign-in on the shell side reaches the old screens", async () => {
  renderShell();
  expect(await screen.findByText("m:- l:-")).toBeTruthy();
  mockActor = actor;
  await act(async () => {
    await mobile.signedIn(actor as never);
  });
  expect(await screen.findByText("m:u-1 l:u-1")).toBeTruthy();
  expect(mockClient.subscriptions).toEqual(["catera:u-1"]);
});

it("an old-screen logout signs the shell out too", async () => {
  mockActor = actor;
  renderShell();
  expect(await screen.findByText("m:u-1 l:u-1")).toBeTruthy();
  mockActor = null;
  await act(async () => {
    await legacy.logout();
  });
  expect(await screen.findByText("m:- l:-")).toBeTruthy();
});

it("shell activity refreshes the old screens' data", async () => {
  mockActor = actor;
  renderShell();
  expect(await screen.findByText("m:u-1 l:u-1")).toBeTruthy();
  const before = legacy.revision;
  await act(async () => {
    await mobile.command("delivery.react", { deliveryId: "d-1", meal: "lunch", reaction: "enak" });
  });
  await waitFor(() => expect(legacy.revision).toBeGreaterThan(before));
});

it("one push tap navigates once", async () => {
  renderShell();
  expect(await screen.findByText("m:- l:-")).toBeTruthy();
  const tap = {
    actionIdentifier: "default",
    notification: { request: { identifier: "n-1", content: { data: { href: "/deliveries/d-1" } } } },
  };
  act(() => [...mockResponseListeners].forEach((cb) => cb(tap)));
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith("/hari/d-1");
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
});
