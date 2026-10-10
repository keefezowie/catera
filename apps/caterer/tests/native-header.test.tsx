import * as ReactNative from "react-native";
import { StatusBar, Text } from "react-native";
import { act, fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import { appRoutes, navigationContainer, resetRouterStore } from "./real-router";
import { router } from "expo-router";
import { nativeThemes } from "@catera/design-tokens";
import { contentTitled, fonts, LINK_TITLE_MAX, linkTitle, MoodHeader, Screen } from "@catera/mobile-ui";
import { customerHref, packageHref, reportHref } from "../src/hrefs";

/** The account the session read returns, and whether the server reports demo. */
const mockMe: { demo: boolean; actor: { id: string; role: string; name: string; catererId: string } | null } = {
  demo: false,
  actor: null,
};
/** What the money read answers; a test that breaks Uang sets a value that throws while it renders. */
const mockSettlement: { value: unknown } = { value: { unavailable: true } };

jest.mock("expo-font", () => ({ ...jest.requireActual("expo-font"), useFonts: () => [true, null], isLoaded: () => true }));
jest.mock("../src/runtime", () => {
  const { createMobileRuntime } = jest.requireActual("@catera/mobile-core");
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "native-header" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: mockMe.actor, demo: mockMe.demo })),
    settlement: jest.fn(async () => mockSettlement.value),
    // The customer, package and report reads never answer, so their screens stay on the frame before the record.
    sellerCustomers: jest.fn(() => new Promise(() => undefined)),
    sellerOperations: jest.fn(() => new Promise(() => undefined)),
    request: jest.fn(() => new Promise(() => undefined)),
  };
  return { runtime };
});
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

// Each test mounts the whole app (root stack, native tabs, four tab stacks), which takes a few seconds under Jest.
jest.setTimeout(30000);

const ISSUE = "3f2a8c1e-9b4d-4e6f-8a7b-1c2d3e4f5a6b";
const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
const staff = { id: "u-2", role: "staff", name: "Mas Joko", catererId: "k-1" };
const TAB_ROOTS = new Set(["index", "pelanggan", "menu", "usaha"]);

/** The screens named by their record, which read the name their link carried. */
const RECORD_NAMED = new Set(["pelanggan/[id]", "paket/[id]", "laporan/[id]"]);

/**
 * The real layouts over stand-in screens. A tab root draws a mood header, as every Dapur tab root does, so the status
 * bar can be read on it; every other screen only names itself. Uang is the real screen, the only host of `ScreenGuard`,
 * and the customer, package and report routes are the real ones, so their first frame can be read.
 */
const routes = appRoutes((file) => {
  const name = file.replace(/\([^)]*\)\//g, "");
  if (name === "uang") return require("../app/(tabs)/(index,pelanggan,menu,usaha)/uang").default;
  if (RECORD_NAMED.has(name)) return require(`../app/(tabs)/(index,pelanggan,menu,usaha)/${name}`).default;
  if (TAB_ROOTS.has(name))
    return function Root() {
      return <Screen header={<MoodHeader title={`root:${name}`} />}>{null}</Screen>;
    };
  return function Stub() {
    return <Text testID="screen">{name}</Text>;
  };
});

/** The host components react-native-screens renders: each screen and the native header it configures. */
type Host = { type: unknown; props: Record<string, any>; parent: Host | null; findAll: (f: (n: Host) => boolean) => Host[] };
const hosts = (type: string) => screen.UNSAFE_root.findAll((n) => n.type === type) as unknown as Host[];
const screenOf = (route: string) => {
  const found = hosts("RNSScreen").filter((s) => String(s.props.screenId).startsWith(`${route}-`)).at(-1);
  if (!found) throw new Error(`no screen for ${route}`);
  return found;
};
const headerOf = (route: string) => screenOf(route).findAll((n) => n.type === "RNSScreenStackHeaderConfig")[0];
const leadingOf = (route: string) =>
  headerOf(route).findAll((n) => n.type === "RNSScreenStackHeaderSubview" && n.props.type === "left")[0];

/**
 * The status bar style in effect: React Native merges every mounted StatusBar and the newest one wins. That merge is
 * what this test needs (the tab root's ScreenStatusBar over the app's default), and a mock that records the last
 * render would not reproduce it, so this reads React Native's own stack: `StatusBar._propsStack`, a private static in
 * react-native 0.86.3 (`Libraries/Components/StatusBar/StatusBar.js`). Recheck it when React Native changes.
 */
const statusGlyphs = () => {
  const stack = (StatusBar as unknown as { _propsStack: { barStyle?: { value: string } }[] })._propsStack;
  return [...stack].reverse().find((e) => e.barStyle?.value)?.barStyle?.value;
};

async function open(initialUrl = "/") {
  const r = renderRouter(routes, { initialUrl });
  await waitFor(() => expect(screen.getAllByText(/^root:/).length).toBeGreaterThan(0));
  await act(async () => {});
  return r;
}
const go = async (work: () => void) => {
  act(work);
  await act(async () => {});
};

/** Every pushed screen an owner opens, with the title its native bar shows (Android: the 22 small top app bar). */
const OWNER_PUSHES: [href: string, route: string, title: string][] = [
  [`/laporan/${ISSUE}`, "laporan/[id]", "Laporan masalah"],
  ["/menu/2030-01-03?pkg=p-1&meal=lunch", "menu/[date]", "Menu Kamis 3 Jan"],
  ["/pelanggan/c-1", "pelanggan/[id]", "Pelanggan"],
  ["/paket/p-1", "paket/[id]", "Paket"],
  ["/paket/baru", "paket/baru", "Paket baru"],
  ["/tim", "tim", "Tim"],
];

beforeEach(() => {
  mockMe.actor = owner;
  mockMe.demo = false;
  mockSettlement.value = { unavailable: true };
  resetRouterStore();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("native headers", () => {
  it("Dapur pushed screens use the native header", async () => {
    await open("/");
    const light = nativeThemes.light;
    for (const [href, route, title] of OWNER_PUSHES) {
      await go(() => router.push(href as never));
      const header = headerOf(route);
      // Material's small top app bar on the canvas: the platform back arrow, Plus Jakarta Sans Bold 22, no shadow.
      // A screen titled by its record (customer, package, report) keeps its bar empty until its name scrolls under it.
      expect({ route, ...header.props }).toMatchObject({
        route,
        hidden: false,
        hideBackButton: false,
        hideShadow: true,
        backgroundColor: light.canvas,
        color: light.charcoal,
        titleColor: light.charcoal,
        titleFontFamily: fonts.bold,
        titleFontSize: 22,
        consumeTopInset: true,
      });
      expect({ route, title: header.props.title }).toEqual({
        route,
        title: ["pelanggan/[id]", "paket/[id]", "laporan/[id]"].includes(route) ? "" : title,
      });
      expect(screen.queryByTestId("app-header")).toBeNull();
      await go(() => router.back());
    }
  });

  it("a helper's pushed screens use the same native header", async () => {
    mockMe.actor = staff;
    await open("/");
    await go(() => router.push("/menu/2030-01-03?pkg=p-1&meal=lunch"));
    expect(headerOf("menu/[date]").props).toMatchObject({ title: "Menu Kamis 3 Jan", hidden: false, hideBackButton: false });
    expect(screen.queryByTestId("app-header")).toBeNull();
  });

  it("Aktifkan and Impor are modals with Close, labelled Tutup, at the leading edge", async () => {
    const r = await open("/");
    for (const [href, route, title] of [
      ["/aktifkan", "aktifkan", "Aktifkan pembayaran"],
      ["/impor", "impor", "Impor pelanggan"],
    ] as const) {
      await go(() => router.push(href));
      expect(screenOf(route).props.stackPresentation).toBe("modal");
      const header = headerOf(route);
      expect(header.props).toMatchObject({ title, hideBackButton: true });
      const close = within(leadingOf(route) as never).getByRole("button", { name: "Tutup" });
      expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull();
      // The leading slot: one spoken 48dp target inside the toolbar's slot, and the icon pulled 12dp out so it centres
      // at 28dp, where the back arrow sits on the other pushed screens.
      expect(within(leadingOf(route) as never).getAllByRole("button")).toHaveLength(1);
      expect(ReactNative.StyleSheet.flatten(close.props.style)).toMatchObject({ width: 48, height: 48 });
      const icon = within(leadingOf(route) as never).getByTestId("header-close-icon", { includeHiddenElements: true });
      expect(ReactNative.StyleSheet.flatten(icon.props.style)).toMatchObject({ marginStart: -12, width: 48, height: 48 });
      await go(() => fireEvent.press(close));
      expect(r.getPathname()).toBe("/");
    }
  });

  it("Close on a modal opened cold goes to Hari ini with the tabs", async () => {
    // A link straight to Aktifkan: nothing sits under it in the root stack, so Close has no back to take.
    const r = renderRouter(routes, { initialUrl: "/aktifkan" });
    await waitFor(() => expect(headerOf("aktifkan").props).toMatchObject({ title: "Aktifkan pembayaran", hideBackButton: true }));
    await act(async () => {});
    expect(screen.queryAllByText(/^root:/)).toHaveLength(0);
    await go(() => fireEvent.press(within(leadingOf("aktifkan") as never).getByRole("button", { name: "Tutup" })));
    expect(r.getPathname()).toBe("/");
    // The tabs are mounted with Hari ini in front, and the modal is gone.
    await waitFor(() => expect(screen.getByText("root:index")).toBeTruthy());
    expect(hosts("RNSScreen").some((s) => String(s.props.screenId).startsWith("aktifkan-"))).toBe(false);
  });

  it("dark: the bar sits on the dark canvas with the dark ink", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    await open("/");
    await go(() => router.push("/tim"));
    const dark = nativeThemes.dark;
    expect(headerOf("tim").props).toMatchObject({ backgroundColor: dark.canvas, color: dark.charcoal, titleColor: dark.charcoal });
  });

  it("with the demo strip the Android bar adds no second status-bar inset", async () => {
    mockMe.demo = true;
    await open("/");
    expect(screen.getByText("Demo · data sintetis")).toBeTruthy();
    await go(() => router.push("/tim"));
    expect(headerOf("tim").props).toMatchObject({ hidden: false, consumeTopInset: false });
  });

  it("status bar: the mood on a tab root, the theme on a pushed screen", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    // 16.00 in Jakarta: Malam, whose dark header wants light glyphs. Only Date is faked.
    jest.useFakeTimers({
      now: new Date("2026-10-09T09:00:00Z"),
      doNotFake: [
        "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
        "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval",
        "setTimeout", "clearTimeout",
      ],
    });
    try {
      await open("/");
      expect(statusGlyphs()).toBe("light-content");
      await go(() => router.push("/tim"));
      expect(statusGlyphs()).toBe("dark-content");
      await go(() => router.back());
      expect(statusGlyphs()).toBe("light-content");
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("record titles", () => {
  /** Each link that knows the record's name, the route it opens, the name, and the generic name it replaces. */
  const TITLED: [href: string, route: string, name: string, generic: string][] = [
    [customerHref("c-1", "Nadia Putri"), "pelanggan/[id]", "Nadia Putri", "Pelanggan"],
    [packageHref("p-1", "Ayam Sambal Rumahan"), "paket/[id]", "Ayam Sambal Rumahan", "Paket"],
    [reportHref(ISSUE, "Nadia Putri"), "laporan/[id]", "Nadia Putri", "Laporan masalah"],
  ];
  const contentTitleOf = (route: string) =>
    within(screenOf(route) as never).getByTestId("screen-native-title").findByType(Text).props.children;

  it("a link that carries the record's name titles the screen on the first frame", async () => {
    await open("/");
    for (const [href, route, name, generic] of TITLED) {
      // One render after the push, with the record's read still out: the name is already there, the generic never.
      act(() => router.push(href as never));
      expect({ route, title: contentTitleOf(route) }).toEqual({ route, title: name });
      expect(within(screenOf(route) as never).queryByText(generic)).toBeNull();
      // Android: the bar starts empty and takes the name on scroll; the content line is the title.
      expect(headerOf(route).props.title).toBe("");
      // The route's own title, which iOS shows as the large title, is the carried name as the layout sets it; the iOS
      // options themselves are checked with the platform passed in, since Jest compiles the platform in.
      expect({ route, title: navigationContainer().getCurrentOptions()?.title }).toEqual({ route, title: name });
      expect(contentTitled(linkTitle({ title: name }) ?? generic, "ios")).toEqual({ title: name });
      await go(() => router.back());
    }
  });

  it("a cold link or a notification keeps the generic name until the record arrives", async () => {
    for (const [href, route, , generic] of TITLED) {
      resetRouterStore();
      const path = href.split("?")[0];
      const r = renderRouter(routes, { initialUrl: path });
      await waitFor(() => expect(contentTitleOf(route)).toBe(generic));
      expect(r.getPathname()).toBe(path);
      expect(navigationContainer().getCurrentOptions()?.title).toBe(generic);
      r.unmount();
    }
  });

  it("an OS link that carries a title opens with the generic name: only the app's own links name a screen", async () => {
    for (const [href, route, name, generic] of TITLED) {
      resetRouterStore();
      // The same href the app builds, arriving from outside (+native-intent) instead of from a tap inside the app.
      const r = renderRouter(routes, { initialUrl: href });
      await waitFor(() => expect(contentTitleOf(route)).toBe(generic));
      expect(within(screenOf(route) as never).queryByText(name)).toBeNull();
      expect(navigationContainer().getCurrentOptions()?.title).toBe(generic);
      r.unmount();
    }
  });

  it("the links carry the name, and an unknown name carries nothing", () => {
    expect(customerHref("c-1", "Nadia Putri")).toBe("/pelanggan/c-1?title=Nadia%20Putri");
    expect(packageHref("p-1", "Nasi & Ayam")).toBe(`/paket/p-1?title=${encodeURIComponent("Nasi & Ayam")}`);
    expect(reportHref(ISSUE, "Nadia Putri")).toBe(`/laporan/${ISSUE}?title=Nadia%20Putri`);
    expect(reportHref(ISSUE, null)).toBe(`/laporan/${ISSUE}`);
    expect(linkTitle({ id: "c-1", title: "Nadia Putri" })).toBe("Nadia Putri");
    expect(linkTitle({ id: "c-1" })).toBeUndefined();
    expect(linkTitle({ title: "" })).toBeUndefined();
    expect(linkTitle({ title: ["a", "b"] })).toBeUndefined();
    expect(linkTitle(undefined)).toBeUndefined();
  });

  it("linkTitle caps a long name at 60 characters, at a word where it can, with …", () => {
    const sixty = "Nasi Ayam Bakar Madu Sambal Matah Lalapan Komplit Rumahan AB";
    expect(sixty).toHaveLength(LINK_TITLE_MAX);
    expect(linkTitle({ title: sixty })).toBe(sixty);
    // One over: cut at the last space, so no word is broken.
    expect(linkTitle({ title: `${sixty}C` })).toBe("Nasi Ayam Bakar Madu Sambal Matah Lalapan Komplit Rumahan…");
    // No space past the halfway mark: cut mid-word, still 60 with the ….
    const capped = linkTitle({ title: "Nasi " + "a".repeat(80) })!;
    expect(Array.from(capped)).toHaveLength(LINK_TITLE_MAX);
    expect(capped.endsWith("…")).toBe(true);
    // Counted in code points: an emoji at the cut is kept whole or dropped, never split.
    const emoji = linkTitle({ title: "🍛".repeat(70) })!;
    expect(emoji).toBe(`${"🍛".repeat(59)}…`);
    // Spaces around and inside are tidied before counting; a blank name is no name.
    expect(linkTitle({ title: "  Nadia   Putri  " })).toBe("Nadia Putri");
    expect(linkTitle({ title: "   " })).toBeUndefined();
  });

  it("a read that fails or misses the record names the screen generically, never by the link's name", async () => {
    const { runtime } = require("../src/runtime");
    // Laporan and Pelanggan: the read answers without the record. Paket: the read fails.
    jest.spyOn(runtime.api, "request").mockImplementation(async () => []);
    jest.spyOn(runtime.api, "sellerCustomers").mockImplementation(async () => ({ customers: [], total: 0 }));
    jest.spyOn(runtime.api, "sellerOperations").mockImplementation(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    await open("/");
    for (const [href, route, name, generic] of TITLED) {
      await go(() => router.push(href as never));
      await waitFor(() => expect({ route, title: contentTitleOf(route) }).toEqual({ route, title: generic }));
      expect(within(screenOf(route) as never).queryByText(name)).toBeNull();
      await go(() => router.back());
    }
  });

  it("contentTitled: iOS keeps the title for the large title, Android empties the bar", () => {
    expect(contentTitled("Paket", "ios")).toEqual({ title: "Paket" });
    expect(contentTitled("Paket", "android")).toEqual({ title: "Paket", headerTitle: "" });
  });
});

describe("ScreenGuard under the native bar", () => {
  it("the guard's failure shows under the native bar with no second header", async () => {
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
    // A record that breaks while Uang draws it.
    mockSettlement.value = {
      get available(): number {
        throw new Error("bad value");
      },
    };
    await open("/");
    await go(() => router.push("/uang"));
    const message = await screen.findByText("Catatan uang belum bisa ditampilkan.");
    const uang = screenOf("uang");
    // One header for the screen, the native bar, titled Uang with the platform back.
    const bars = uang.findAll((n) => n.type === "RNSScreenStackHeaderConfig");
    expect(bars).toHaveLength(1);
    expect(bars[0].props).toMatchObject({ title: "Uang", hidden: false, hideBackButton: false });
    // The failure sits in the screen's body: no mood band and no header of its own, and it pays no top inset because
    // the bar above already does.
    expect(within(uang as never).queryByTestId("app-header")).toBeNull();
    expect(within(uang as never).queryByTestId("mood-header", { includeHiddenElements: true })).toBeNull();
    expect(within(uang as never).queryAllByRole("header")).toHaveLength(0);
    let frame = (message as unknown as Host).parent;
    while (frame && !Array.isArray(frame.props.edges)) frame = frame.parent;
    expect(frame?.props.edges).toEqual(["left", "right"]);
    expect(within(uang as never).getByRole("button", { name: "Coba lagi" })).toBeTruthy();
    errorLog.mockRestore();
  });
});
