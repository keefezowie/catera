import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { AccessibilityInfo, AppState, StyleSheet, View } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { NavigationContext } from "expo-router/react-navigation";
import { nativeThemes } from "@catera/design-tokens";
import {
  MascotLoading,
  SheetHeader,
  Skeleton,
  SkeletonGroup,
  ThemeProvider,
  ToastProvider,
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

  it("a skeleton on a mood surface takes the mood's toggle track", () => {
    render(
      <SkeletonGroup label="Memuat dapur">
        <Skeleton testID="block" height={40} onMood />
      </SkeletonGroup>,
    );
    // Light Siang toggle track.
    expect(flat(screen.getByTestId("block", { includeHiddenElements: true }))).toMatchObject({ backgroundColor: "#F6DDBE" });
  });
});

describe("MascotLoading", () => {
  const visual = () => screen.getByTestId("mascot-loading-visual", { includeHiddenElements: true });
  const rig = () => screen.getByTestId("mascot-rig", { includeHiddenElements: true });
  const poster = () => screen.getByTestId("mascot-poster", { includeHiddenElements: true });
  const loadLayers = () => {
    for (const layer of screen.getAllByTestId("mascot-layer", { includeHiddenElements: true })) fireEvent(layer, "load");
  };

  it("mascot shows its label at once and its art after 300ms", () => {
    jest.useFakeTimers();
    render(<MascotLoading label="Menyiapkan Catera untuk Anda…" />);
    // The status is spoken at once; the drawing waits 300ms so a fast answer shows nothing.
    expect(screen.getByRole("progressbar").props.accessibilityLabel).toBe("Menyiapkan Catera untuk Anda…");
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

  it("the startup mascot fills the canvas and its label uses the system font", () => {
    jest.useFakeTimers();
    render(<MascotLoading label="Menyiapkan Catera untuk Anda…" startup size={160} />);
    expect(flat(screen.getByTestId("mascot-loading"))).toMatchObject({ backgroundColor: nativeThemes.light.canvas });
    const label = screen.getByText("Menyiapkan Catera untuk Anda…", { includeHiddenElements: true });
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
});
