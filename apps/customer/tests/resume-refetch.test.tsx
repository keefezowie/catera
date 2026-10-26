import { act, render, screen, waitFor } from "@testing-library/react-native";
import { AppState, Text, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { createMobileRuntime, MobileProvider, RESUME_THROTTLE, useData, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { customerLink } from "../src/links";

/**
 * Stale-while-revalidate (spec 2026-10-26, section A): a return from the background or a network that comes back moves
 * `resumed` at most once per 30s, and a screen that already shows data reloads it quietly, without `loading`.
 */

const net = NetInfo as unknown as { __emit: (s: { isConnected: boolean; isInternetReachable: boolean }) => void };
const actor = { id: "c-1", role: "customer", name: "Rani" };
let appState: ((s: AppStateStatus) => void)[] = [];
let now = 1_000_000;

function runtime() {
  const r = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  (r as { supabase: unknown }).supabase = {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      startAutoRefresh: () => undefined,
      stopAutoRefresh: () => undefined,
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: async () => undefined,
  };
  r.api = { ...r.api, me: jest.fn(async () => ({ actor, demo: false })) } as unknown as MobileRuntime["api"];
  return r;
}

type Seen = { resumed: number; data: string | null; loading: boolean; error: string };
const seen: Seen[] = [];
let reloadNow: () => Promise<void> = async () => undefined;
function Probe({ loader, dataKey = "k" }: { loader: () => Promise<string>; dataKey?: string }) {
  const { resumed } = useMobile();
  const { data, loading, error, reload } = useData(dataKey, loader);
  reloadNow = reload;
  seen.push({ resumed, data, loading, error });
  return <Text testID="probe">{`${resumed}|${data}|${loading}|${error}`}</Text>;
}
const last = () => seen[seen.length - 1];

const tree = (r: MobileRuntime, loader: () => Promise<string>, dataKey?: string) => (
  <MobileProvider runtime={r} linkMapper={customerLink}>
    <Probe loader={loader} dataKey={dataKey} />
  </MobileProvider>
);
let rt: MobileRuntime;
function mount(loader: () => Promise<string>) {
  rt = runtime();
  return render(tree(rt, loader));
}
const resume = () => act(async () => appState.forEach((l) => (l("background"), l("active"))));

beforeEach(() => {
  seen.length = 0;
  appState = [];
  now = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  jest.spyOn(AppState, "addEventListener").mockImplementation((_t, l) => {
    appState.push(l as (s: AppStateStatus) => void);
    return { remove: () => (appState = appState.filter((x) => x !== l)) } as never;
  });
});
afterEach(() => jest.restoreAllMocks());

/** Mounted, the launch me() answered (it moves the revision once) and every read settled. */
async function ready(loader: jest.Mock) {
  mount(loader);
  await waitFor(() => expect(rt.api.me).toHaveBeenCalled());
  await waitFor(() => expect(last()).toMatchObject({ data: "first", loading: false }));
  await act(async () => undefined);
  return seen.length;
}

describe("resumed", () => {
  it("moves once on a return from the background, not on the launch 'active'", async () => {
    await ready(jest.fn(async () => "first"));
    await act(async () => appState.forEach((l) => l("active")));
    expect(last().resumed).toBe(0);
    await resume();
    expect(last().resumed).toBe(1);
  });

  it("moves once when the network comes back, not on online to online", async () => {
    await ready(jest.fn(async () => "first"));
    await act(async () => net.__emit({ isConnected: true, isInternetReachable: true }));
    expect(last().resumed).toBe(0);
    await act(async () => net.__emit({ isConnected: false, isInternetReachable: false }));
    await act(async () => net.__emit({ isConnected: true, isInternetReachable: true }));
    expect(last().resumed).toBe(1);
  });

  it("moves at most once per 30s", async () => {
    await ready(jest.fn(async () => "first"));
    await resume();
    now += RESUME_THROTTLE - 1;
    await resume();
    expect(last().resumed).toBe(1);
    now += 1;
    await resume();
    expect(last().resumed).toBe(2);
  });
});

describe("useData on resume", () => {
  it("reloads quietly: loading stays false and the new data replaces the old", async () => {
    let answer = "first";
    const loader = jest.fn(async () => answer);
    const from = await ready(loader);
    const calls = loader.mock.calls.length;
    answer = "second";
    await resume();
    await waitFor(() => expect(last().data).toBe("second"));
    expect(loader).toHaveBeenCalledTimes(calls + 1);
    expect(seen.slice(from).every((s) => !s.loading)).toBe(true);
  });

  it("a failed quiet reload leaves the data and adds no error", async () => {
    let fail = false;
    const loader = jest.fn(async () => {
      if (fail) throw new Error("NETWORK");
      return "first";
    });
    await ready(loader);
    const calls = loader.mock.calls.length;
    fail = true;
    await resume();
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(calls + 1));
    await act(async () => undefined);
    expect(last()).toMatchObject({ data: "first", error: "", loading: false });
  });

  it("a quiet reload overtaken by a newer reload is dropped", async () => {
    let release: (v: string) => void = () => undefined;
    const loader = jest.fn(async () => "first");
    await ready(loader);
    loader.mockImplementationOnce(() => new Promise<string>((r) => (release = r)));
    await resume();
    // A newer reload (a pull, or a command bumping the revision) answers before the quiet one.
    loader.mockImplementationOnce(async () => "newer");
    await act(async () => reloadNow());
    expect(last().data).toBe("newer");
    await act(async () => release("stale"));
    expect(last().data).toBe("newer");
  });

  it("a quiet reload that answers after the screen moved to another key is dropped", async () => {
    let release: (v: string) => void = () => undefined;
    const loader = jest.fn(async () => "first");
    const view = await ready(loader).then(() => screen);
    loader.mockImplementationOnce(() => new Promise<string>((r) => (release = r)));
    await resume();
    const other = jest.fn(() => new Promise<string>(() => undefined));
    view.rerender(tree(rt, other, "other"));
    await act(async () => release("stale"));
    expect(last().data).toBeNull();
  });

  it("does nothing while the screen has no data yet", async () => {
    const loader = jest.fn(() => new Promise<string>(() => undefined));
    mount(loader);
    await waitFor(() => expect(rt.api.me).toHaveBeenCalled());
    await act(async () => undefined);
    const calls = loader.mock.calls.length;
    await resume();
    expect(loader).toHaveBeenCalledTimes(calls);
  });
});

describe("an error screen on resume", () => {
  it("a screen that failed with nothing to show reads again when the app returns", async () => {
    let fail = true;
    const loader = jest.fn(async () => {
      if (fail) throw new Error("NETWORK");
      return "back";
    });
    mount(loader);
    await waitFor(() => expect(rt.api.me).toHaveBeenCalled());
    await waitFor(() => expect(last()).toMatchObject({ data: null, loading: false }));
    expect(last().error).not.toBe("");
    fail = false;
    await resume();
    await waitFor(() => expect(last()).toMatchObject({ data: "back", error: "" }));
  });
});

describe("a return while offline", () => {
  it("leaves the 30s slot to the network coming back", async () => {
    await ready(jest.fn(async () => "first"));
    await act(async () => net.__emit({ isConnected: false, isInternetReachable: false }));
    await resume();
    expect(last().resumed).toBe(0);
    now += 3_000;
    await act(async () => net.__emit({ isConnected: true, isInternetReachable: true }));
    expect(last().resumed).toBe(1);
  });
});
