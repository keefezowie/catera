import { Text } from "react-native";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { appRoutes, resetRouterStore } from "./real-router";
import { router, useIsFocused } from "expo-router";
import { useMobile, type MobileContextValue } from "@catera/mobile-core";

/**
 * Sign-out against a stand-in API that keeps the server's session rule (apps/web/src/lib/auth.ts: a bearer, else the
 * `catera_v1_demo` cookie) and a stand-in for the phone's native cookie store (Android's CookieManager behind OkHttp,
 * iOS's NSHTTPCookieStorage). React Native's fetch stores and sends cookies unless the request says
 * `credentials: "omit"` (its XMLHttpRequest defaults `withCredentials` to true), and the store outlives the app.
 */
const mockJar = new Map<string, string>();

jest.mock("react-native/Libraries/Network/RCTNetworking", () => ({
  __esModule: true,
  default: {
    clearCookies: (callback: (cleared: boolean) => void) => {
      const had = mockJar.size > 0;
      mockJar.clear();
      callback(had);
    },
  },
}));
jest.mock("expo-font", () => ({ ...jest.requireActual("expo-font"), useFonts: () => [true, null], isLoaded: () => true }));
jest.mock("../src/runtime", () => {
  const { createMobileRuntime } = jest.requireActual("@catera/mobile-core");
  return { runtime: createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "signout", app: "dapur" }) };
});

jest.setTimeout(30000);

const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
const DEMO_TOKEN = "demo.synthetic-owner.signature";

type Sent = { path: string; authorization: string; cookie: string };
let sent: Sent[] = [];

function serve(url: string, init: RequestInit = {}) {
  const path = url.replace("https://api.example.test/api/v1/", "");
  const withCredentials = init.credentials !== "omit";
  const cookie = withCredentials ? [...mockJar].map(([name, value]) => `${name}=${value}`).join("; ") : "";
  const authorization = (init.headers as Record<string, string> | undefined)?.Authorization ?? "";
  sent.push({ path, authorization, cookie });
  const reply = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) });
  if (path === "auth/demo") {
    // The route answers with the token and also sets the cookie (Set-Cookie), which the store keeps if allowed.
    if (withCredentials) mockJar.set("catera_v1_demo", DEMO_TOKEN);
    return reply({ token: DEMO_TOKEN, id: owner.id });
  }
  const bearer = authorization.replace(/^Bearer /, "");
  const token = bearer || (/(?:^|; )catera_v1_demo=([^;]*)/.exec(cookie)?.[1] ?? "");
  if (path === "me") return reply({ actor: token === DEMO_TOKEN ? owner : null, demo: true });
  return reply(path.startsWith("usage") ? {} : []);
}

let session: MobileContextValue;

/** Real Masuk and Pengaturan inside the real layouts; every other screen only names its file. */
const routes = appRoutes((file) => {
  const real = (Screen: () => React.ReactNode) =>
    function RealScreen() {
      session = useMobile();
      return <Screen />;
    };
  if (file === "(auth)/masuk") return real(require("../src/auth/Masuk").Masuk);
  if (file.endsWith("/pengaturan")) return real(require("../src/settings/Pengaturan").Pengaturan);
  const name = file.replace(/\([^)]*\)\//g, "");
  return function Stub() {
    session = useMobile();
    return <Text testID={useIsFocused() ? "screen" : "behind"}>{name}</Text>;
  };
});

const fetchBefore = global.fetch;
beforeEach(() => {
  mockJar.clear();
  sent = [];
  resetRouterStore();
  (require("expo-secure-store") as { __store: Map<string, string> }).__store.clear();
  global.fetch = jest.fn(async (url: unknown, init?: RequestInit) => serve(String(url), init)) as never;
});
afterAll(() => {
  global.fetch = fetchBefore;
});

describe("Keluar from a demo session", () => {
  it("signs out for good: the next request carries no credential and the app stays on Masuk", async () => {
    const r = renderRouter(routes, { initialUrl: "/masuk" });
    await waitFor(() => expect(r.getSegments()).toEqual(["(auth)", "masuk"]));

    // Masuk's demo button: auth/demo, then the session read, then Hari ini.
    fireEvent.press(await screen.findByRole("button", { name: "Masuk sebagai pemilik" }));
    await waitFor(() => expect(r.getSegments()[0]).toBe("(tabs)"));
    expect(sent.filter((s) => s.path === "me").at(-1)?.authorization).toBe(`Bearer ${DEMO_TOKEN}`);

    act(() => router.push("/pengaturan"));
    fireEvent.press(await screen.findByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(r.getSegments()).toEqual(["(auth)", "masuk"]));

    // The next session read (a return from the background, a sign-out event, the next launch) asks as nobody.
    sent = [];
    await act(() => session.refresh());
    const next = sent.find((s) => s.path === "me");
    expect(next).toEqual({ path: "me", authorization: "", cookie: "" });
    await act(async () => {});
    expect(session.actor).toBeNull();
    expect(r.getSegments()).toEqual(["(auth)", "masuk"]);
    expect(screen.getByRole("button", { name: "Masuk sebagai pemilik" })).toBeTruthy();
  });

  it("clears a demo cookie the phone kept from before, so an old install signs out too", async () => {
    // An install from before the fix: the store already holds the demo cookie from an earlier demo login.
    mockJar.set("catera_v1_demo", DEMO_TOKEN);
    const r = renderRouter(routes, { initialUrl: "/masuk" });
    fireEvent.press(await screen.findByRole("button", { name: "Masuk sebagai pemilik" }));
    await waitFor(() => expect(r.getSegments()[0]).toBe("(tabs)"));
    act(() => router.push("/pengaturan"));
    fireEvent.press(await screen.findByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(r.getSegments()).toEqual(["(auth)", "masuk"]));
    expect(mockJar.size).toBe(0);
  });
});
