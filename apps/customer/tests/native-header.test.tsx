import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createElement } from "react";
import { BackHandler, StatusBar, StyleSheet, Text } from "react-native";
import { renderHook } from "@testing-library/react-native";
import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, within } from "expo-router/testing-library";
import { jakartaDay, type Checkout } from "@catera/domain";
import { nativeThemes } from "@catera/design-tokens";
import { fonts, nativeHeaderOptions, statusBarStyle } from "@catera/mobile-ui";
import { goToTab } from "../src/nav";
import { contentTitled, linkTitle, useStackScreenOptions } from "../src/stack";
import { dayHref, packageHref, planHref } from "../src/hrefs";
import { customerState, offer } from "./fixtures";

// expo-router's testing library swaps in Reanimated's own jest mock, which has no useReducedMotion (setup.cjs adds it).
Object.assign(require("react-native-reanimated"), { useReducedMotion: () => false });

/**
 * The real route tree in `app/` with the real root layout (theme, mood, status bar, demo strip and the stack's header
 * options), the real tabs and the real stack inside each tab. The session is a stand-in: `mockSession` decides who is
 * signed in and whether the demo strip shows, and `mockReads` answers each data key once, as the real cache keeps a read
 * between renders. Screens whose own suites cover them are stand-ins, except the ones under test here.
 */
const mockStub = (name: string) => () => createElement(Text, { testID: "screen" }, name);
const mockSession = { demo: false, actor: null as null | { id: string; role: string; name: string } };
const mockReads = new Map<string, unknown>();
const mockRead = (key: string) => {
  if (!mockReads.has(key)) mockReads.set(key, { data: undefined, loading: true, error: "", reload: async () => undefined });
  return mockReads.get(key);
};
const answer = (key: string, data: unknown) =>
  mockReads.set(key, { data, loading: false, error: "", reload: async () => undefined });
const mockT = (id: string) => id;
const mockRuntime = { apiBase: "", api: {}, storageKey: (k: string) => `catera.${k}` };

jest.mock("@catera/mobile-core", () => ({
  useMobile: () => ({
    t: mockT,
    locale: "id",
    actor: mockSession.actor,
    ready: true,
    demo: mockSession.demo,
    runtime: mockRuntime,
    command: async () => ({}),
    logout: async () => undefined,
  }),
  useTrack: () => () => undefined,
  useData: (key: string) => mockRead(key),
  plural: (n: number, w: string) => `${n} ${w}`,
}));
jest.mock("expo-font", () => ({ ...jest.requireActual("expo-font"), useFonts: () => [true, null] }));
jest.mock("../src/runtime", () => ({ runtime: { storageKey: (k: string) => `catera.${k}` } }));
jest.mock("../src/shell", () => ({ AppProviders: ({ children }: { children: unknown }) => children }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  setNotificationHandler: jest.fn(),
}));
jest.mock("../src/account/push", () => ({ usePush: () => ({ on: null, busy: false, error: "", toggle: async () => undefined }) }));
jest.mock("../src/account/Addresses", () => ({ Addresses: mockStub("Alamat") }));
jest.mock("../src/account/Masuk", () => ({ Masuk: mockStub("Masuk") }));
jest.mock("../src/buy/BuyScreen", () => ({ BuyScreen: mockStub("Beli") }));
jest.mock("../src/discover/PackageDetail", () => ({ PackageDetail: mockStub("Paket") }));
jest.mock("../src/schedule/DayScreen", () => ({ DayScreen: mockStub("Hari") }));

const APP = join(__dirname, "..", "app");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
const appRoutes = () =>
  Object.fromEntries(files(APP).map((file) => [relative(APP, file).split(sep).join("/").replace(/\.tsx?$/, ""), require(file)]));

type Nav = { key: string; name: string; params?: Record<string, unknown>; state?: { key: string; index: number; routes: Nav[] } };
let state: () => { routes: Nav[] };

/** 16.00 in Jakarta: the mood opens on Malam. Only the clock is pinned. */
const pinMalam = () =>
  jest.useFakeTimers({
    now: new Date("2026-10-08T09:00:00Z"),
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval",
      "setTimeout", "clearTimeout",
    ],
  });

async function mount(initialUrl = "/") {
  // A cold start has no route behind it; the test router keeps the last render's route between renders.
  const { storeRef } = require("expo-router/build/global-state/store");
  if (storeRef.current) storeRef.current.routeInfo = undefined;
  const result = renderRouter(appRoutes() as never, { initialUrl });
  state = () => result.getRouterState() as unknown as { routes: Nav[] };
  await act(async () => {});
  return result;
}
const rootStack = () => {
  const top = state();
  return top.routes[0]?.name === "__root" && top.routes[0].state ? top.routes[0].state : (top as Nav["state"])!;
};
const root = () => rootStack().routes.map((r) => r.name);
const tabsState = () => rootStack().routes.find((r) => r.name === "(tabs)")?.state;
const tab = () => tabsState()?.routes[tabsState()!.index].name;
const go = async (work: () => void) => {
  act(work);
  await act(async () => {});
};

/** The native header the stack hands to react-native-screens, by the title it shows. */
type Host = { type: unknown; props: Record<string, unknown>; parent: Host | null; children: unknown[] };
const hosts = (type: string) => (screen.UNSAFE_root.findAll((n) => n.type === type) as unknown as Host[]);
const headers = () => hosts("RNSScreenStackHeaderConfig");
/** The header of the screen in front: the last one the root stack or the selected tab's stack rendered. */
const headerOf = (route: string) => {
  const screens = hosts("RNSScreen").filter((s) => String(s.props.screenId).startsWith(`${route}-`));
  const own = screens.at(-1);
  if (!own) throw new Error(`no screen for ${route}`);
  return own.findAll((n: Host) => n.type === "RNSScreenStackHeaderConfig")[0] as Host;
};
const screenOf = (route: string) => hosts("RNSScreen").filter((s) => String(s.props.screenId).startsWith(`${route}-`)).at(-1)!;

/** The status bar style in effect: React Native merges every mounted StatusBar and the newest one wins. */
const statusGlyphs = () => {
  const stack = (StatusBar as unknown as { _propsStack: { barStyle?: { value: string } }[] })._propsStack;
  return [...stack].reverse().find((e) => e.barStyle?.value)?.barStyle?.value;
};

const light = nativeThemes.light;

beforeEach(() => {
  mockReads.clear();
  mockSession.demo = false;
  mockSession.actor = null;
});
afterEach(() => {
  jest.useRealTimers();
});

describe("native headers on pushed screens", () => {
  it("pushed screens use the native header with the platform back button", async () => {
    await mount("/");
    await go(() => goToTab("akun"));
    await go(() => router.push("/alamat"));
    expect(screen.queryByTestId("app-header")).toBeNull();
    const header = headerOf("alamat");
    // Material's small top app bar: the platform back arrow, the title in Plus Jakarta Sans Bold 22 on the canvas.
    expect(header.props).toMatchObject({
      title: "Alamat",
      hidden: false,
      hideBackButton: false,
      hideShadow: true,
      backgroundColor: light.canvas,
      color: light.charcoal,
      titleColor: light.charcoal,
      titleFontFamily: fonts.bold,
      titleFontSize: 22,
      topInsetEnabled: true,
    });

    // Every stack's options are the shared helper's, plus the canvas behind the scenes.
    const { result } = renderHook(() => useStackScreenOptions());
    expect(result.current).toEqual({
      ...nativeHeaderOptions({ palette: light, demo: false }),
      contentStyle: { backgroundColor: light.canvas },
    });
    // iOS: the large title that collapses, the system back with no label, the same typeface at native sizes.
    expect(nativeHeaderOptions({ palette: light, demo: false, os: "ios" })).toEqual({
      headerLargeTitle: true,
      headerTransparent: true,
      headerShadowVisible: false,
      headerLargeTitleShadowVisible: false,
      headerBackButtonDisplayMode: "minimal",
      headerTintColor: light.forest,
      headerLargeStyle: { backgroundColor: light.canvas },
      headerStyle: { backgroundColor: light.canvas },
      headerLargeTitleStyle: { fontFamily: fonts.bold, fontSize: 34, color: light.forest },
      headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17, color: light.charcoal },
    });

    // The platform back returns to the tab root.
    await go(() =>
      router.back(),
    );
    expect(tabsState()?.routes.find((r) => r.name === "(akun)")?.state?.routes.map((r) => r.name)).toEqual(["akun"]);
  });

  it("with the demo strip the Android header adds no top inset", async () => {
    mockSession.demo = true;
    await mount("/");
    await go(() => router.push("/alamat"));
    expect(screen.getByLabelText("Demo · data sintetis")).toBeTruthy();
    expect(headerOf("alamat").props.topInsetEnabled).toBe(false);
    expect(nativeHeaderOptions({ palette: light, demo: true })).toMatchObject({ headerTopInsetEnabled: false });
    // The screen under the header adds no inset of its own either.
    const body = screen.getByText("Alamat");
    expect(body).toBeTruthy();
  });

  it("sign-in shows Close, labelled Tutup, at the leading edge", async () => {
    await mount("/");
    await go(() => goToTab("jadwal"));
    await go(() => router.push("/login"));
    expect(root()).toEqual(["(tabs)", "login"]);
    expect(screenOf("login").props.stackPresentation).toBe("modal");
    const header = headerOf("login");
    expect(header.props.hideBackButton).toBe(true);
    // The close sits in the header's leading slot, icon only, spoken "Tutup".
    const leading = header.findAll((n: Host) => n.type === "RNSScreenStackHeaderSubview" && n.props.type === "left")[0] as Host;
    expect(leading).toBeTruthy();
    const close = within(leading as never).getByRole("button", { name: "Tutup" });
    await go(() => fireEvent.press(close));
    expect(root()).toEqual(["(tabs)"]);
    expect(tab()).toBe("(jadwal)");
  });
});

describe("plan titles", () => {
  const LONG = "Paket Makan Siang Rumahan Sehat Sekeluarga Lima Hari";
  const plan = () =>
    customerState(null, { subscription: { id: "s1", snapshot: { offer: offer({ name: LONG }), total: 1 } as never } });

  it("Android shows the full plan name as the first content line and moves it into the bar on scroll", async () => {
    mockSession.actor = { id: "u1", role: "customer", name: "Rani Contoh" };
    answer("plan:customer", { data: plan(), savedAt: null });
    await mount("/");
    await go(() => router.push("/subscriptions/s1"));
    // The first line of the page is the whole name, in headline small (24/32), wrapping instead of truncating.
    const line = screen.getByTestId("screen-native-title");
    let scroll = (line as unknown as Host).parent;
    while (scroll && scroll.props.testID !== "screen-scroll") scroll = scroll.parent;
    if (!scroll) throw new Error("the content title is not in the screen's scroll view");
    const name = within(line).getByText(LONG);
    expect(StyleSheet.flatten(name.props.style)).toMatchObject({ fontFamily: fonts.bold, fontSize: 24, lineHeight: 32 });
    expect(name.props.numberOfLines).toBeUndefined();
    expect(within(scroll).getAllByText(/./)[0]).toBe(name);
    // The bar starts empty, takes the name once the line has scrolled under it, and lets go when it comes back.
    expect(headerOf("subscriptions/[id]").props.title).toBe("");
    await go(() => fireEvent(line, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 72 } } }));
    await go(() => fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: 120 } } }));
    expect(headerOf("subscriptions/[id]").props.title).toBe(LONG);
    await go(() => fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: 10 } } }));
    expect(headerOf("subscriptions/[id]").props.title).toBe("");
  });

  it("a plan link that carries its name never shows Paket", async () => {
    mockSession.actor = { id: "u1", role: "customer", name: "Rani Contoh" };
    // Still loading: the read has not come back.
    await mount("/");
    await go(() => router.push(planHref("s1", LONG)));
    expect(within(screen.getAllByTestId("screen-native-title").at(-1)!).getByText(LONG)).toBeTruthy();
    expect(screen.queryByText("Paket")).toBeNull();
    // The route's own title (iOS's large title) is the carried name too.
    expect(contentTitled(linkTitle({ title: LONG }) ?? "Paket", "ios")).toEqual({ title: LONG });
    // Every link that knows the name carries it; Hari carries its day, never "Hari".
    expect(planHref("s1", LONG)).toBe(`/subscriptions/s1?title=${encodeURIComponent(LONG)}`);
    expect(packageHref("p1", "Nasi Box")).toBe("/paket/p1?title=Nasi%20Box");
    expect(dayHref("d1", "2026-10-12", "id")).toBe(`/hari/d1?title=${encodeURIComponent("Senin 12 Okt")}`);
  });
});

describe("paid is final", () => {
  const future = () => new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const paid = (): Checkout =>
    ({
      id: "c1",
      state: "paid",
      subscription_id: "s1",
      expires_at: future(),
      payment_url: null,
      provider_environment: "sandbox",
      quote: { dates: ["2026-10-19", "2026-10-20"], total: 300000, offer: offer(), portions: 1, cycles: 1 },
      payment: { mode: "direct", status: "paid", availableMethods: ["QRIS"], selectedMethod: "QRIS", expiresAt: future() },
    }) as unknown as Checkout;

  /** Every hardware back listener still subscribed; a press runs them newest first until one handles it. */
  function hardwareBack() {
    const live: (() => boolean | null | undefined)[] = [];
    const spy = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
      live.push(handler);
      return { remove: () => void live.splice(live.indexOf(handler), 1) };
    });
    return {
      press: () => [...live].reverse().some((h) => h()),
      restore: () => spy.mockRestore(),
    };
  }

  /** Paket in Jelajah, then Beli, which replaces itself with Bayar, which turns paid. */
  async function paidAfterPurchase() {
    mockSession.actor = { id: "u1", role: "customer", name: "Rani Contoh" };
    answer("bayar:c1", paid());
    const app = await mount("/");
    await go(() => goToTab("jelajah"));
    await go(() => router.push("/paket/p1"));
    await go(() => router.push("/beli/p1"));
    await go(() => router.replace("/bayar/c1"));
    expect(root()).toEqual(["(tabs)", "bayar/[id]"]);
    expect(screen.getAllByText("Pembayaran diterima").length).toBeGreaterThan(0);
    return app;
  }
  const expectHome = (app: { getPathname: () => string }) => {
    expect(root()).toEqual(["(tabs)"]);
    expect(tab()).toBe("(index)");
    expect(app.getPathname()).toBe("/");
    expect(root()).not.toContain("beli/[id]");
  };

  it("paid Bayar: header back, iOS swipe and hardware back all replace to /", async () => {
    // The iOS swipe is off and the header shows no back once paid.
    let app = await paidAfterPurchase();
    expect(screenOf("bayar/[id]").props.gestureEnabled).toBe(false);
    expect(headerOf("bayar/[id]").props.hideBackButton).toBe(true);
    // The native header's back (a pop naming the screen) goes home, never back to Beli or the package.
    const bayar = rootStack().routes.find((r) => r.name === "bayar/[id]")!;
    await go(() =>
      require("expo-router/build/global-state/store").store.navigationRef.current.dispatch({
        type: "POP",
        payload: { count: 1 },
        source: bayar.key,
        target: rootStack().key,
      }),
    );
    expectHome(app);
    app.unmount();

    // Close in the header (a back) goes home too.
    app = await paidAfterPurchase();
    const close = within(headerOf("bayar/[id]") as never).getByRole("button", { name: "Tutup" });
    await go(() => fireEvent.press(close));
    expectHome(app);
    app.unmount();

    // The hardware back.
    const back = hardwareBack();
    try {
      app = await paidAfterPurchase();
      await go(() => void back.press());
      expectHome(app);
    } finally {
      back.restore();
    }
  });
});

describe("status bar", () => {
  it("status bar follows the mood on Beranda and the theme on a pushed screen", async () => {
    pinMalam();
    await mount("/");
    // Light theme, Malam: the dark mood header wants light glyphs.
    expect(statusBarStyle({ scheme: "light", mood: "malam", demo: false })).toBe("light");
    expect(statusGlyphs()).toBe("light-content");
    // A pushed screen sits on the light canvas: the theme's dark glyphs.
    await go(() => router.push("/alamat"));
    expect(statusGlyphs()).toBe("dark-content");
    expect(statusBarStyle({ scheme: "light", mood: null, demo: false })).toBe("dark");
    // Back on Beranda, the mood's glyphs again.
    await go(() => router.back());
    expect(statusGlyphs()).toBe("light-content");
  });
});

describe("tab roots", () => {
  /** Each tab root's mood header: the container, its top row and what the row holds. */
  function moodHeaders() {
    return screen.getAllByTestId("mood-header-row", { includeHiddenElements: true }).map((row) => {
      const content = (row as unknown as Host).parent as Host;
      return { row, content };
    });
  }

  async function everyTab() {
    mockSession.actor = { id: "u1", role: "customer", name: "Rani Contoh" };
    answer("home:customer", { data: customerState(null), savedAt: null });
    const today = jakartaDay(new Date());
    answer(`jadwal:${today.slice(0, 7)}`, customerState(null));
    await mount("/");
    for (const name of ["jadwal", "jelajah", "akun"] as const) await go(() => goToTab(name));
  }

  it("the four tab roots start their title at the same height", async () => {
    await everyTab();
    const found = moodHeaders();
    expect(found.length).toBeGreaterThanOrEqual(4);
    const pads = new Set<unknown>();
    for (const { row, content } of found) {
      // A 48dp row on every root, first in the header, with the title straight after it at the same gap.
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({ minHeight: 48 });
      expect(StyleSheet.flatten(content.props.style)).toMatchObject({ gap: 12 });
      pads.add(StyleSheet.flatten((content.parent as Host).props.style as never)?.paddingTop);
    }
    expect(pads.size).toBe(1);
  });

  it("no tab root repeats its own tab name in the meta line", async () => {
    await everyTab();
    const rows = moodHeaders().map(({ row }) =>
      within(row as never)
        .queryAllByText(/./, { includeHiddenElements: true })
        .map((t) => String(t.props.children)),
    );
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const words of rows) for (const name of ["Beranda", "Jadwal", "Jelajah", "Akun"]) expect(words).not.toContain(name);
  });
});
