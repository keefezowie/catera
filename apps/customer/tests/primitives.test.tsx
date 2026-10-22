import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ReactNative from "react-native";
import { AccessibilityInfo, AppState, Keyboard, StyleSheet, View } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { HeaderHeightContext, HeaderShownContext, NavigationContext } from "expo-router/react-navigation";
import { ScreenPresentationContext } from "expo-router/build/react-navigation/native-stack/utils/ScreenPresentationContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";
import { nativeThemes } from "@catera/design-tokens";
import {
  MascotLoading,
  MoodHeader,
  MoodProvider,
  Screen,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  StickyAction,
  Text,
  ThemeProvider,
  ToastProvider,
  TopInsetOwner,
  sheetOptions,
  useRowMotion,
  useToast,
  type ToastInput,
} from "@catera/mobile-ui";

// ThemeProvider reads a stored choice; none is stored, so it follows the (mocked) system scheme.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

beforeEach(() => {
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

/** A navigation stand-in whose focus the test drives, and whose navigator (and the ones above it) the test names. */
function fakeNavigation({ types = ["stack"], goBack = jest.fn() }: { types?: string[]; goBack?: () => void } = {}) {
  const listeners: Record<string, (() => void)[]> = { focus: [], blur: [] };
  let focused = true;
  const chain = (index: number): object | undefined =>
    index < types.length ? { getState: () => ({ type: types[index] }), getParent: () => chain(index + 1) } : undefined;
  const navigation = {
    ...chain(0),
    isFocused: () => focused,
    goBack,
    setOptions: jest.fn(),
    addListener: (event: string, cb: () => void) => {
      (listeners[event] ??= []).push(cb);
      return () => void listeners[event].splice(listeners[event].indexOf(cb), 1);
    },
  };
  const setFocused = (next: boolean) => {
    focused = next;
    act(() => listeners[next ? "focus" : "blur"].forEach((cb) => cb()));
  };
  return { navigation: navigation as never, setFocused };
}

describe("Skeleton", () => {
  it("skeleton blocks share one pulse and the group reads as a progress bar with its label", () => {
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    const timing = jest.spyOn(Reanimated, "withTiming");
    render(
      <SkeletonGroup label="Memuat paket">
        <Skeleton testID="block" height={20} />
        <Skeleton testID="block" height={14} width="60%" />
        <Skeleton testID="block" height={120} radius={20} />
      </SkeletonGroup>,
    );
    const group = screen.getByRole("progressbar");
    expect(group.props.accessibilityLabel).toBe("Memuat paket");
    // Three blocks, one loop: they all read the group's single shared value.
    expect(repeat).toHaveBeenCalledTimes(1);
    expect(repeat.mock.calls[0][1]).toBe(-1);
    // 1 to 0.55 to 1 over 1400ms: two 700ms halves.
    const halves = timing.mock.calls.map(([to, config]) => [to, (config as { duration?: number })?.duration]);
    expect(halves).toEqual(expect.arrayContaining([[0.55, 700], [1, 700]]));
    const blocks = screen.getAllByTestId("block", { includeHiddenElements: true });
    expect(blocks).toHaveLength(3);
    expect(flat(blocks[0])).toMatchObject({ height: 20, width: "100%", backgroundColor: nativeThemes.light.sage });
    expect(flat(blocks[1])).toMatchObject({ height: 14, width: "60%" });
    expect(flat(blocks[2])).toMatchObject({ height: 120, borderRadius: 20 });
  });

  it("skeleton is static under reduced motion", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    render(
      <SkeletonGroup label="Memuat jadwal">
        <Skeleton testID="block" height={20} />
        <Skeleton testID="block" height={20} />
      </SkeletonGroup>,
    );
    expect(repeat).not.toHaveBeenCalled();
    for (const block of screen.getAllByTestId("block", { includeHiddenElements: true }))
      expect(flat(block)).toMatchObject({ opacity: 0.75 });
  });

  it("a skeleton on a mood surface takes the mood's arc track", () => {
    render(
      <SkeletonGroup label="Memuat dapur">
        <Skeleton testID="block" height={40} onMood />
      </SkeletonGroup>,
    );
    // Light Siang arc track (the toggle track is the card colour now and would vanish on the header).
    expect(flat(screen.getByTestId("block", { includeHiddenElements: true }))).toMatchObject({ backgroundColor: "#C9C6BA" });
  });
});

describe("MascotLoading", () => {
  // The jest AppState stand-in has no current state; a running app reports "active" at launch.
  const appState = AppState as unknown as { currentState: unknown };
  const initialState = appState.currentState;
  beforeEach(() => {
    appState.currentState = "active";
  });
  afterEach(() => {
    appState.currentState = initialState;
  });
  const visual = () => screen.getByTestId("mascot-loading-visual", { includeHiddenElements: true });
  const rig = () => screen.getByTestId("mascot-rig", { includeHiddenElements: true });
  const poster = () => screen.getByTestId("mascot-poster", { includeHiddenElements: true });
  const loadLayers = () => {
    for (const layer of screen.getAllByTestId("mascot-layer", { includeHiddenElements: true })) fireEvent(layer, "load");
  };

  it("mascot shows its label at once and its art after 300ms", () => {
    jest.useFakeTimers();
    render(<MascotLoading label="Menyiapkan Catera…" />);
    // The status is spoken at once; the drawing waits 300ms so a fast answer shows nothing.
    expect(screen.getByRole("progressbar").props.accessibilityLabel).toBe("Menyiapkan Catera…");
    expect(flat(visual())).toMatchObject({ opacity: 0 });
    act(() => jest.advanceTimersByTime(299));
    expect(flat(visual())).toMatchObject({ opacity: 0 });
    act(() => jest.advanceTimersByTime(1));
    expect(flat(visual())).toMatchObject({ opacity: 1 });
    // The art is the default 140 square; it plays once every layer has loaded.
    expect(flat(screen.getByTestId("mascot-art", { includeHiddenElements: true }))).toMatchObject({ width: 140, height: 140 });
    expect(flat(rig())).toMatchObject({ opacity: 0 });
    loadLayers();
    expect(flat(rig())).toMatchObject({ opacity: 1 });
    expect(flat(poster())).toMatchObject({ opacity: 0 });
  });

  it("an answer before 300ms clears the reveal timer and nothing is left running", () => {
    jest.useFakeTimers();
    const clear = jest.spyOn(global, "clearTimeout");
    const cancel = jest.spyOn(Reanimated, "cancelAnimation");
    const view = render(<MascotLoading label="Memeriksa kode…" />);
    act(() => jest.advanceTimersByTime(100));
    view.unmount();
    expect(clear).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("mascot under reduced motion shows the neutral pose", () => {
    jest.useFakeTimers();
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    render(<MascotLoading label="Memuat" />);
    act(() => jest.advanceTimersByTime(300));
    loadLayers();
    expect(flat(visual())).toMatchObject({ opacity: 1 });
    expect(flat(poster())).toMatchObject({ opacity: 1 });
    expect(flat(rig())).toMatchObject({ opacity: 0 });
    expect(repeat).not.toHaveBeenCalled();
  });

  it("mascot pauses on the neutral pose when its screen loses focus or the app goes to the background", () => {
    jest.useFakeTimers();
    let onState: (state: string) => void = () => {};
    const removeState = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, cb) => {
      onState = cb as (state: string) => void;
      return { remove: removeState } as never;
    });
    const listeners: Record<string, (() => void)[]> = { focus: [], blur: [] };
    let focused = true;
    const navigation = {
      isFocused: () => focused,
      addListener: (event: string, cb: () => void) => {
        listeners[event].push(cb);
        return () => void listeners[event].splice(listeners[event].indexOf(cb), 1);
      },
    };
    const view = render(
      <NavigationContext.Provider value={navigation as never}>
        <MascotLoading label="Memuat" />
      </NavigationContext.Provider>,
    );
    act(() => jest.advanceTimersByTime(300));
    act(() => onState("active"));
    loadLayers();
    expect(flat(rig())).toMatchObject({ opacity: 1 });
    focused = false;
    act(() => listeners.blur.forEach((cb) => cb()));
    expect(flat(rig())).toMatchObject({ opacity: 0 });
    expect(flat(poster())).toMatchObject({ opacity: 1 });
    focused = true;
    act(() => listeners.focus.forEach((cb) => cb()));
    expect(flat(rig())).toMatchObject({ opacity: 1 });
    act(() => onState("background"));
    expect(flat(rig())).toMatchObject({ opacity: 0 });
    act(() => onState("active"));
    expect(flat(rig())).toMatchObject({ opacity: 1 });
    // A layer that fails keeps the neutral poster.
    fireEvent(screen.getAllByTestId("mascot-layer", { includeHiddenElements: true })[0], "error");
    expect(flat(rig())).toMatchObject({ opacity: 0 });
    view.unmount();
    expect(removeState).toHaveBeenCalledTimes(1);
    expect(listeners.blur).toHaveLength(0);
  });

  it("the mascot rests on the poster while the app is not active at mount, and plays once it is", () => {
    jest.useFakeTimers();
    appState.currentState = "inactive";
    let onState: (state: string) => void = () => {};
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, cb) => {
      onState = cb as (state: string) => void;
      return { remove: jest.fn() } as never;
    });
    render(<MascotLoading label="Memuat" />);
    act(() => jest.advanceTimersByTime(300));
    loadLayers();
    // "inactive" is not in front, at mount exactly as on a change.
    expect(flat(rig())).toMatchObject({ opacity: 0 });
    expect(flat(poster())).toMatchObject({ opacity: 1 });
    act(() => onState("active"));
    expect(flat(rig())).toMatchObject({ opacity: 1 });
    act(() => onState("inactive"));
    expect(flat(rig())).toMatchObject({ opacity: 0 });
  });

  it("in the dark theme the mascot's words and the startup canvas read the dark palette", () => {
    jest.useFakeTimers();
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const dark = nativeThemes.dark;
    const view = render(
      <ThemeProvider storageKey="primitives-theme">
        <MascotLoading label="Memeriksa pembayaran…" />
      </ThemeProvider>,
    );
    act(() => jest.advanceTimersByTime(300));
    expect(flat(screen.getByText("Memeriksa pembayaran…", { includeHiddenElements: true }))).toMatchObject({
      color: dark.charcoal,
    });
    // Away from launch it draws on whatever the screen paints.
    expect(flat(screen.getByTestId("mascot-loading")).backgroundColor).toBeUndefined();
    view.unmount();
    render(
      <ThemeProvider storageKey="primitives-theme">
        <MascotLoading label="Menyiapkan Catera…" startup />
      </ThemeProvider>,
    );
    expect(flat(screen.getByTestId("mascot-loading"))).toMatchObject({ backgroundColor: dark.canvas });
    const label = screen.getByText("Menyiapkan Catera…", { includeHiddenElements: true });
    expect(flat(label)).toMatchObject({ color: dark.charcoal });
    expect(flat(label).fontFamily).toBeUndefined();
  });

  it("the startup mascot fills the canvas and its label uses the system font", () => {
    jest.useFakeTimers();
    render(<MascotLoading label="Menyiapkan Catera…" startup size={160} />);
    expect(flat(screen.getByTestId("mascot-loading"))).toMatchObject({ backgroundColor: nativeThemes.light.canvas });
    const label = screen.getByText("Menyiapkan Catera…", { includeHiddenElements: true });
    expect(flat(label).fontFamily).toBeUndefined();
    expect(flat(screen.getByTestId("mascot-art", { includeHiddenElements: true }))).toMatchObject({ width: 160 });
  });
});

describe("Toast", () => {
  let toast: { show: (input: ToastInput) => void; hide: () => void };
  function Grab() {
    toast = useToast();
    return null;
  }
  const mount = (os: string) =>
    render(
      <ToastProvider os={os}>
        <View />
        <Grab />
      </ToastProvider>,
    );
  beforeEach(() => {
    // The AccessibilityInfo stand-ins are jest.fn's, so a spy changes them in place and restoreAllMocks keeps the
    // change: each test starts with the screen reader off.
    jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(false);
    jest.mocked(AccessibilityInfo.getRecommendedTimeoutMillis).mockResolvedValue(5000);
    jest.mocked(AccessibilityInfo.addEventListener).mockImplementation(() => ({ remove: jest.fn() }) as never);
    // This jest run is Android, where react-native-screens warns that FullWindowOverlay is iOS-only.
    const warn = console.warn;
    jest.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("FullWindowOverlay")) return;
      warn(...args);
    });
  });

  // A phone with a 47pt status bar and a 34pt home indicator or gesture inset.
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
  const tree = (os: string, ui: ReactNode) => (
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider storageKey="primitives-theme">
        <MoodProvider now={() => new Date("2026-10-09T07:59:00Z")}>
          <ToastProvider os={os}>
            {ui}
            <Grab />
          </ToastProvider>
        </MoodProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
  const layout = (testID: string, height: number) =>
    fireEvent(screen.getByTestId(testID, { includeHiddenElements: true }), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height } },
    });
  const lane = () => flat(screen.getByTestId("toast"));

  it("a second toast replaces the first and each is announced once", () => {
    jest.useFakeTimers();
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    mount("android");
    act(() => toast.show({ message: "Disimpan" }));
    expect(screen.getByText("Disimpan")).toBeTruthy();
    act(() => toast.show({ message: "Alamat disimpan" }));
    expect(screen.queryByText("Disimpan")).toBeNull();
    expect(screen.getByText("Alamat disimpan")).toBeTruthy();
    expect(screen.getAllByTestId("toast")).toHaveLength(1);
    expect(announce.mock.calls).toEqual([["Disimpan"], ["Alamat disimpan"]]);
  });

  it("a toast with an action stays 5 seconds, without one 3 seconds", () => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    mount("android");
    act(() => toast.show({ message: "Alamat disimpan" }));
    act(() => jest.advanceTimersByTime(2999));
    expect(screen.queryByText("Alamat disimpan")).not.toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByText("Alamat disimpan")).toBeNull();

    const onPress = jest.fn();
    act(() => toast.show({ message: "Laporan terkirim", action: { label: "Lihat", onPress } }));
    act(() => jest.advanceTimersByTime(4999));
    expect(screen.queryByText("Laporan terkirim")).not.toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByText("Laporan terkirim")).toBeNull();

    // The action runs once and closes the toast; nothing is left waiting.
    act(() => toast.show({ message: "Dihapus dari simpanan", action: { label: "Urungkan", onPress } }));
    fireEvent.press(screen.getByRole("button", { name: "Urungkan" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Dihapus dari simpanan")).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("toast sits under the header on iOS and above the tab bar on Android", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const ios = mount("ios");
    act(() => toast.show({ message: "Disimpan" }));
    // No inset in Jest: the 44pt bar plus an 8pt gap. The pill hugs its words in the centre of the lane.
    const iosLane = flat(screen.getByTestId("toast"));
    expect(iosLane).toMatchObject({ position: "absolute", top: 52, start: 16, end: 16, alignItems: "center" });
    expect(iosLane.bottom).toBeUndefined();
    const pill = flat(screen.getByTestId("toast-surface"));
    expect(pill).toMatchObject({ borderRadius: 22, minHeight: 44, backgroundColor: nativeThemes.light.toast });
    expect(pill.width).toBeUndefined();
    ios.unmount();

    mount("android");
    act(() => toast.show({ message: "Disimpan" }));
    // The 80dp navigation bar plus an 8dp gap; the snackbar fills the lane up to 600dp.
    const androidLane = flat(screen.getByTestId("toast"));
    expect(androidLane).toMatchObject({ bottom: 88, start: 16, end: 16 });
    expect(androidLane.top).toBeUndefined();
    expect(flat(screen.getByTestId("toast-surface"))).toMatchObject({
      borderRadius: 4,
      minHeight: 48,
      width: "100%",
      maxWidth: 600,
      backgroundColor: nativeThemes.light.toast,
    });
  });

  it("on iOS the toast lives in a full-window overlay above sheets; on Android it draws last in the app's window", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const ios = mount("ios");
    act(() => toast.show({ message: "Disimpan" }));
    expect(screen.UNSAFE_getAllByType(FullWindowOverlay)).toHaveLength(1);
    ios.unmount();
    mount("android");
    act(() => toast.show({ message: "Disimpan" }));
    expect(screen.UNSAFE_queryAllByType(FullWindowOverlay)).toHaveLength(0);
  });

  it("on iOS the toast sits under a tab root's MoodHeader, and goes back to the bar's place when the screen blurs", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const nav = fakeNavigation({ types: ["stack", "tab"] });
    const header = (owned: boolean) =>
      tree(
        "ios",
        <NavigationContext.Provider value={nav.navigation}>
          <TopInsetOwner owned={owned}>
            <MoodHeader title="Halo, Sari" meta="Jumat 9 Okt" toggle />
          </TopInsetOwner>
        </NavigationContext.Provider>,
      );
    const view = render(header(false));
    act(() => toast.show({ message: "Alamat disimpan" }));
    // Before the header is laid out: under a standard bar, 47 + 44 + 8.
    expect(lane().top).toBe(99);
    // The header pays the status bar inside its own 196: the pill starts 8 under its bottom edge, clear of the
    // headline and the toggle.
    layout("mood-header", 196);
    expect(lane().top).toBe(204);
    // Under the demo strip the header starts below the strip (47 + 24).
    view.rerender(header(true));
    layout("mood-header", 149);
    expect(lane().top).toBe(47 + 24 + 149 + 8);
    // A pushed screen covers the tab root: its anchor goes with its focus.
    nav.setFocused(false);
    expect(lane().top).toBe(99);
  });

  it("on iOS the toast sits under the large title and follows it as it collapses into the bar", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const stack = (height: number) =>
      tree(
        "ios",
        <HeaderShownContext.Provider value>
          <HeaderHeightContext.Provider value={height}>
            <Screen nativeTitle="Pengaturan">
              <Text>Isi</Text>
            </Screen>
          </HeaderHeightContext.Provider>
        </HeaderShownContext.Provider>,
      );
    const view = render(stack(47 + 96));
    act(() => toast.show({ message: "Bahasa diganti" }));
    // The large title is out: the pill sits under it, not over it.
    expect(lane().top).toBe(47 + 96 + 8);
    // Scrolled: the native header reports the inline bar, and the pill moves up under it.
    view.rerender(stack(47 + 44));
    expect(lane().top).toBe(47 + 44 + 8);
  });

  // The native stack's own context: each route's `presentation` option, as NativeStackView provides it.
  const presented = (presentation: string, ui: ReactNode) => (
    <ScreenPresentationContext.Provider value={presentation as never}>{ui}</ScreenPresentationContext.Provider>
  );
  const stackScreen = (footer?: ReactNode) => (
    <HeaderShownContext.Provider value>
      {/* A sheet's bar is measured inside the sheet: 56, no status bar. */}
      <HeaderHeightContext.Provider value={56}>
        <Screen nativeTitle="Masuk" footer={footer}>
          <Text>Isi</Text>
        </Screen>
      </HeaderHeightContext.Provider>
    </HeaderShownContext.Provider>
  );

  it("in an iOS sheet the toast shows at the bottom, above the home indicator and a footer", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const keyboard: Record<string, (e: { endCoordinates: { height: number } }) => void> = {};
    jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: never) => {
      keyboard[event] = cb;
      return { remove: jest.fn() };
    }) as never);
    render(tree("ios", presented("modal", stackScreen(<StickyAction label="Kirim kode" onPress={() => {}} />))));
    act(() => toast.show({ message: "Kode terkirim" }));
    // Never on the sheet's own bar: no top at all, and 8 above the 34pt home indicator before the footer is laid out.
    expect(lane().top).toBeUndefined();
    expect(lane()).toMatchObject({ bottom: 34 + 8 });
    // Above the 96 footer.
    layout("screen-footer", 96);
    expect(lane()).toMatchObject({ bottom: 34 + 96 + 8 });
    // The keyboard (336, covering the home indicator) lifts the footer and the toast with it.
    act(() => keyboard.keyboardWillShow({ endCoordinates: { height: 336 } }));
    expect(lane()).toMatchObject({ bottom: 34 + 96 + (336 - 34) + 8 });
    act(() => keyboard.keyboardWillHide({ endCoordinates: { height: 0 } }));
    expect(lane()).toMatchObject({ bottom: 34 + 96 + 8 });
  });

  it("an iOS form sheet with only its SheetHeader also shows its toast at the bottom", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    render(tree("ios", presented("formSheet", <SheetHeader title="Ada masalah" os="ios" />)));
    act(() => toast.show({ message: "Laporan terkirim" }));
    expect(lane().top).toBeUndefined();
    expect(lane()).toMatchObject({ bottom: 34 + 8 });
  });

  it("in an Android sheet the snackbar sits on the system inset: there is no tab bar under a sheet", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    render(tree("android", presented("formSheet", <SheetHeader title="Ada masalah" os="android" />)));
    act(() => toast.show({ message: "Laporan terkirim" }));
    // 8 above the 34dp gesture inset, not the 80dp tab bar's fallback.
    expect(lane()).toMatchObject({ bottom: 34 + 8 });
    expect(lane().top).toBeUndefined();
  });

  it("full-screen stack screens keep the top anchor", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    for (const presentation of ["card", "fullScreenModal"]) {
      const view = render(tree("ios", presented(presentation, stackScreen())));
      act(() => toast.show({ message: "Disimpan" }));
      // Under the bar the stack reports (from the window's top on a full-screen screen).
      expect(lane()).toMatchObject({ top: 56 + 8 });
      expect(lane().bottom).toBeUndefined();
      view.unmount();
    }
  });

  it("on Android the snackbar sits above a StickyAction footer", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    render(
      tree(
        "android",
        <Screen footer={<StickyAction label="Bayar" onPress={() => {}} />}>
          <Text>Isi</Text>
        </Screen>,
      ),
    );
    act(() => toast.show({ message: "Kode promo dipakai" }));
    // Outside the tabs the screen runs to the gesture inset (34); the footer is 96 tall; 8 above it.
    layout("screen-footer", 96);
    expect(lane()).toMatchObject({ bottom: 34 + 96 + 8 });
    expect(lane().top).toBeUndefined();
  });

  it("on Android with no tab bar the snackbar sits on the system inset, and inside the tabs above the tab bar", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const page = (types: string[]) =>
      tree(
        "android",
        <NavigationContext.Provider value={fakeNavigation({ types }).navigation}>
          <Screen>
            <Text>Isi</Text>
          </Screen>
        </NavigationContext.Provider>,
      );
    const view = render(page(["stack"]));
    act(() => toast.show({ message: "Laporan terkirim" }));
    // A modal or full-screen flow: no 80dp tab bar to clear, only the gesture inset.
    expect(lane()).toMatchObject({ bottom: 34 + 8 });
    view.unmount();
    render(page(["stack", "tab", "stack"]));
    act(() => toast.show({ message: "Laporan terkirim" }));
    expect(lane()).toMatchObject({ bottom: 34 + 80 + 8 });
  });

  it("with a screen reader on, an action toast speaks its action and stays for the recommended time", async () => {
    jest.useFakeTimers();
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
    const recommended = jest.spyOn(AccessibilityInfo, "getRecommendedTimeoutMillis").mockResolvedValue(20000);
    mount("android");
    await act(async () => {});
    const onPress = jest.fn();
    act(() => toast.show({ message: "Dihapus dari simpanan", action: { label: "Urungkan", onPress } }));
    expect(announce).toHaveBeenLastCalledWith("Dihapus dari simpanan, Urungkan");
    expect(recommended).toHaveBeenCalledWith(5000);
    await act(async () => {});
    // Android: the user's own accessibility timeout, not 5s.
    act(() => jest.advanceTimersByTime(19999));
    expect(screen.queryByText("Dihapus dari simpanan")).not.toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByText("Dihapus dari simpanan")).toBeNull();

    // A toast without an action keeps its 3s; a timeout that answers after the action toast was replaced sets nothing.
    act(() => toast.show({ message: "Dihapus dari simpanan", action: { label: "Urungkan", onPress } }));
    act(() => toast.show({ message: "Alamat disimpan" }));
    expect(announce).toHaveBeenLastCalledWith("Alamat disimpan");
    await act(async () => {});
    act(() => jest.advanceTimersByTime(3000));
    expect(screen.queryByText("Alamat disimpan")).toBeNull();
    expect(jest.getTimerCount()).toBe(0);

    // Using the action closes it at once, and its long timeout is cleared with it (a later toast is not cut short).
    act(() => toast.show({ message: "Dihapus dari simpanan", action: { label: "Urungkan", onPress } }));
    await act(async () => {});
    const clear = jest.spyOn(global, "clearTimeout");
    fireEvent.press(screen.getByRole("button", { name: "Urungkan" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Dihapus dari simpanan")).toBeNull();
    expect(clear).toHaveBeenCalled();
    act(() => toast.show({ message: "Alamat disimpan" }));
    act(() => jest.advanceTimersByTime(2999));
    expect(screen.queryByText("Alamat disimpan")).not.toBeNull();
  });

  it("on iOS a screen reader turned on later holds an action toast 10 seconds", async () => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    let onReader: (on: boolean) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((event: string, cb: (on: boolean) => void) => {
      if (event !== "screenReaderChanged") return { remove: () => {} };
      onReader = cb;
      return { remove };
    }) as never);
    const view = mount("ios");
    await act(async () => {});
    // Off: the plain 5s.
    act(() => toast.show({ message: "Laporan terkirim", action: { label: "Lihat", onPress: () => {} } }));
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.queryByText("Laporan terkirim")).toBeNull();
    act(() => onReader(true));
    act(() => toast.show({ message: "Laporan terkirim", action: { label: "Lihat", onPress: () => {} } }));
    act(() => jest.advanceTimersByTime(9999));
    expect(screen.queryByText("Laporan terkirim")).not.toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByText("Laporan terkirim")).toBeNull();
    view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("toast text wraps and its action stays on one line; an error carries its mark", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    mount("android");
    act(() => toast.show({ message: "Laporan terkirim ke katerer", action: { label: "Lihat", onPress: () => {} } }));
    const message = screen.getByText("Laporan terkirim ke katerer");
    expect(message.props.numberOfLines).toBeUndefined();
    expect(flat(message)).toMatchObject({ flexShrink: 1, color: nativeThemes.light.onToast });
    const action = screen.getByText("Lihat");
    expect(action.props.numberOfLines).toBe(1);
    expect(flat(action)).toMatchObject({ color: nativeThemes.light.toastAction });
    expect(screen.queryByTestId("toast-error")).toBeNull();
    act(() => toast.show({ message: "Belum bisa terhubung", tone: "error" }));
    expect(screen.getByTestId("toast-error", { includeHiddenElements: true })).toBeTruthy();
  });

  it("in the dark theme the toast, the skeleton and the sheet title read the dark palette", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const dark = nativeThemes.dark;
    render(
      <ThemeProvider storageKey="primitives-theme">
        <ToastProvider os="android">
          <SkeletonGroup label="Memuat paket">
            <Skeleton testID="block" height={20} />
          </SkeletonGroup>
          <SheetHeader title="Bahasa" os="android" />
          <Grab />
        </ToastProvider>
      </ThemeProvider>,
    );
    act(() => toast.show({ message: "Tampilan: Gelap", action: { label: "Lihat", onPress: () => {} } }));
    expect(flat(screen.getByTestId("toast-surface"))).toMatchObject({ backgroundColor: dark.toast });
    expect(flat(screen.getByText("Tampilan: Gelap"))).toMatchObject({ color: dark.onToast });
    expect(flat(screen.getByText("Lihat"))).toMatchObject({ color: dark.toastAction });
    expect(flat(screen.getByTestId("block", { includeHiddenElements: true }))).toMatchObject({ backgroundColor: dark.sage });
    expect(flat(screen.getByRole("header"))).toMatchObject({ color: dark.charcoal });
  });

  it("toast enters and leaves with motion, and appears at once under reduced motion", () => {
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    mount("android");
    act(() => toast.show({ message: "Disimpan" }));
    expect(screen.getByTestId("toast").props.entering).toBeDefined();
    expect(screen.getByTestId("toast").props.exiting).toBeDefined();
    act(() => toast.hide());
    expect(screen.queryByTestId("toast")).toBeNull();
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    act(() => toast.show({ message: "Disimpan" }));
    expect(screen.getByTestId("toast").props.entering).toBeUndefined();
    expect(screen.getByTestId("toast").props.exiting).toBeUndefined();
  });
});

describe("row motion", () => {
  let motion: ReturnType<typeof useRowMotion>;
  function Grab() {
    motion = useRowMotion();
    return null;
  }

  it("row motion is undefined under reduced motion", () => {
    render(<Grab />);
    expect(motion.entering).toBeDefined();
    expect(motion.exiting).toBeDefined();
    expect(motion.layout).toBeDefined();
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    render(<Grab />);
    expect(motion).toEqual({ entering: undefined, exiting: undefined, layout: undefined });
  });
});

describe("sheets", () => {
  const palette = nativeThemes.dark;

  it("sheetOptions fit uses fitToContents and a 28 corner only on Android", () => {
    const android = sheetOptions({ detents: "fit", palette, os: "android" });
    expect(android).toEqual({
      presentation: "formSheet",
      sheetGrabberVisible: true,
      sheetAllowedDetents: "fitToContents",
      sheetCornerRadius: 28,
      contentStyle: { backgroundColor: palette.surface },
      headerShown: false,
    });
    const ios = sheetOptions({ detents: "fit", palette, os: "ios" });
    expect(ios.sheetAllowedDetents).toBe("fitToContents");
    expect(ios).not.toHaveProperty("sheetCornerRadius");
    expect(sheetOptions({ detents: "form", palette, os: "ios" }).sheetAllowedDetents).toEqual([0.6, 1]);
    expect(sheetOptions({ detents: "form", palette, os: "android" }).sheetAllowedDetents).toEqual([0.6, 1]);
    // The day sheet opens at three quarters and expands to the full height.
    expect(sheetOptions({ detents: "day", palette, os: "ios" }).sheetAllowedDetents).toEqual([0.75, 1]);
    expect(sheetOptions({ detents: "day", palette, os: "android" }).sheetAllowedDetents).toEqual([0.75, 1]);
  });

  it("SheetHeader shows Close on iOS and a drag handle on Android", () => {
    const onClose = jest.fn();
    const ios = render(<SheetHeader title="Ada masalah" context="Senin 12 Okt" onClose={onClose} os="ios" />);
    fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("sheet-handle")).toBeNull();
    const iosTitle = screen.getByRole("header");
    expect(flat(iosTitle)).toMatchObject({ fontSize: 17, textAlign: "center", fontFamily: "Jakarta-Bold" });
    expect(screen.getByText("Senin 12 Okt")).toBeTruthy();
    ios.unmount();

    render(<SheetHeader title="Ada masalah" onClose={onClose} os="android" />);
    expect(screen.queryByRole("button", { name: "Tutup" })).toBeNull();
    const handle = screen.getByTestId("sheet-handle", { includeHiddenElements: true });
    expect(flat(handle)).toMatchObject({ width: 32, height: 4 });
    expect(flat(screen.getByTestId("sheet-handle-band", { includeHiddenElements: true }))).toMatchObject({ height: 36 });
    expect(flat(screen.getByRole("header"))).toMatchObject({ fontSize: 22, textAlign: "left", fontFamily: "Jakarta-Bold" });
  });

  it("the iOS SheetHeader reads the dark palette", () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const dark = nativeThemes.dark;
    render(
      <ThemeProvider storageKey="primitives-theme">
        <SheetHeader title="Ada masalah" context="Senin 12 Okt" onClose={() => {}} os="ios" />
      </ThemeProvider>,
    );
    expect(flat(screen.getByRole("header"))).toMatchObject({ color: dark.charcoal });
    expect(flat(screen.getByText("Senin 12 Okt"))).toMatchObject({ color: dark.muted });
    expect(screen.UNSAFE_getByType(Ionicons).props.color).toBe(dark.forest);
  });

  it("Close without onClose goes back in the sheet's stack", () => {
    const goBack = jest.fn();
    render(
      <NavigationContext.Provider value={fakeNavigation({ goBack }).navigation}>
        <SheetHeader title="Ada masalah" os="ios" />
      </NavigationContext.Provider>,
    );
    fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
