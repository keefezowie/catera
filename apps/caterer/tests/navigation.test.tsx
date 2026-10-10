import fs from "node:fs";
import path from "node:path";
import { Text } from "react-native";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";

// expo-router's testing library swaps in Reanimated's stock mock, which has no useReducedMotion; the app reads it.
const Reanimated = require("react-native-reanimated");
Reanimated.useReducedMotion ??= () => false;

/** The account the session read returns; each test sets its role. */
const mockMe: { actor: { id: string; role: string; name: string; catererId: string } | null } = { actor: null };
/** The notification the app was opened from (a cold push tap), read once the app is ready. */
const mockLaunch: { response: unknown } = { response: null };

jest.mock("expo-font", () => ({ ...jest.requireActual("expo-font"), useFonts: () => [true, null], isLoaded: () => true }));
jest.mock("../src/runtime", () => {
  const { createMobileRuntime } = jest.requireActual("@catera/mobile-core");
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "navigation" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: mockMe.actor, demo: false })) };
  return { runtime };
});
jest.mock("expo-notifications", () => {
  const responders: ((r: unknown) => void)[] = [];
  return {
    __responders: responders,
    setNotificationHandler: jest.fn(),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationResponseReceivedListener: jest.fn((fn: (r: unknown) => void) => {
      responders.push(fn);
      return { remove: jest.fn() };
    }),
    getLastNotificationResponseAsync: jest.fn(async () => mockLaunch.response),
    clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  };
});

// Each test mounts the whole app (root stack, native tabs, four tab stacks), which takes a few seconds under Jest.
jest.setTimeout(30000);

const appDir = path.join(__dirname, "..", "app");
const ISSUE = "3f2a8c1e-9b4d-4e6f-8a7b-1c2d3e4f5a6b";
const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
const staff = { id: "u-2", role: "staff", name: "Mas Joko", catererId: "k-1" };

/** Every route file under app/, as the router names it (`(tabs)/(index,pelanggan,menu,usaha)/laporan/[id]`). */
function routeFiles(dir = appDir, prefix = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return routeFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`);
    return [`${prefix}${entry.name.replace(/\.tsx?$/, "")}`];
  });
}

/**
 * The real layouts (root stack, native tabs, each tab's stack) over stand-in screens: each screen only names its own
 * file and the date it was opened with, so the test reads where a link landed without loading kitchen data.
 */
function stub(file: string) {
  const name = file.replace(/\([^)]*\)\//g, "");
  return function Stub() {
    const { date } = useLocalSearchParams<{ date?: string }>();
    // Every tab and every screen under the front one stays mounted; only the focused one counts as shown.
    return <Text testID={useIsFocused() ? "screen" : "behind"}>{date ? `${name} ${date}` : name}</Text>;
  };
}
const overrides = Object.fromEntries(routeFiles().filter((f) => !f.endsWith("_layout")).map((f) => [f, stub(f)]));

function open(initialUrl = "/") {
  return renderRouter({ appDir, overrides }, { initialUrl });
}

/** What the router holds now: the root stack's routes, the tab bar's tabs, the focused tab and that tab's stack. */
function snapshot(r: ReturnType<typeof open>) {
  type S = { index?: number; routes: { name: string; state?: S }[] };
  const container = r.getRouterState() as S;
  const root = container.routes[0].state!;
  const tabs = root.routes.find((route) => route.name === "(tabs)")?.state;
  const focused = tabs?.routes[tabs.index ?? 0];
  return {
    root: root.routes.map((route) => route.name),
    tabs: tabs?.routes.map((route) => route.name),
    tab: focused?.name,
    stack: focused?.state?.routes.map((route) => route.name),
  };
}

/** Delivers a notification tap to the app, the way expo-notifications does while it runs. */
function tap(href: string, identifier = `n-${href}`) {
  const { __responders } = require("expo-notifications") as { __responders: ((r: unknown) => void)[] };
  act(() => {
    __responders[__responders.length - 1]({
      actionIdentifier: "default",
      notification: { request: { identifier, content: { data: { href } } } },
    });
  });
}

/** The screen in front. */
const shown = () => String(screen.getByTestId("screen").props.children);

/** A tap on a tab in the bar: the native bar selects the tab and leaves its stack as it was. */
function tapTab(name: string) {
  const { store } = require("expo-router/build/global-state/store");
  const ref = store.navigationRef.current;
  type S = { key: string; index: number; routes: { name: string; state?: S }[] };
  let state = ref.getRootState() as S | undefined;
  while (state && !state.routes.some((route) => route.name === name)) state = state.routes[state.index]?.state;
  act(() => ref.dispatch({ type: "JUMP_TO", payload: { name }, target: state!.key }));
}

beforeEach(() => {
  mockMe.actor = owner;
  mockLaunch.response = null;
  // The router keeps the last test's place in a module-level store, and resolves a shared path ("/" is in every tab's
  // group) toward that place. A real cold start has no last place, so each test starts without one.
  const { storeRef } = require("expo-router/build/global-state/store");
  if (storeRef.current) storeRef.current.routeInfo = undefined;
});

describe("each tab keeps its own stack", () => {
  it("a report link opens inside Hari ini with Back to Hari ini", async () => {
    // A cold push tap: the app starts on Hari ini, then opens the notification it was launched from.
    mockLaunch.response = {
      actionIdentifier: "default",
      notification: { request: { identifier: "cold", content: { data: { href: `/seller/support?issue=${ISSUE}` } } } },
    };
    const r = open("/");
    await waitFor(() => expect(r.getPathname()).toBe(`/laporan/${ISSUE}`));
    expect(r.getSegments()).toEqual(["(tabs)", "(index)", "laporan", "[id]"]);
    // Inside the Hari ini tab, so the tab bar stays, with Hari ini under the report.
    expect(snapshot(r)).toMatchObject({ root: ["(tabs)"], tab: "(index)", stack: ["index", "laporan/[id]"] });
    expect(shown()).toBe("laporan/[id]");
    expect(screen.getByText("Laporan masalah")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Kembali" }));
    await waitFor(() => expect(r.getPathname()).toBe("/"));
    expect(snapshot(r)).toMatchObject({ tab: "(index)", stack: ["index"] });
    expect(shown()).toBe("index");
  });

  it("an opened link to a report keeps Hari ini behind it", async () => {
    // The same screen opened from outside the app (a link, not a notification).
    const r = open(`/laporan/${ISSUE}`);
    await waitFor(() => expect(r.getPathname()).toBe(`/laporan/${ISSUE}`));
    expect(snapshot(r)).toMatchObject({ root: ["(tabs)"], tab: "(index)", stack: ["index", "laporan/[id]"] });
    fireEvent.press(await screen.findByRole("button", { name: "Kembali" }));
    await waitFor(() => expect(shown()).toBe("index"));
  });

  it("a detail screen opened on Menu stays in Menu, and Hari ini keeps its own place", async () => {
    const r = open("/");
    await waitFor(() => expect(shown()).toBe("index"));
    act(() => router.push(`/laporan/${ISSUE}`));
    await waitFor(() => expect(shown()).toBe("laporan/[id]"));
    act(() => require("../src/nav").goToTab("menu"));
    await waitFor(() => expect(r.getSegments()).toEqual(["(tabs)", "(menu)", "menu"]));
    act(() => router.push("/menu/2030-01-03?pkg=p-1&meal=lunch"));
    await waitFor(() => expect(r.getSegments()).toEqual(["(tabs)", "(menu)", "menu", "[date]"]));
    expect(snapshot(r)).toMatchObject({ tab: "(menu)", stack: ["menu", "menu/[date]"] });
    // Back on Hari ini through the tab bar, it still holds the report it was showing.
    tapTab("(index)");
    await waitFor(() => expect(snapshot(r).tab).toBe("(index)"));
    expect(snapshot(r).stack).toEqual(["index", "laporan/[id]"]);
  });

  it("a link to a tab root selects that tab at its root instead of pushing a second copy", async () => {
    const r = open("/");
    await waitFor(() => expect(shown()).toBe("index"));
    // Pelanggan already holds a customer.
    act(() => require("../src/nav").goToTab("pelanggan"));
    act(() => router.push("/pelanggan/c-1"));
    await waitFor(() => expect(snapshot(r)).toMatchObject({ tab: "(pelanggan)", stack: ["pelanggan", "pelanggan/[id]"] }));
    act(() => require("../src/nav").goToTab("index"));
    await waitFor(() => expect(snapshot(r).tab).toBe("(index)"));
    // A notification for the customer list, tapped on Hari ini.
    tap("/seller/customers");
    await waitFor(() => expect(r.getSegments()).toEqual(["(tabs)", "(pelanggan)", "pelanggan"]));
    expect(snapshot(r)).toMatchObject({ tab: "(pelanggan)", stack: ["pelanggan"] });
    // Hari ini was not given a Pelanggan screen of its own.
    const { routes } = (r.getRouterState() as any).routes[0].state.routes[0].state;
    expect(routes.find((t: { name: string }) => t.name === "(index)").state.routes.map((s: { name: string }) => s.name)).toEqual([
      "index",
    ]);
  });

  it("a schedule notification tapped on Menu opens Hari ini on that day", async () => {
    const r = open("/");
    await waitFor(() => expect(shown()).toBe("index"));
    act(() => require("../src/nav").goToTab("menu"));
    await waitFor(() => expect(snapshot(r).tab).toBe("(menu)"));
    tap("/seller/schedule?date=2030-01-04");
    await waitFor(() => expect(shown()).toBe("index 2030-01-04"));
    expect(snapshot(r)).toMatchObject({ tab: "(index)", stack: ["index"] });
    expect(snapshot(r).tabs).toEqual(["(index)", "(pelanggan)", "(menu)", "(usaha)"]);
  });
});

describe("staff", () => {
  beforeEach(() => {
    mockMe.actor = staff;
  });

  it("staff cannot open Usaha routes", async () => {
    const r = open("/");
    await waitFor(() => expect(shown()).toBe("index"));
    // The bar holds Hari ini and Menu only.
    expect(snapshot(r).tabs).toEqual(["(index)", "(menu)"]);
    for (const href of ["/usaha", "/uang", "/tim", "/paket/baru", "/paket/p-1", "/aktifkan", "/impor", "/pelanggan", "/pelanggan/c-1"]) {
      act(() => router.push(href as never));
      await act(async () => {});
      expect({ href, path: r.getPathname(), shown: shown() }).toEqual({ href, path: "/", shown: "index" });
    }
    // A notification meant for an owner's settings changes nothing either.
    tap("/seller/settings");
    tap("/seller/customers");
    await act(async () => {});
    expect(r.getPathname()).toBe("/");
    expect(snapshot(r)).toMatchObject({ root: ["(tabs)"], tab: "(index)", stack: ["index"] });
  });

  it("an opened link to an owner screen lands staff on Hari ini", async () => {
    const r = open("/uang");
    await waitFor(() => expect(screen.queryAllByTestId("screen").length).toBeGreaterThan(0));
    expect(shown()).toBe("index");
    expect(r.getPathname()).toBe("/");
  });

  it("staff still open reports and the day's menu inside their tabs", async () => {
    const r = open("/");
    await waitFor(() => expect(shown()).toBe("index"));
    tap(`/seller/support?issue=${ISSUE}`);
    await waitFor(() => expect(r.getSegments()).toEqual(["(tabs)", "(index)", "laporan", "[id]"]));
    act(() => require("../src/nav").goToTab("menu"));
    act(() => router.push("/menu/2030-01-03?pkg=p-1&meal=lunch"));
    await waitFor(() => expect(r.getSegments()).toEqual(["(tabs)", "(menu)", "menu", "[date]"]));
  });
});

describe("screens above the tabs", () => {
  it("Impor opens above the tabs", async () => {
    const r = open("/");
    await waitFor(() => expect(shown()).toBe("index"));
    act(() => require("../src/nav").goToTab("pelanggan"));
    await waitFor(() => expect(snapshot(r).tab).toBe("(pelanggan)"));
    act(() => router.push("/impor"));
    await waitFor(() => expect(r.getSegments()).toEqual(["impor"]));
    // A root-stack screen: it covers the tab bar, with its own header and Back.
    expect(snapshot(r).root).toEqual(["(tabs)", "impor"]);
    expect(screen.getByText("Impor pelanggan")).toBeTruthy();
    // "Lihat Pelanggan" after saving: Impor closes and Pelanggan shows its list.
    act(() => require("../src/nav").goToTab("pelanggan"));
    await waitFor(() => expect(r.getSegments()).toEqual(["(tabs)", "(pelanggan)", "pelanggan"]));
    expect(snapshot(r)).toMatchObject({ root: ["(tabs)"], tab: "(pelanggan)", stack: ["pelanggan"] });
  });

  it("Aktifkan opens above the tabs, also from a payout notification", async () => {
    const r = open("/");
    await waitFor(() => expect(shown()).toBe("index"));
    tap("/seller/settings#payout");
    await waitFor(() => expect(r.getSegments()).toEqual(["aktifkan"]));
    expect(snapshot(r).root).toEqual(["(tabs)", "aktifkan"]);
    expect(screen.getByText("Aktifkan pembayaran")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Kembali" }));
    await waitFor(() => expect(r.getPathname()).toBe("/"));
    expect(snapshot(r).root).toEqual(["(tabs)"]);
  });

  it("a report tapped while Aktifkan is open opens in the tabs, not a second tab bar", async () => {
    const r = open("/");
    await waitFor(() => expect(shown()).toBe("index"));
    act(() => router.push("/aktifkan"));
    await waitFor(() => expect(r.getSegments()).toEqual(["aktifkan"]));
    tap(`/seller/support?issue=${ISSUE}`);
    await waitFor(() => expect(r.getSegments()).toEqual(["(tabs)", "(index)", "laporan", "[id]"]));
    expect(snapshot(r)).toMatchObject({ root: ["(tabs)"], stack: ["index", "laporan/[id]"] });
  });

  it("signed out, every link lands on Masuk", async () => {
    mockMe.actor = null;
    const r = open(`/laporan/${ISSUE}`);
    await waitFor(() => expect(r.getSegments()).toEqual(["(auth)", "masuk"]));
  });
});
