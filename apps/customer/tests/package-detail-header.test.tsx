import { Fragment } from "react";
import { ActivityIndicator, StatusBar, StyleSheet } from "react-native";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { NavigationContext } from "expo-router/react-navigation";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { FadeSwap, LayoutScaleProvider, MoodProvider } from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { goToTab } from "../src/nav";
import { PackageDetail, photoPassed } from "../src/discover/PackageDetail";
import { offer } from "./fixtures";

/** A 411dp phone: the 4:3 photo is 308 tall. */
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 411, height: 860, scale: 3, fontScale: 1 }),
}));
let mockParams: Record<string, string> = {};
/** Tab changes and leaving a screen above the tabs go through nav (navigation.test covers them on the real router). */
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), goToTab: jest.fn(), leaveFor: jest.fn() }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
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

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const cheap = offer({ id: "p-murah", name: "Nasi Ayam Bakar", price: 25000 });
const MALAM = () => new Date("2026-10-09T08:00:00Z");
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

function runtimeWith(read: (id: string) => Promise<{ offer: unknown }>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    offer: jest.fn(read),
    request: jest.fn(async () => []),
    savedPackages: jest.fn(async () => ({ packageIds: [], items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}
/** The screen's own stack entry, as the native stack hands it over. */
const navigation = { setOptions: jest.fn(), isFocused: () => true, addListener: () => () => undefined };
const tree = (runtime: MobileRuntime) => (
  <NavigationContext.Provider value={navigation as never}>
    <LayoutScaleProvider value="v2">
      <MoodProvider now={MALAM}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <PackageDetail />
        </MobileProvider>
      </MoodProvider>
    </LayoutScaleProvider>
  </NavigationContext.Provider>
);
const wrap = (runtime: MobileRuntime) => render(tree(runtime));
type Bar = { headerLeft?: () => React.ReactElement; headerRight?: () => React.ReactElement };
const lastBar = () => navigation.setOptions.mock.calls.at(-1)![0] as Bar;
/** One of the stack's bar slots, drawn on its own as the stack does (inside the app's providers). */
const renderSlot = (runtime: MobileRuntime, ...slots: (() => React.ReactElement)[]) =>
  render(
    <LayoutScaleProvider value="v2">
      <MoodProvider now={MALAM}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          {slots.map((slot, i) => (
            <Fragment key={i}>{slot()}</Fragment>
          ))}
        </MobileProvider>
      </MoodProvider>
    </LayoutScaleProvider>,
  );
/** The screen's name: its Android content title (iOS shows it as the large title). */
const nativeTitle = async () => within(await screen.findByTestId("screen-native-title"));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: "p-murah" };
});

describe("Paket without a photo to lead with", () => {
  it("opens under the plain native header while the package loads, named Paket, with no mood fill even in Malam", async () => {
    const view = wrap(runtimeWith(() => new Promise(() => undefined)));
    const title = (await nativeTitle()).getByText("Paket");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title).color).toBe(nativeThemes.light.charcoal);
    expect(screen.queryByTestId("mood-fill-malam", { includeHiddenElements: true })).toBeNull();
    // The back is the platform's own, in the native header.
    expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull();
    // The page waits as the package skeleton, one progress bar, with no spinner.
    expect(screen.getByTestId("package-skeleton")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Memuat paket" })).toBeTruthy();
    expect(view.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it("a link that carries the package name shows it while loading, never Paket", async () => {
    mockParams = { id: "p-murah", title: "Nasi Ayam Bakar" };
    wrap(runtimeWith(() => new Promise(() => undefined)));
    expect((await nativeTitle()).getByText("Nasi Ayam Bakar")).toBeTruthy();
    expect(screen.queryByText("Paket")).toBeNull();
  });

  it("keeps its title when the package cannot be read, with the message and retry on the page", async () => {
    const read = jest.fn(async (): Promise<{ offer: unknown }> => {
      throw new Error("REQUEST_TIMEOUT");
    });
    wrap(runtimeWith(read));
    expect((await nativeTitle()).getByText("Paket")).toBeTruthy();
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    const before = read.mock.calls.length;
    fireEvent.press(retry);
    expect(read.mock.calls.length).toBeGreaterThan(before);
  });

  it("keeps its title when the package is not found and still offers Jelajah paket", async () => {
    wrap(runtimeWith(async () => ({ offer: null })));
    expect(await screen.findByText("Paket tidak ditemukan.")).toBeTruthy();
    expect((await nativeTitle()).getByText("Paket")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Jelajah paket" }));
    expect(goToTab).toHaveBeenCalledWith("jelajah");
  });
});

describe("Paket with its photo (ruling B3: the photo is the header)", () => {
  it("lays a transparent bar with no title over the photo, its back in light ink on a scrim", async () => {
    wrap(runtimeWith(async () => ({ offer: cheap })));
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    expect(navigation.setOptions).toHaveBeenLastCalledWith({
      headerTransparent: true,
      headerLargeTitle: false,
      headerTitle: "",
      headerShadowVisible: false,
      headerStyle: { backgroundColor: "transparent" },
      headerTintColor: nativeThemes.light.cream,
      headerLeft: expect.any(Function),
      headerRight: expect.any(Function),
    });
    expect(screen.queryByTestId("screen-native-title")).toBeNull();
    // The back on the photo is a 44 surface circle in the bar's leading slot (the platform's own returns past the photo).
    const options = navigation.setOptions.mock.calls.at(-1)![0] as { headerLeft: () => React.ReactElement };
    expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull();
    const scrim = screen.getByTestId("paket-photo-scrim");
    expect(flat(scrim)).toMatchObject({ position: "absolute", top: 0, left: 0, right: 0 });
    expect(String(flat(scrim).experimental_backgroundImage)).toMatch(/^linear-gradient\(rgba\(27,27,26,0\.6\)/);
    // The heart is in the bar's trailing slot now, not on the photo (a later test draws it).
    expect(screen.queryByRole("button", { name: "Simpan Nasi Ayam Bakar" })).toBeNull();
    expect(screen.getByText("Nasi Ayam Bakar")).toBeTruthy();
    // The bar's back, drawn on its own (the stack renders it): a 44 surface circle that goes back.
    render(<MoodProvider now={MALAM}>{options.headerLeft()}</MoodProvider>);
    const back = screen.getByRole("button", { name: "Kembali" });
    expect(flat(back)).toMatchObject({ width: 44, height: 44, borderRadius: 22 });
    expect(flat(back).borderWidth).toBeUndefined();
    fireEvent.press(back);
    expect(router.back).toHaveBeenCalled();
  });

  it("makes the photo exactly the page wide at 4:3: one horizontal pull and no vertical margin on the stretched box", async () => {
    wrap(runtimeWith(async () => ({ offer: cheap })));
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    const hero = flat(screen.getByTestId("paket-hero"));
    expect(hero).toMatchObject({ aspectRatio: 4 / 3, marginHorizontal: -16 });
    // Root cause of the 1080x852 photo on the emulator: Yoga sizes a stretched aspectRatio box from its outer height, so
    // a negative marginTop on it adds that much to the height (and 4/3 of it to the stretched width). The pull to the
    // top belongs to the wrapper alone.
    expect([hero.marginTop, hero.marginBottom, hero.marginVertical, hero.margin]).toEqual([undefined, undefined, undefined, undefined]);
    const swap = flat(screen.UNSAFE_getAllByType(FadeSwap)[0]);
    expect(swap).toMatchObject({ marginTop: -16, marginHorizontal: -16, paddingHorizontal: 16 });
    expect(swap.paddingTop).toBeUndefined();
    // Wrapper pull (-16) + its padding (16) + the photo's pull (-16): the photo reaches the screen edge and no further.
    expect((swap.marginHorizontal as number) + (swap.paddingHorizontal as number) + (hero.marginHorizontal as number)).toBe(-16);
  });

  it("puts back and heart in the bar as two 44 surface circles, the back leading and the heart trailing", async () => {
    const runtime = runtimeWith(async () => ({ offer: cheap }));
    wrap(runtime);
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    const bar = lastBar();
    expect(screen.queryByRole("button", { name: /^Simpan / })).toBeNull();
    renderSlot(runtime, bar.headerLeft!, bar.headerRight!);
    for (const name of ["Kembali", "Simpan Nasi Ayam Bakar"]) {
      const circle = flat(await screen.findByRole("button", { name }));
      expect(circle).toMatchObject({ width: 44, height: 44, borderRadius: 22, backgroundColor: nativeThemes.light.surface });
      expect(circle.borderWidth ?? 0).toBe(0);
      expect(circle.position).toBeUndefined();
    }
  });

  it("keeps the heart in the bar once the photo has scrolled away, and takes it out with the photo", async () => {
    const runtime = runtimeWith((id) => (id === "p-murah" ? Promise.resolve({ offer: cheap }) : new Promise(() => undefined)));
    const view = wrap(runtime);
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    fireEvent.scroll(screen.getByTestId("screen-scroll"), { nativeEvent: { contentOffset: { x: 0, y: photoPassed(411, 0) + 1 } } });
    expect(lastBar().headerRight).toEqual(expect.any(Function));
    expect(lastBar().headerLeft).toBeUndefined();
    mockParams = { id: "p-lain", title: "Nasi Liwet" };
    view.rerender(tree(runtime));
    expect((await nativeTitle()).getByText("Nasi Liwet")).toBeTruthy();
    expect(lastBar().headerRight).toBeUndefined();
  });

  it("keeps the bar slots the same functions across renders", async () => {
    const runtime = runtimeWith(async () => ({ offer: cheap }));
    const view = wrap(runtime);
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    const first = lastBar();
    view.rerender(tree(runtime));
    fireEvent.scroll(screen.getByTestId("screen-scroll"), { nativeEvent: { contentOffset: { x: 0, y: 5 } } });
    expect(lastBar().headerLeft).toBe(first.headerLeft);
    expect(lastBar().headerRight).toBe(first.headerRight);
  });

  it("saves from the bar heart: the label flips and the server is told", async () => {
    const runtime = runtimeWith(async () => ({ offer: cheap }));
    wrap(runtime);
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    renderSlot(runtime, lastBar().headerRight!);
    fireEvent.press(await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" }));
    expect(await screen.findByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" })).toBeTruthy();
    expect(runtime.api.command).toHaveBeenCalledWith("savedPackage.set", { packageId: "p-murah", saved: true }, expect.any(String));
  });

  it("sends a signed-out visitor to sign in and back to the package from the bar heart", async () => {
    const runtime = runtimeWith(async () => ({ offer: cheap }));
    (runtime.api as unknown as { me: jest.Mock }).me = jest.fn(async () => ({ actor: null, demo: false }));
    wrap(runtime);
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    renderSlot(runtime, lastBar().headerRight!);
    fireEvent.press(await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" }));
    expect(router.push).toHaveBeenCalledWith("/login?next=/paket/p-murah");
  });

  it("bursts the five dots from the centre of the 44 circle", async () => {
    const runtime = runtimeWith(async () => ({ offer: cheap }));
    wrap(runtime);
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    renderSlot(runtime, lastBar().headerRight!);
    const heart = await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" });
    fireEvent.press(heart);
    const dots = screen.getAllByTestId("heart-dot", { includeHiddenElements: true });
    expect(dots).toHaveLength(5);
    // The dots start at the middle of a 48 box (24, 24); the box must put that middle on the circle's centre.
    let host = dots[0].parent;
    while (host && (StyleSheet.flatten(host.props.style as never) as { width?: number } | undefined)?.width !== 48) host = host.parent;
    const box = flat(host as never);
    expect(box).toMatchObject({ position: "absolute", width: 48, height: 48 });
    const circle = flat(heart);
    expect([(box.left as number) + 24, (box.top as number) + 24]).toEqual([(circle.width as number) / 2, (circle.height as number) / 2]);
  });

  it("turns the bar opaque on the canvas once the photo has scrolled away, and back over the photo", async () => {
    const view = wrap(runtimeWith(async () => ({ offer: cheap })));
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    const scroll = screen.getByTestId("screen-scroll");
    const at = (y: number) => fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y } } });
    const lightGlyphs = () => view.UNSAFE_queryAllByType(StatusBar).some((s) => s.props.barStyle === "light-content");
    const overPhoto = {
      headerTransparent: true,
      headerLargeTitle: false,
      headerTitle: "",
      headerShadowVisible: false,
      headerStyle: { backgroundColor: "transparent" },
      headerTintColor: nativeThemes.light.cream,
      headerLeft: expect.any(Function),
      headerRight: expect.any(Function),
    };
    expect(lightGlyphs()).toBe(true);
    // The 4:3 photo is 308 tall on a 411 phone, with no status bar inset here; less the 56dp Android bar it is passed at 252.
    const PHOTO_PASSED = photoPassed(411, 0);
    expect(PHOTO_PASSED).toBe(308 - 56);
    at(PHOTO_PASSED - 1);
    expect(navigation.setOptions).toHaveBeenLastCalledWith(overPhoto);
    // The scrim rides under the bar while the photo scrolls beneath it, and stops at the photo's foot (308 - 140).
    const scrimShift = () => (flat(screen.getByTestId("paket-photo-scrim")).transform as { translateY: number }[])[0].translateY;
    at(60);
    expect(scrimShift()).toBe(60);
    at(PHOTO_PASSED - 1);
    expect(scrimShift()).toBe(308 - 140);
    // The name line sits 400dp down the page, 32dp tall.
    const name = screen.getByTestId("paket-name");
    let block = name.parent;
    while (block && (block.type !== "View" || !block.props.onLayout)) block = block.parent;
    fireEvent(block!, "layout", { nativeEvent: { layout: { x: 20, y: 400, width: 320, height: 60 } } });
    fireEvent(name, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 32 } } });
    const calls = navigation.setOptions.mock.calls.length;
    // Past the photo's foot cream ink would sit on the cream page, so the bar turns opaque in the theme's ink, and the
    // status bar takes the theme's glyphs back. The page has scrolled, so on Android the bar wears Material's scrolled
    // tone (the navigation bar's tabBar, #FFF7E9), as every pushed screen does. It stays transparent in layout terms, so
    // the page does not jump.
    at(PHOTO_PASSED);
    const onCanvas = {
      ...overPhoto,
      headerStyle: { backgroundColor: nativeThemes.light.tabBarAndroid },
      headerTintColor: nativeThemes.light.charcoal,
      // Past the photo the platform's own back returns.
      headerLeft: undefined,
    };
    expect(nativeThemes.light.tabBarAndroid).toBe("#E9E9E7");
    expect(navigation.setOptions).toHaveBeenLastCalledWith(onCanvas);
    expect(lightGlyphs()).toBe(false);
    // Once the name line has gone under the bar, the bar takes the name.
    at(400);
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ ...onCanvas, headerTitle: "Nasi Ayam Bakar" });
    // Only the crossings change the bar.
    at(600);
    at(800);
    expect(navigation.setOptions.mock.calls.length).toBe(calls + 2);
    // Back over the photo, the transparent bar and the light glyphs return.
    at(20);
    expect(navigation.setOptions).toHaveBeenLastCalledWith(overPhoto);
    expect(lightGlyphs()).toBe(true);
  });

  it("gives the stack's own bar back when the photo state is left", async () => {
    const runtime = runtimeWith((id) => (id === "p-murah" ? Promise.resolve({ offer: cheap }) : new Promise(() => undefined)));
    const view = wrap(runtime);
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    expect(navigation.setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ headerTransparent: true }));
    const PHOTO_PASSED = photoPassed(411, 0);
    // Scrolled past the photo first, so the bar is opaque when the photo state is left.
    fireEvent.scroll(screen.getByTestId("screen-scroll"), { nativeEvent: { contentOffset: { x: 0, y: PHOTO_PASSED + 10 } } });
    expect(navigation.setOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ headerStyle: { backgroundColor: nativeThemes.light.tabBarAndroid } }),
    );
    // Another package whose read has not come back: no photo to lead with, so the plain native header returns.
    mockParams = { id: "p-lain", title: "Nasi Liwet" };
    view.rerender(tree(runtime));
    expect((await nativeTitle()).getByText("Nasi Liwet")).toBeTruthy();
    expect(navigation.setOptions).toHaveBeenLastCalledWith({
      headerTransparent: false,
      headerLargeTitle: false,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: nativeThemes.light.canvas },
      headerTintColor: nativeThemes.light.charcoal,
      headerLeft: undefined,
      headerRight: undefined,
      headerTitle: "",
    });
    // Back to the first package: its photo leads again and the bar starts over the photo, not where it was left.
    mockParams = { id: "p-murah" };
    view.rerender(tree(runtime));
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    expect(navigation.setOptions).toHaveBeenLastCalledWith({
      headerTransparent: true,
      headerLargeTitle: false,
      headerTitle: "",
      headerShadowVisible: false,
      headerStyle: { backgroundColor: "transparent" },
      headerTintColor: nativeThemes.light.cream,
      headerLeft: expect.any(Function),
      headerRight: expect.any(Function),
    });
    expect(view.UNSAFE_queryAllByType(StatusBar).some((s) => s.props.barStyle === "light-content")).toBe(true);
  });
});
