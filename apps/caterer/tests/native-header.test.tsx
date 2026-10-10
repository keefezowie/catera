import * as ReactNative from "react-native";
import { StatusBar, Text } from "react-native";
import { act, fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import { appRoutes, resetRouterStore } from "./real-router";
import { router } from "expo-router";
import { nativeThemes } from "@catera/design-tokens";
import { fonts, MoodHeader, Screen } from "@catera/mobile-ui";

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

/**
 * The real layouts over stand-in screens. A tab root draws a mood header, as every Dapur tab root does, so the status
 * bar can be read on it; every other screen only names itself. Uang is the real screen, the only host of `ScreenGuard`.
 */
const routes = appRoutes((file) => {
  const name = file.replace(/\([^)]*\)\//g, "");
  if (name === "uang") return require("../app/(tabs)/(index,pelanggan,menu,usaha)/uang").default;
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

/** The status bar style in effect: React Native merges every mounted StatusBar and the newest one wins. */
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
      await go(() => fireEvent.press(close));
      expect(r.getPathname()).toBe("/");
    }
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
