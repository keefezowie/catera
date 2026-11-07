import { useEffect, useState, type ReactNode } from "react";
import { Text } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { ApiError } from "@catera/api-client";
import {
  createMobileRuntime,
  exchangeEmailLink,
  MobileProvider,
  useData,
  useMobile,
  type MobileContextValue,
  type MobileRuntime,
  type Pending,
} from "@catera/mobile-core";
import * as Notifications from "expo-notifications";
import { unregisterThisPhone } from "../../../packages/mobile-core/src/notifications";
import { secureStorage } from "../../../packages/mobile-core/src/runtime";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, useFocusEffect: jest.fn() }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[synthetic-phone]" })),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "synthetic-project" } } } },
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

const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;
const rani = { id: "u-rani", role: "customer", name: "Rani Contoh" };
const budi = { id: "u-budi", role: "customer", name: "Budi Contoh" };
const SESSION = "sb-s-auth-token";
const VERIFIER = `${SESSION}-code-verifier`;

/** A runtime on the real Supabase auth client; only `fetch` and the phone's store are stand-ins. */
const opened: MobileRuntime[] = [];
const real = () => {
  const runtime = createMobileRuntime({
    apiUrl: "https://api.example.test",
    supabaseUrl: "https://s.example.test",
    supabaseKey: "synthetic",
    storagePrefix: "catera",
    app: "customer",
  });
  opened.push(runtime);
  return runtime;
};
const seedSession = (expiresInSeconds: number) =>
  store().set(
    SESSION,
    JSON.stringify({
      access_token: "synthetic-access",
      refresh_token: "synthetic-refresh",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
      user: { id: rani.id },
    }),
  );
const answer = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  headers: new Map([["content-type", "application/json"]]),
  json: async () => body,
});
const offline = () => Promise.reject(new TypeError("Network request failed"));
const fetchBefore = global.fetch;
const fetched = () => global.fetch as unknown as jest.Mock;

/** A runtime with a stand-in API: `me` answers `actor`, commands succeed, and nothing is stored as a session. */
function stub(actor: unknown = rani, api: Record<string, unknown> = {}): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    command: jest.fn(async () => ({})),
    ...api,
  } as MobileRuntime["api"];
  return runtime;
}

let session: MobileContextValue;
function Grab({ children }: { children?: ReactNode }) {
  session = useMobile();
  return <Text testID="actor">{session.ready ? (session.actor?.id ?? "none") : "loading"}</Text>;
}
const mount = (runtime: MobileRuntime, children?: ReactNode) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <Grab />
      {children}
    </MobileProvider>,
  );
const signedIn = async (id = rani.id) => waitFor(() => expect(screen.getByTestId("actor").props.children).toBe(id));

beforeEach(() => {
  store().clear();
  jest.clearAllMocks();
  global.fetch = jest.fn(offline) as never;
});
afterEach(async () => {
  for (const runtime of opened.splice(0)) await runtime.supabase?.auth.stopAutoRefresh();
});
afterAll(() => {
  global.fetch = fetchBefore;
});

describe("A: a session that could not refresh", () => {
  it("is a retryable failure, not an anonymous request", async () => {
    seedSession(-60);
    const runtime = real();
    jest.spyOn(runtime.supabase!.auth, "getSession").mockResolvedValue({
      data: { session: null },
      error: Object.assign(new Error("fetch failed"), { name: "AuthRetryableFetchError" }),
    } as never);
    await expect(runtime.token()).rejects.toThrow("OFFLINE");
    await expect(runtime.api.me()).rejects.toThrow("OFFLINE");
    expect(fetched()).not.toHaveBeenCalledWith(expect.stringContaining("/api/v1/me"), expect.anything());
  });

  it("is anonymous once the server rejected the refresh token, because auth-js removed the session", async () => {
    seedSession(-60);
    fetched().mockImplementation(async () => answer(400, { error_code: "refresh_token_not_found", msg: "gone" }));
    await expect(real().token()).resolves.toBeNull();
    expect(store().has(SESSION)).toBe(false);
  });

  it("keeps the stored account when me() fails that way", async () => {
    seedSession(-60);
    store().set("catera.actor", JSON.stringify(rani));
    const runtime = real();
    jest.spyOn(runtime.supabase!.auth, "getSession").mockResolvedValue({
      data: { session: null },
      error: new Error("fetch failed"),
    } as never);
    await mount(runtime);
    await signedIn();
    expect(store().get("catera.actor")).toContain(rani.id);
    expect(session.error).not.toBe("");
  });
});

describe("B: an offline cold start", () => {
  it("paints the kept account without waiting for a token refresh", async () => {
    seedSession(-7200);
    store().set("catera.actor", JSON.stringify(rani));
    const runtime = real();
    // A refresh that never answers, as with no signal: reading the token would hold the paint back for it.
    jest.spyOn(runtime.supabase!.auth, "getSession").mockReturnValue(new Promise(() => undefined));
    runtime.api = { ...runtime.api, me: jest.fn(() => new Promise(() => undefined)) } as never;
    await mount(runtime);
    await signedIn();
  });

  it("does not reopen an account when no session is stored", async () => {
    store().set("catera.actor", JSON.stringify(rani));
    await mount(real());
    await signedIn("none");
  });

  it("hasSession is a local read of the demo token or the session item", async () => {
    const runtime = real();
    expect(await runtime.hasSession()).toBe(false);
    seedSession(-7200);
    expect(await runtime.hasSession()).toBe(true);
    expect(fetched()).not.toHaveBeenCalled();
    store().clear();
    store().set("catera.demo.token", "demo");
    expect(await runtime.hasSession()).toBe(true);
  });
});

describe("C: the PKCE verifier survives a failed exchange", () => {
  const pending: Pending = { purpose: "signup", next: "/", at: Date.now(), email: "rani@example.test" };
  const link = { code: "synthetic-code", linkError: "" };
  const good = {
    access_token: "a",
    refresh_token: "r",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: rani.id, user_metadata: {} },
  };

  it("after an offline tap the same link works on the retry", async () => {
    const runtime = real();
    store().set(VERIFIER, JSON.stringify("synthetic-verifier"));
    await expect(exchangeEmailLink(runtime, pending, link)).rejects.toThrow("OFFLINE");
    expect(store().get(VERIFIER)).toBe(JSON.stringify("synthetic-verifier"));

    fetched().mockImplementation(async () => answer(200, good));
    await expect(exchangeEmailLink(runtime, pending, link)).resolves.toMatchObject({ userId: rani.id });
    const body = JSON.parse(fetched().mock.calls[fetched().mock.calls.length - 1][1].body);
    expect(body.code_verifier).toBe("synthetic-verifier");
    expect(store().has(VERIFIER)).toBe(false);
  });

  it("a crafted link does not end the pending sign-up", async () => {
    store().set(VERIFIER, JSON.stringify("synthetic-verifier"));
    fetched().mockImplementation(async () => answer(403, { error_code: "bad_code_verifier", msg: "no" }));
    await expect(exchangeEmailLink(real(), pending, { code: "x", linkError: "" })).rejects.toThrow("RECOVERY_EXPIRED");
    expect(store().get(VERIFIER)).toBe(JSON.stringify("synthetic-verifier"));
  });
});

describe("D: this phone's token after another account", () => {
  const OWNER = "catera.push.owner";
  const token = { token: "ExponentPushToken[synthetic-phone]" };
  const sent = (runtime: MobileRuntime) =>
    (runtime.api.command as jest.Mock).mock.calls.map(([action, payload]) => [action, payload]);

  it("the next account takes the token and lets go, and the old switch stops reading on", async () => {
    store().set(OWNER, rani.id);
    store().set(`catera.push.${rani.id}`, "on");
    const runtime = stub(budi);
    await mount(runtime);
    await waitFor(() => expect(store().has(OWNER)).toBe(false));
    expect(sent(runtime)).toEqual([
      ["device.register", token],
      ["device.unregister", token],
    ]);
    expect(store().has(`catera.push.${rani.id}`)).toBe(false);
  });

  it("an account whose switch is on keeps it", async () => {
    store().set(OWNER, rani.id);
    store().set(`catera.push.${budi.id}`, "on");
    const runtime = stub(budi);
    await mount(runtime);
    await waitFor(() => expect(store().get(OWNER)).toBe(budi.id));
    expect(sent(runtime)).toEqual([["device.register", token]]);
  });

  it("a failure keeps the mark for the next confirmation", async () => {
    store().set(OWNER, rani.id);
    const runtime = stub(budi, { command: jest.fn(async () => Promise.reject(new TypeError("offline"))) });
    await mount(runtime);
    await signedIn(budi.id);
    await waitFor(() => expect(runtime.api.command).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(store().get(OWNER)).toBe(rani.id);
  });

  it("the same account coming back changes nothing, and a phone from an older build gets its mark", async () => {
    store().set(OWNER, rani.id);
    const same = stub(rani);
    const first = await mount(same);
    await signedIn();
    expect(same.api.command).not.toHaveBeenCalled();
    await first.unmount();

    store().clear();
    store().set(`catera.push.${rani.id}`, "on");
    const older = stub(rani);
    await mount(older);
    await waitFor(() => expect(store().get(OWNER)).toBe(rani.id));
    expect(older.api.command).not.toHaveBeenCalled();
  });

  it("a logout that could not reach the server leaves the mark; one that did clears it", async () => {
    store().set(OWNER, rani.id);
    const down = stub(rani, { command: jest.fn(() => Promise.reject(new TypeError("offline"))) });
    down.signOut = jest.fn(async () => undefined);
    const first = await mount(down);
    await signedIn();
    await act(() => session.logout());
    expect(store().get(OWNER)).toBe(rani.id);
    await first.unmount();

    const up = stub(rani);
    up.signOut = jest.fn(async () => undefined);
    await mount(up);
    await signedIn();
    await act(() => session.logout());
    expect(store().has(OWNER)).toBe(false);
  });

  it("registering this phone marks who holds it", async () => {
    await mount(stub(rani));
    await signedIn();
    await act(() => session.enablePush("Pengantaran"));
    expect(store().get(OWNER)).toBe(rani.id);
  });

  it("the next account leaving keeps the mark of the account still holding the token", async () => {
    store().set(OWNER, rani.id);
    // Taking the token failed, so it is still on Rani; Budi's own unregister reaches the server and removes nothing.
    const command = jest.fn(async (action: string) => {
      if (action === "device.register") throw new TypeError("offline");
      return {};
    });
    const runtime = stub(budi, { command });
    runtime.signOut = jest.fn(async () => undefined);
    await mount(runtime);
    await signedIn(budi.id);
    await act(() => session.logout());
    expect(command).toHaveBeenCalledWith("device.unregister", token, expect.anything());
    expect(store().get(OWNER)).toBe(rani.id);
  });

  it("the switch turned off by another account keeps that mark too", async () => {
    store().set(OWNER, rani.id);
    await unregisterThisPhone(async () => ({}), `catera.push.${budi.id}`, OWNER, budi.id);
    expect(store().get(OWNER)).toBe(rani.id);
    await unregisterThisPhone(async () => ({}), `catera.push.${rani.id}`, OWNER, rani.id);
    expect(store().has(OWNER)).toBe(false);
  });

  describe("a phone from an older build, with no mark", () => {
    const RELEASED = "catera.push.unmarked-released";
    const allowed = () =>
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    afterEach(() =>
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "undetermined" }),
    );

    it("takes the token and lets go once, and never again", async () => {
      allowed();
      const first = stub(rani);
      const view = await mount(first);
      await waitFor(() => expect(store().has(RELEASED)).toBe(true));
      expect(sent(first)).toEqual([
        ["device.register", token],
        ["device.unregister", token],
      ]);
      expect(store().has(OWNER)).toBe(false);
      await view.unmount();

      const second = stub(budi);
      await mount(second);
      await signedIn(budi.id);
      await act(async () => {
        await Promise.resolve();
      });
      expect(second.api.command).not.toHaveBeenCalled();
    });

    it("skips it when the phone has not allowed notifications, and tries again once it does", async () => {
      const denied = stub(rani);
      const view = await mount(denied);
      await signedIn();
      await waitFor(() => expect(Notifications.getPermissionsAsync).toHaveBeenCalled());
      await act(async () => {
        await Promise.resolve();
      });
      expect(denied.api.command).not.toHaveBeenCalled();
      expect(store().has(RELEASED)).toBe(false);
      await view.unmount();

      allowed();
      await mount(stub(rani));
      await waitFor(() => expect(store().has(RELEASED)).toBe(true));
    });

    it("skips it when this account's own switch is on", async () => {
      allowed();
      store().set(`catera.push.${rani.id}`, "on");
      const runtime = stub(rani);
      await mount(runtime);
      await waitFor(() => expect(store().get(OWNER)).toBe(rani.id));
      expect(runtime.api.command).not.toHaveBeenCalled();
      expect(store().has(RELEASED)).toBe(false);
    });

    it("a failure does not count as done", async () => {
      allowed();
      const runtime = stub(rani, { command: jest.fn(async () => Promise.reject(new TypeError("offline"))) });
      await mount(runtime);
      await waitFor(() => expect(runtime.api.command).toHaveBeenCalled());
      await act(async () => {
        await Promise.resolve();
      });
      expect(store().has(RELEASED)).toBe(false);
    });
  });
});

describe("E: request ids", () => {
  const ids = (runtime: MobileRuntime) => (runtime.api.command as jest.Mock).mock.calls.map((c) => c[2] as string);
  const run = () => session.command("plan.pause", { id: "p1" }).then(() => "ok", () => "failed");
  afterEach(() => jest.restoreAllMocks());

  it("a timeout reuses the id on an immediate retry, so the server applies it once", async () => {
    const command = jest.fn().mockRejectedValueOnce(new ApiError("REQUEST_TIMEOUT")).mockResolvedValue({});
    const runtime = stub(rani, { command });
    await mount(runtime);
    await signedIn();
    await act(run);
    await act(run);
    expect(ids(runtime)[1]).toBe(ids(runtime)[0]);
  });

  it("a network failure and an unreadable answer reuse it too", async () => {
    const command = jest
      .fn()
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockRejectedValueOnce(new ApiError("INVALID_API_RESPONSE"))
      .mockResolvedValue({});
    const runtime = stub(rani, { command });
    await mount(runtime);
    await signedIn();
    await act(run);
    await act(run);
    await act(run);
    expect(new Set(ids(runtime)).size).toBe(1);
  });

  it("a kept id ends after two minutes, so a later intent never replays an old receipt", async () => {
    const command = jest.fn().mockRejectedValueOnce(new ApiError("REQUEST_TIMEOUT")).mockResolvedValue({});
    const runtime = stub(rani, { command });
    await mount(runtime);
    await signedIn();
    await act(run);
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now + 121_000);
    await act(run);
    expect(ids(runtime)[1]).not.toBe(ids(runtime)[0]);
  });

  it("a definitive refusal drops the id", async () => {
    const command = jest.fn().mockRejectedValueOnce(new ApiError("INVALID_INPUT")).mockResolvedValue({});
    const runtime = stub(rani, { command });
    await mount(runtime);
    await signedIn();
    await act(run);
    await act(run);
    expect(ids(runtime)[1]).not.toBe(ids(runtime)[0]);
  });

  it("success drops the id", async () => {
    const runtime = stub(rani);
    await mount(runtime);
    await signedIn();
    await act(run);
    await act(run);
    expect(ids(runtime)[1]).not.toBe(ids(runtime)[0]);
  });
});

describe("F and G: the stored session", () => {
  it("offline, Keluar succeeds and the session is gone", async () => {
    seedSession(3600);
    await expect(real().signOut()).resolves.toBeUndefined();
    expect(store().has(SESSION)).toBe(false);
  });

  it("a refresh failure that keeps the session still ends with it removed", async () => {
    seedSession(-60);
    const runtime = real();
    jest.spyOn(runtime.supabase!.auth, "signOut").mockResolvedValue({ error: new Error("fetch failed") } as never);
    await expect(runtime.signOut()).resolves.toBeUndefined();
    expect(store().has(SESSION)).toBe(false);
  });

  it("an expired session goes without trying to refresh it, so offline Keluar does not wait for the retries", async () => {
    const runtime = real();
    await runtime.supabase!.auth.initialize();
    seedSession(-60);
    await runtime.signOut();
    expect(store().has(SESSION)).toBe(false);
    expect(fetched()).not.toHaveBeenCalledWith(expect.stringContaining("grant_type=refresh_token"), expect.anything());
  });

  it("waits for auth-js at most 3 s", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "clearImmediate", "queueMicrotask"] });
    try {
      seedSession(3600);
      const runtime = real();
      jest.spyOn(runtime.supabase!.auth, "signOut").mockReturnValue(new Promise(() => undefined));
      let done = false;
      const leaving = runtime.signOut().then(() => (done = true));
      await jest.advanceTimersByTimeAsync(2000);
      expect(store().has(SESSION)).toBe(false);
      expect(done).toBe(false);
      await jest.advanceTimersByTimeAsync(3100);
      await leaving;
      expect(done).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("a revocation answering late leaves the next account's session alone", async () => {
    seedSession(3600);
    let answerLogout = (_: unknown) => {};
    fetched().mockImplementation((url: string) =>
      url.includes("/logout") ? new Promise((resolve) => (answerLogout = resolve)) : offline(),
    );
    const runtime = real();
    const events: string[] = [];
    runtime.supabase!.auth.onAuthStateChange((event) => void events.push(event));
    await runtime.signOut();
    expect(store().has(SESSION)).toBe(false);
    await waitFor(() => expect(fetched()).toHaveBeenCalledWith(expect.stringContaining("/logout"), expect.anything()));
    expect(events).toContain("SIGNED_OUT");

    seedSession(3600);
    const next = store().get(SESSION);
    events.length = 0;
    await act(async () => {
      answerLogout(answer(204, {}));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(store().get(SESSION)).toBe(next);
    expect(events).not.toContain("SIGNED_OUT");
  });

  it("logout lands signed out when the network is gone", async () => {
    seedSession(3600);
    store().set("catera.actor", JSON.stringify(rani));
    const runtime = real();
    const forgot = jest.fn();
    // Answers as the server does, by the session the phone holds: the SIGNED_OUT event reads me() again.
    const me = jest.fn(async () => ({ actor: store().has(SESSION) ? rani : null, demo: false }));
    runtime.api = { ...runtime.api, me, command: jest.fn(offline) } as never;
    await render(
      <MobileProvider runtime={runtime} linkMapper={(h) => h} onSignedOut={forgot}>
        <Grab />
      </MobileProvider>,
    );
    await signedIn();
    await act(() => session.logout());
    await signedIn("none");
    expect(forgot).toHaveBeenCalled();
    expect(store().has(SESSION)).toBe(false);
  });

  it("a rewrite never deletes first, and only a refused write falls back", async () => {
    await secureStorage.setItem(SESSION, "v1");
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(SESSION, "v1", {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error("keychain"));
    await secureStorage.setItem(SESSION, "v2");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
    expect(store().get(SESSION)).toBe("v2");
  });
});

describe("H: the context value", () => {
  it("stays the same object across a provider re-render, and moves with what it carries", async () => {
    const runtime = stub(rani);
    const linkMapper = (h: string) => h;
    const tree = (mark: string) => (
      <MobileProvider runtime={runtime} linkMapper={linkMapper}>
        <Grab />
        <Text>{mark}</Text>
      </MobileProvider>
    );
    const r = await render(tree("one"));
    await signedIn();
    await waitFor(() => expect(session.booted).toBe(true));
    const before = session;
    await r.rerender(tree("two"));
    await r.rerender(
      <MobileProvider runtime={runtime} linkMapper={linkMapper}>
        <Grab key="fresh" />
      </MobileProvider>,
    );
    expect(session).toBe(before);
    expect("refreshing" in session).toBe(false);

    await act(() => session.setLocale("en"));
    expect(session).not.toBe(before);
    expect(session.t("Halo", "Hello")).toBe("Hello");
    expect(session.command).toBe(before.command);
    const revision = session.revision;
    await act(async () => {
      await session.command("x", {});
    });
    expect(session.revision).toBe(revision + 1);
  });
});

describe("I: shared reads", () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  }
  function Reader({ id, name = "shared", loader }: { id: string; name?: string; loader: () => Promise<string> }) {
    const read = useData(name, loader);
    readers[id] = read.reload;
    return <Text testID={id}>{read.data ?? "-"}</Text>;
  }
  const readers: Record<string, () => Promise<void>> = {};
  const shows = (id: string, text: string) =>
    waitFor(() => expect(screen.getByTestId(id).props.children).toBe(text));
  /** Mounts `child` on demand, the way a screen pushed later does. */
  let reveal: () => void;
  function Later({ child }: { child: ReactNode }) {
    const [on, setOn] = useState(false);
    useEffect(() => {
      reveal = () => setOn(true);
    }, []);
    return on ? child : null;
  }

  it("two hooks with one key and revision send one request; other keys send their own", async () => {
    const loader = jest.fn(async () => "x");
    const other = jest.fn(async () => "y");
    await mount(
      stub(rani),
      <>
        <Reader id="a" loader={loader} />
        <Reader id="b" loader={loader} />
        <Reader id="c" name="other" loader={other} />
      </>,
    );
    await signedIn();
    await shows("a", "x");
    await shows("b", "x");
    await shows("c", "y");
    // Identity moves once from guest to the actor: one request per identity, never one per hook.
    expect(loader.mock.calls.length).toBeLessThanOrEqual(2);
    expect(other.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("a read begun before a command commits never serves a hook that asks after the revision moved", async () => {
    const before = deferred<string>();
    const loader = jest.fn(async () => "before");
    const runtime = stub(rani);
    await mount(runtime, <Later child={<Reader id="b" loader={loader} />} />);
    await signedIn();
    await waitFor(() => expect(session.booted).toBe(true));

    await act(async () => reveal());
    await shows("b", "before");

    // The first reader's request is still out when the command commits.
    loader.mockClear();
    loader.mockImplementationOnce(() => before.promise);
    await act(async () => {
      void readers.b();
    });
    expect(loader).toHaveBeenCalledTimes(1);
    loader.mockImplementation(async () => "after");
    await act(async () => {
      await session.command("plan.pause", {});
    });
    expect(loader.mock.calls.length).toBeGreaterThan(1);
    await shows("b", "after");
    // The slow pre-commit answer lands late and must not overwrite what the command's reload brought.
    await act(async () => before.resolve("before"));
    await shows("b", "after");
  });

  it("a command that skips the revision still ends sharing: a screen mounted after it reads again", async () => {
    const slow = deferred<string>();
    const loader = jest.fn(() => slow.promise as Promise<string>);
    const after = jest.fn(async () => "after");
    const runtime = stub(rani);
    await mount(
      runtime,
      <>
        <Reader id="a" loader={loader} />
        <Later child={<Reader id="b" loader={after} />} />
      </>,
    );
    await signedIn();
    await waitFor(() => expect(session.booted).toBe(true));
    await waitFor(() => expect(loader).toHaveBeenCalled());
    await act(async () => {
      await session.command("plan.pause", {}, { refresh: false });
    });
    await act(async () => reveal());
    await shows("b", "after");
    expect(after).toHaveBeenCalledTimes(1);
    await act(async () => slow.resolve("before"));
    await shows("b", "after");
  });

  it("a hook mounted with no command between joins the request already out", async () => {
    const slow = deferred<string>();
    const loader = jest.fn(() => slow.promise as Promise<string>);
    const second = jest.fn(async () => "second");
    await mount(
      stub(rani),
      <>
        <Reader id="a" loader={loader} />
        <Later child={<Reader id="b" loader={second} />} />
      </>,
    );
    await signedIn();
    await waitFor(() => expect(session.booted).toBe(true));
    await waitFor(() => expect(loader).toHaveBeenCalled());
    await act(async () => reveal());
    expect(second).not.toHaveBeenCalled();
    await act(async () => slow.resolve("first"));
    await shows("a", "first");
    await shows("b", "first");
  });

  it("reload() starts its own request, for a caller that just wrote something", async () => {
    const slow = deferred<string>();
    const loader = jest.fn(() => slow.promise as Promise<string>);
    await mount(stub(rani), <Reader id="a" loader={loader} />);
    await signedIn();
    await waitFor(() => expect(session.booted).toBe(true));
    await waitFor(() => expect(loader).toHaveBeenCalled());
    const count = loader.mock.calls.length;
    loader.mockImplementation(async () => "fresh");
    await act(async () => {
      await readers.a();
    });
    expect(loader.mock.calls.length).toBe(count + 1);
    await shows("a", "fresh");
  });

  it("is never shared across accounts", async () => {
    const slow = deferred<string>();
    const forRani = jest.fn(() => slow.promise as Promise<string>);
    const runtime = stub(rani);
    const r = await mount(runtime, <Reader id="a" loader={forRani} />);
    await signedIn();
    await waitFor(() => expect(forRani).toHaveBeenCalled());
    const forBudi = jest.fn(async () => "budi");
    runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: budi, demo: false })) } as never;
    await r.rerender(
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <Grab />
        <Reader id="a" loader={forBudi} />
      </MobileProvider>,
    );
    await act(() => session.refresh());
    await signedIn(budi.id);
    await shows("a", "budi");
    await act(async () => slow.resolve("rani"));
    await shows("a", "budi");
  });

  it("a failed read is not kept: the next ask reads again", async () => {
    const loader = jest.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue("back");
    await mount(stub(rani), <Reader id="a" loader={loader} />);
    await signedIn();
    await act(async () => {
      await session.invalidate();
    });
    await shows("a", "back");
  });
});
