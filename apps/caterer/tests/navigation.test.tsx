import { Text } from "react-native";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { appRoutes, navigationContainer, resetRouterStore } from "./real-router";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useMobile, type MobileContextValue } from "@catera/mobile-core";

/** The account the session read returns; each test sets its role. */
const mockMe: { actor: { id: string; role: string; name: string; catererId: string } | null } = { actor: null };
/** The notification the app was opened from (a cold push tap), read once the app is ready. */
const mockLaunch: { response: unknown } = { response: null };
/** When set, the tabs a helper (staff) is given instead of the real policy, to prove every guard follows it. */
const mockStaffTabs: { tabs: string[] | null } = { tabs: null };

jest.mock("../src/roles", () => {
  const actual = jest.requireActual("../src/roles");
  return {
    ...actual,
    tabsForRole: (role: string | undefined) =>
      role === "staff" && mockStaffTabs.tabs ? mockStaffTabs.tabs : actual.tabsForRole(role),
  };
});
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

const ISSUE = "3f2a8c1e-9b4d-4e6f-8a7b-1c2d3e4f5a6b";
const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
const staff = { id: "u-2", role: "staff", name: "Mas Joko", catererId: "k-1" };

/** The session as the screens see it, so a test can sign in and out the way Masuk and Keluar do. */
let session: MobileContextValue;

/**
 * The real layouts (root stack, native tabs, each tab's stack) over stand-in screens: each screen only names its own
 * file and the date it was opened with, so the test reads where a link landed without loading kitchen data.
 */
function stub(file: string) {
  const name = file.replace(/\([^)]*\)\//g, "");
  return function Stub() {
    session = useMobile();
    const { date } = useLocalSearchParams<{ date?: string }>();
    // Every tab and every screen under the front one stays mounted; only the focused one counts as shown.
    return <Text testID={useIsFocused() ? "screen" : "behind"}>{date ? `${name} ${date}` : name}</Text>;
  };
}
const routes = appRoutes(stub);

/** Starts the app cold at a link, the way the system opens it (through `+native-intent`). */
function open(initialUrl = "/") {
  return renderRouter(routes, { initialUrl });
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
  const ref = navigationContainer();
  type S = { key: string; index: number; routes: { name: string; state?: S }[] };
  let state = ref.getRootState() as S | undefined;
  while (state && !state.routes.some((route) => route.name === name)) state = state.routes[state.index]?.state;
  act(() => ref.dispatch({ type: "JUMP_TO", payload: { name }, target: state!.key }));
}

/**
 * The native header's back arrow (or Android's back): react-native-screens pops the screen in front, naming it as the
 * source, from the stack that holds it.
 */
function headerBack() {
  const ref = navigationContainer();
  type S = { key: string; index: number; routes: { key: string; state?: S }[] };
  let stack = ref.getRootState() as S;
  while (stack.routes[stack.index]?.state) stack = stack.routes[stack.index].state!;
  act(() => ref.dispatch({ type: "POP", payload: { count: 1 }, source: stack.routes[stack.index].key, target: stack.key }));
}

/** The native header react-native-screens draws for a route (the last screen of that name, the one in front). */
function nativeHeaderOf(route: string) {
  type Host = { props: Record<string, any>; findAll: (f: (n: { type: unknown }) => boolean) => Host[] };
  const screens = screen.UNSAFE_root.findAll(
    (n) => n.type === "RNSScreen" && String(n.props.screenId).startsWith(`${route}-`),
  ) as unknown as Host[];
  return screens.at(-1)!.findAll((n) => n.type === "RNSScreenStackHeaderConfig")[0];
}

beforeEach(() => {
  mockMe.actor = owner;
  mockLaunch.response = null;
  mockStaffTabs.tabs = null;
  resetRouterStore();
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
    // The native bar with the platform back; the report names itself once it loads (`Screen nativeTitle`).
    expect(nativeHeaderOf("laporan/[id]").props).toMatchObject({ hidden: false, hideBackButton: false });

    headerBack();
    await waitFor(() => expect(r.getPathname()).toBe("/"));
    expect(snapshot(r)).toMatchObject({ tab: "(index)", stack: ["index"] });
    expect(shown()).toBe("index");
  });

  it("an opened link to a report keeps Hari ini behind it", async () => {
    // The same screen opened from outside the app (a link, not a notification).
    const r = open(`/laporan/${ISSUE}`);
    await waitFor(() => expect(r.getPathname()).toBe(`/laporan/${ISSUE}`));
    expect(snapshot(r)).toMatchObject({ root: ["(tabs)"], tab: "(index)", stack: ["index", "laporan/[id]"] });
    await waitFor(() => expect(shown()).toBe("laporan/[id]"));
    headerBack();
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

  it("every screen follows the role's tabs: granted Pelanggan, staff open a customer", async () => {
    // The guards read tabsForRole, so a policy that gives helpers Pelanggan opens its screens and nothing else.
    mockStaffTabs.tabs = ["index", "pelanggan", "menu"];
    const r = open("/");
    await waitFor(() => expect(shown()).toBe("index"));
    expect(snapshot(r).tabs).toEqual(["(index)", "(pelanggan)", "(menu)"]);
    act(() => require("../src/nav").goToTab("pelanggan"));
    await waitFor(() => expect(snapshot(r).tab).toBe("(pelanggan)"));
    act(() => router.push("/pelanggan/c-1"));
    await waitFor(() => expect(snapshot(r)).toMatchObject({ tab: "(pelanggan)", stack: ["pelanggan", "pelanggan/[id]"] }));
    expect(shown()).toBe("pelanggan/[id]");
    // Impor belongs to Pelanggan; Usaha's screens stay closed.
    act(() => router.push("/impor"));
    await waitFor(() => expect(r.getSegments()).toEqual(["impor"]));
    act(() => require("../src/nav").goToTab("pelanggan"));
    await waitFor(() => expect(snapshot(r).root).toEqual(["(tabs)"]));
    for (const href of ["/usaha", "/uang", "/tim", "/paket/p-1", "/aktifkan"]) {
      act(() => router.push(href as never));
      await act(async () => {});
      expect({ href, shown: shown() }).toEqual({ href, shown: "pelanggan" });
    }
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
    // A modal in the root stack: it covers the tab bar, with its own header and Close.
    expect(snapshot(r).root).toEqual(["(tabs)", "impor"]);
    expect(nativeHeaderOf("impor").props).toMatchObject({ title: "Impor pelanggan", hideBackButton: true });
    expect(screen.getByRole("button", { name: "Tutup" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull();
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
    expect(nativeHeaderOf("aktifkan").props).toMatchObject({ title: "Aktifkan pembayaran", hideBackButton: true });
    // A modal, so it closes with Close rather than going Back.
    fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
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

describe("signing out", () => {
  it("a tap that arrives signed out never opens for the next account", async () => {
    const r = open("/");
    await waitFor(() => expect(shown()).toBe("index"));
    // Keluar: the owner signs out and lands on Masuk.
    mockMe.actor = null;
    await act(() => session.logout());
    await waitFor(() => expect(r.getSegments()).toEqual(["(auth)", "masuk"]));
    // A report notification for the owner, tapped on Masuk.
    tap(`/seller/support?issue=${ISSUE}`);
    await act(async () => {});
    // A helper signs in on the same phone, as Masuk does, and gets Hari ini without the owner's report.
    mockMe.actor = staff;
    await act(() => session.signedIn(staff as never));
    act(() => require("../src/nav").goToTab("index"));
    await waitFor(() => expect(shown()).toBe("index"));
    await act(async () => {});
    expect(snapshot(r)).toMatchObject({ root: ["(tabs)"], tab: "(index)", stack: ["index"] });
  });
});

describe("links from the system", () => {
  const { redirectSystemPath } = require("../src/nav") as typeof import("../src/nav");
  const rewrite = (path: string) => redirectSystemPath({ path, initial: true });

  it("names a bare tab root's own group, from any link form", () => {
    expect(rewrite("/")).toBe("/(tabs)/(index)");
    expect(rewrite("/?date=2030-01-04")).toBe("/(tabs)/(index)?date=2030-01-04");
    expect(rewrite("/pelanggan")).toBe("/(tabs)/(pelanggan)/pelanggan");
    expect(rewrite("/menu/")).toBe("/(tabs)/(menu)/menu");
    expect(rewrite("catera-dapur://usaha")).toBe("/(tabs)/(usaha)/usaha");
    expect(rewrite("catera-dapur:///pelanggan")).toBe("/(tabs)/(pelanggan)/pelanggan");
    expect(rewrite("catera-dapur://")).toBe("/(tabs)/(index)");
    expect(rewrite("https://dapur.example.test/menu?x=1")).toBe("/(tabs)/(menu)/menu?x=1");
    expect(rewrite("exp://192.168.1.2:8081/--/usaha")).toBe("/(tabs)/(usaha)/usaha");
  });

  it("passes every other link through unchanged", () => {
    for (const path of [`/laporan/${ISSUE}`, "/menu/2030-01-03", "/aktifkan", "catera-dapur://pelanggan/c-1", "/index"])
      expect(rewrite(path)).toBe(path);
  });

  it("is what +native-intent hands the router, which applies it to a cold link", async () => {
    expect(require("../app/+native-intent").redirectSystemPath).toBe(redirectSystemPath);
    const nav = require("../src/nav");
    const spy = jest.spyOn(nav, "redirectSystemPath");
    try {
      open("/menu");
      await waitFor(() => expect(shown()).toBe("menu"));
      expect(spy).toHaveBeenCalledWith({ path: "/menu", initial: true });
      expect(spy).toHaveReturnedWith("/(tabs)/(menu)/menu");
    } finally {
      spy.mockRestore();
    }
  });

  it.each([
    ["/menu", "(menu)", "menu"],
    ["/pelanggan", "(pelanggan)", "pelanggan"],
    ["/usaha", "(usaha)", "usaha"],
    ["/", "(index)", "index"],
  ])("a cold link to %s opens that tab at its root", async (link, tab, root) => {
    const r = open(link);
    await waitFor(() => expect(shown()).toBe(root));
    expect(snapshot(r)).toMatchObject({ root: ["(tabs)"], tab, stack: [root] });
  });
});
