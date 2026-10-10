import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Platform, Pressable, StyleSheet, Text as RNText } from "react-native";
import { HeaderShownContext, NavigationContext } from "expo-router/react-navigation";
import { use, type ReactElement } from "react";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import * as Reanimated from "react-native-reanimated";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoidingView, Modal, ScrollView } from "react-native";
import {
  Button,
  Chip,
  DemoStrip,
  Field,
  fontFor,
  fonts,
  HeroPager,
  moodHeaderTopInset,
  MoodHeader,
  PressableRow,
  ScreenHeaderContext,
  screenInsetBehavior,
  PressableScale,
  RoundButton,
  Screen,
  ScreenFooter,
  Segmented,
  Sheet,
  Stepper,
  Text,
  ThemeProvider,
  TopInsetOwner,
  useThemePreference,
} from "@catera/mobile-ui";
import { nativeMood, nativeThemes } from "@catera/design-tokens";

// The customer setup has no SecureStore mock, so this file keeps its own in-memory one for the dark theme cases.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

// react-test-renderer gives host refs no measure methods, so the screen's SafeAreaView gets a stand-in that reports a
// window position (the height of a header sitting above the screen).
let mockWindowY = 0;
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  const actual = require("react-native-safe-area-context/jest/mock").default;
  const SafeAreaView = React.forwardRef((props: object, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({
      measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, mockWindowY, 390, 800),
    }));
    return React.createElement(View, props);
  });
  return { ...actual, SafeAreaView };
});

test("fontFor maps weights to static families", () => {
  expect(fontFor(undefined)).toBe(fonts.regular);
  expect(fontFor("500")).toBe(fonts.medium);
  expect(fontFor("600")).toBe(fonts.semibold);
  expect(fontFor("bold")).toBe(fonts.bold);
  expect(fontFor("700")).toBe(fonts.bold);
  expect(fontFor("800")).toBe(fonts.extrabold);
});

test("Text turns a caller's fontWeight into a family", () => {
  render(<Text style={{ fontWeight: "700" }}>Halo</Text>);
  const style = StyleSheet.flatten(screen.getByText("Halo").props.style);
  expect(style.fontFamily).toBe("Jakarta-Bold");
  expect(style.fontWeight).toBeUndefined();
});

test("an explicit fontFamily wins over the variant weight", () => {
  render(
    <Text variant="heading" style={{ fontFamily: fonts.semibold }}>
      x
    </Text>,
  );
  const style = StyleSheet.flatten(screen.getByText("x").props.style);
  expect(style.fontFamily).toBe("Jakarta-SemiBold");
  expect(style.fontWeight).toBeUndefined();
});

test.each([
  ["title", 30, 39],
  ["heading", 21, 28],
  ["body", 14, 23],
  ["label", 12, 23],
  ["caption", 11, 18],
] as const)("%s uses the documented ramp", (variant, size, line) => {
  render(<Text variant={variant}>x</Text>);
  const s = StyleSheet.flatten(screen.getByText("x").props.style);
  expect([s.fontSize, s.lineHeight]).toEqual([size, line]);
});

test("title and heading use the bold family", () => {
  render(<Text variant="title">Jadwal</Text>);
  expect(StyleSheet.flatten(screen.getByText("Jadwal").props.style).fontFamily).toBe("Jakarta-Bold");
});

describe("press feedback and haptics", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  test("Button fires onPress and a light haptic", () => {
    const onPress = jest.fn();
    render(<Button label="Bayar" onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  test("disabled Button fires no haptic", () => {
    const onPress = jest.fn();
    render(<Button label="Bayar" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    expect(onPress).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  test("Chip fires a selection haptic", () => {
    const onPress = jest.fn();
    render(<Chip label="Halal" selected={false} onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Halal" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  test("a rejected haptic never throws", () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error("no motor"));
    render(<Button label="Bayar" onPress={() => {}} />);
    expect(() => fireEvent.press(screen.getByRole("button", { name: "Bayar" }))).not.toThrow();
  });

  test("does not scale when reduced motion is on", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    render(<PressableScale testID="p" haptic="none" />);
    fireEvent(screen.getByTestId("p"), "pressIn");
    const style = StyleSheet.flatten(screen.getByTestId("p").props.style);
    const scales = (style.transform ?? []).map((t: { scale?: number }) => t.scale).filter((v: unknown) => v !== undefined);
    expect(scales.every((v: number) => v === 1)).toBe(true);
    // The Reanimated jest mock does not replay shared-value changes; the 0.85 dim is checked on the emulator.
    expect(style.transform).toBeUndefined();
  });
});

test("RoundButton presses with a haptic", () => {
  jest.clearAllMocks();
  const onPress = jest.fn();
  render(<RoundButton icon="heart-outline" label="Simpan" onPress={onPress} />);
  fireEvent.press(screen.getByRole("button", { name: "Simpan" }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
});

describe("shared foundation (audit 001)", () => {
  // An earlier test leaves the shared reanimated mock returning true; start from motion on.
  beforeEach(() => (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(false));
  afterEach(() => (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(false));

  it("renders the demo strip only in demo mode", () => {
    const Harness = ({ demo }: { demo: boolean }) => (
      <>{demo ? <DemoStrip label="Demo · data sintetis" /> : null}</>
    );
    const view = render(<Harness demo={false} />);
    expect(screen.queryByText("Demo · data sintetis")).toBeNull();
    view.rerender(<Harness demo />);
    const label = screen.getByText("Demo · data sintetis");
    expect(StyleSheet.flatten(label.props.style).color).toBe(nativeThemes.light.forest);
    const strip = screen.getByLabelText("Demo · data sintetis");
    expect(strip.props.accessibilityRole).toBe("text");
    const style = StyleSheet.flatten(strip.props.style);
    expect(style.backgroundColor).toBe(nativeThemes.light.sage);
    expect(style.minHeight).toBeGreaterThanOrEqual(24);
  });

  it("chips and segments are 48dp", () => {
    render(
      <>
        <Chip label="Halal" selected={false} onPress={() => {}} />
        <Segmented options={[{ value: "a", label: "Satu" }, { value: "b", label: "Dua" }]} value="a" onChange={() => {}} />
        <Button label="Lanjut" variant="text" onPress={() => {}} />
      </>,
    );
    const height = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never).minHeight;
    expect(height(screen.getByRole("button", { name: "Halal" }))).toBe(48);
    expect(height(screen.getByRole("tab", { name: "Satu" }))).toBe(48);
    expect(height(screen.getByRole("button", { name: "Lanjut" }))).toBe(48);
  });

  it("title and heading are headers", () => {
    render(
      <>
        <Text variant="title">Jadwal</Text>
        <Text variant="heading">Berikutnya</Text>
        <Text variant="body">Isi</Text>
        <Text variant="heading" accessibilityRole="text">
          Bukan judul
        </Text>
      </>,
    );
    expect(screen.getByRole("header", { name: "Jadwal" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Berikutnya" })).toBeTruthy();
    expect(screen.queryByRole("header", { name: "Isi" })).toBeNull();
    expect(screen.queryByRole("header", { name: "Bukan judul" })).toBeNull();
  });

  it("Text forwards accessibilityLabel and accessible", () => {
    render(
      <Text accessible accessibilityLabel="Tiga porsi">
        3
      </Text>,
    );
    expect(screen.getByLabelText("Tiga porsi").props.accessible).toBe(true);
  });

  it("Sheet scrim is a labelled button and fades under reduced motion", () => {
    const onClose = jest.fn();
    const view = render(
      <Sheet visible onClose={onClose} title="Bagikan" closeLabel="Close">
        <Text>Isi</Text>
      </Sheet>,
    );
    expect(view.UNSAFE_getByType(Modal).props.animationType).toBe("slide");
    expect(screen.getByLabelText("Close", { includeHiddenElements: true }).props.accessibilityRole).toBe("button");
    // The sibling sheet is accessibilityViewIsModal, which RNTL treats as hiding the scrim.
    fireEvent.press(screen.getByLabelText("Close", { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();

    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const reduced = render(
      <Sheet visible onClose={() => {}} title="Bagikan" closeLabel="Tutup">
        <Text>Isi</Text>
      </Sheet>,
    );
    expect(reduced.UNSAFE_getByType(Modal).props.animationType).toBe("fade");
  });

  it("Stepper labels come from props and its buttons are 48dp", () => {
    jest.clearAllMocks();
    const onChange = jest.fn();
    render(
      <Stepper label="Porsi" value={2} onChange={onChange} decreaseLabel="Decrease Porsi" increaseLabel="Increase Porsi" />,
    );
    const less = screen.getByRole("button", { name: "Decrease Porsi" });
    const more = screen.getByRole("button", { name: "Increase Porsi" });
    expect(StyleSheet.flatten(less.props.style)).toMatchObject({ width: 48, height: 48 });
    fireEvent.press(more);
    expect(onChange).toHaveBeenCalledWith(3);
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    fireEvent.press(less);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("PressableRow dims when pressed and does not scale", () => {
    jest.clearAllMocks();
    const onPress = jest.fn();
    render(
      <PressableRow testID="row" accessibilityRole="button" accessibilityLabel="Baris" onPress={onPress}>
        <Text>Baris</Text>
      </PressableRow>,
    );
    expect(StyleSheet.flatten(screen.getByTestId("row").props.style)?.opacity ?? 1).toBe(1);
    fireEvent(screen.getByTestId("row"), "responderGrant", {
      nativeEvent: { touches: [], changedTouches: [] },
      persist() {},
    });
    const pressed = StyleSheet.flatten(screen.getByTestId("row").props.style);
    expect(pressed.opacity).toBe(0.7);
    expect(pressed.transform).toBeUndefined();
    expect(screen.getByTestId("row").props.accessibilityLabel).toBe("Baris");
    fireEvent.press(screen.getByTestId("row"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it("caps the body at 760 and keeps taps alive over the keyboard", () => {
    const view = render(
      <Screen footer={<Text>Kaki</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(StyleSheet.flatten(screen.getByTestId("screen-body").props.style)).toMatchObject({
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    });
    expect(StyleSheet.flatten(screen.getByTestId("screen-footer").props.style)).toMatchObject({
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    });
    expect(view.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe("handled");
    expect(view.UNSAFE_getByType(KeyboardAvoidingView)).toBeTruthy();
  });

  it("Screen leaves the top inset to the demo strip while it is shown", () => {
    const safeEdges = (owned: boolean) => {
      const view = render(
        <TopInsetOwner owned={owned}>
          <Screen>
            <Text>Isi</Text>
          </Screen>
        </TopInsetOwner>,
      );
      const edges = view.UNSAFE_getByType(SafeAreaView).props.edges;
      view.unmount();
      return edges;
    };
    expect(safeEdges(false)).toEqual(["top", "left", "right"]);
    expect(safeEdges(true)).toEqual(["left", "right"]);
  });
});

describe("disabled look survives reduced motion", () => {
  afterEach(() => jest.restoreAllMocks());
  const opacityOf = (name: string) => StyleSheet.flatten(screen.getByRole("button", { name }).props.style).opacity;

  test.each([false, true])("disabled secondary Button stays at 0.45 (reduced motion %s)", (reduced) => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(reduced);
    render(<Button label="Salin" variant="secondary" disabled onPress={() => {}} />);
    expect(opacityOf("Salin")).toBe(0.45);
  });

  test.each([false, true])("an enabled Button rests at full opacity (reduced motion %s)", (reduced) => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(reduced);
    render(<Button label="Simpan" variant="secondary" onPress={() => {}} />);
    expect(opacityOf("Simpan") ?? 1).toBe(1);
  });
});

describe("Button on a surface the theme does not own", () => {
  const style = (name: string) => StyleSheet.flatten(screen.getByRole("button", { name }).props.style);
  const labelColor = (name: string) =>
    StyleSheet.flatten(screen.getByText(name).props.style).color;

  test("ink sets the label colour and edge the border of a secondary button", () => {
    render(<Button label="Belum" variant="secondary" ink="#FFF7E9" edge="#8FB59F" onPress={() => {}} />);
    expect(labelColor("Belum")).toBe("#FFF7E9");
    expect(style("Belum")).toMatchObject({ borderWidth: 1, borderColor: "#8FB59F", minHeight: 48 });
  });

  test("ink colours a text button and a disabled one still fades", () => {
    render(<Button label="Ada masalah" variant="text" ink="#FFF7E9" edge="#8FB59F" disabled onPress={() => {}} />);
    expect(labelColor("Ada masalah")).toBe("#FFF7E9");
    expect(style("Ada masalah").borderWidth).toBeUndefined();
    expect(style("Ada masalah").opacity).toBe(0.45);
  });

  test("without ink and edge it reads the theme, as before", () => {
    render(<Button label="Salin" variant="secondary" onPress={() => {}} />);
    expect(labelColor("Salin")).toBe(nativeThemes.light.forest);
    expect(style("Salin").borderColor).toBe(nativeThemes.light.secondaryBorder);
  });
});

describe("Sheet and Screen details", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockWindowY = 0;
  });

  it("Sheet closes on the VoiceOver escape gesture", () => {
    const onClose = jest.fn();
    render(
      <Sheet visible onClose={onClose} title="Bagikan" closeLabel="Tutup">
        <Text>Isi</Text>
      </Sheet>,
    );
    const sheet = screen.UNSAFE_getAllByProps({ accessibilityViewIsModal: true })[0];
    expect(sheet.props.onAccessibilityEscape).toBe(onClose);
  });

  // On gesture navigation the Modal window must reach under the system bars, or the screen behind it shows through
  // the gesture band without the scrim; the sheet then pads its own bottom so its content clears that band.
  it("Sheet draws under the system bars and pads its bottom by the safe-area inset", () => {
    const sheetPadding = () =>
      StyleSheet.flatten(screen.UNSAFE_getAllByProps({ accessibilityViewIsModal: true })[0].props.style).paddingBottom;
    const plain = render(
      <Sheet visible onClose={() => {}} title="Bagikan" closeLabel="Tutup">
        <Text>Isi</Text>
      </Sheet>,
    );
    const modal = plain.UNSAFE_getByType(Modal);
    expect(modal.props.navigationBarTranslucent).toBe(true);
    expect(modal.props.statusBarTranslucent).toBe(true);
    const base = sheetPadding();
    expect(base).toBe(20);
    plain.unmount();

    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 24 } }}>
        <Sheet visible onClose={() => {}} title="Bagikan" closeLabel="Tutup">
          <Text>Isi</Text>
        </Sheet>
      </SafeAreaProvider>,
    );
    expect(sheetPadding()).toBe(base + 24);
  });

  it("Sheet with an empty title renders no heading", () => {
    render(
      <Sheet visible onClose={() => {}} title="" closeLabel="Tutup">
        <Text>Isi</Text>
      </Sheet>,
    );
    expect(screen.queryByRole("header", { includeHiddenElements: true })).toBeNull();
  });

  it("Screen's scroll view is the first one in the screen and lets the system inset it", () => {
    // iOS collapses the large title and minimizes the tab bar from the first scroll view, and insets it for the bars
    // and the keyboard itself (`automaticallyAdjustKeyboardInsets`). Jest runs the Android build, where
    // `process.env.EXPO_OS` is compiled in, so the iOS keyboard branch is checked by reading only; it is unverified on
    // a device.
    const view = render(
      <Screen footer={<Text>Kaki</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    const scrolls = view.UNSAFE_getAllByType(ScrollView);
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0].props).toMatchObject({ contentInsetAdjustmentBehavior: "automatic", automaticallyAdjustKeyboardInsets: false });
    // A page that starts under a transparent header (Paket's photo) is not pushed below the bar.
    view.rerender(
      <Screen bleed>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(view.UNSAFE_getByType(ScrollView).props.contentInsetAdjustmentBehavior).toBe("never");
    // A tab root's mood header already pays the top inset (and the screen drops its top edge), so iOS must not add a
    // second one under it.
    view.rerender(
      <Screen header={<Text>Mood</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(view.UNSAFE_getByType(ScrollView).props.contentInsetAdjustmentBehavior).toBe("never");
  });

  it("Screen tones the Android top bar once the page scrolls and back at the top, only on the crossing", () => {
    const setOptions = jest.fn();
    const navigation = { setOptions, isFocused: () => true, addListener: () => () => undefined };
    const onScroll = jest.fn();
    render(
      <HeaderShownContext.Provider value>
        <NavigationContext.Provider value={navigation as never}>
          <Screen onScroll={onScroll}>
            <Text>Isi</Text>
          </Screen>
        </NavigationContext.Provider>
      </HeaderShownContext.Provider>,
    );
    const scroll = screen.getByTestId("screen-scroll");
    const at = (y: number) => fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y } } });
    const tones = () =>
      setOptions.mock.calls.filter(([o]) => "headerStyle" in o).map(([o]) => o.headerStyle.backgroundColor);
    // At rest the stack's own canvas bar stands; nothing is set until the page moves.
    expect(tones()).toEqual([]);
    // Material's scrolled state is the navigation bar's surface-container tone, set once however far the page goes.
    at(1);
    at(40);
    at(400);
    expect(tones()).toEqual([nativeThemes.light.tabBar]);
    expect(nativeThemes.light.tabBar).toBe("#F2ECDF");
    // Back at the top, the canvas again, once.
    at(0);
    at(0);
    expect(tones()).toEqual([nativeThemes.light.tabBar, nativeThemes.light.canvas]);
    // The screen's own handler still hears every event.
    expect(onScroll).toHaveBeenCalledTimes(5);
  });

  it("iOS keeps the automatic inset under a mood header and the header pays no top inset there; Android as before", () => {
    // Jest compiles `process.env.EXPO_OS` in (the Android build), so the platform rules are pure helpers that take the
    // platform, and both are pinned here. iOS behaviour is unverified on an iPhone.
    const ios = "ios";
    const android = "android";
    // iOS: "automatic" under a full-bleed header too, so UIKit insets the page below the status bar and lets its last
    // rows scroll clear of the floating tab bar. A photo header still opts out.
    expect(screenInsetBehavior({ header: true, bleed: false }, ios)).toBe("automatic");
    expect(screenInsetBehavior({ header: false, bleed: false }, ios)).toBe("automatic");
    expect(screenInsetBehavior({ header: false, bleed: true }, ios)).toBe("never");
    // Android ignores the prop; it keeps "never" under any header.
    expect(screenInsetBehavior({ header: true, bleed: false }, android)).toBe("never");
    expect(screenInsetBehavior({ header: false, bleed: false }, android)).toBe("automatic");
    expect(screenInsetBehavior({ header: false, bleed: true }, android)).toBe("never");
    // The MoodHeader as a Screen header: UIKit already offsets it on iOS, so it pays no inset; on Android it pays the
    // status-bar inset unless the demo strip owns it. Outside a Screen header it pays it on both.
    expect(moodHeaderTopInset({ top: 47, topOwned: false, inScreenHeader: true }, ios)).toBe(0);
    expect(moodHeaderTopInset({ top: 47, topOwned: false, inScreenHeader: false }, ios)).toBe(47);
    expect(moodHeaderTopInset({ top: 24, topOwned: false, inScreenHeader: true }, android)).toBe(24);
    expect(moodHeaderTopInset({ top: 24, topOwned: true, inScreenHeader: true }, android)).toBe(0);
    // Only a header inside the screen's scroll view counts as a Screen header (the scroll view is what UIKit insets).
    function Probe() {
      return <Text>{use(ScreenHeaderContext) ? "in" : "out"}</Text>;
    }
    const view = render(
      <Screen header={<Probe />}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(screen.getByText("in")).toBeTruthy();
    // The status band still paints the header colour under the status bar.
    expect(screen.getByTestId("status-band", { includeHiddenElements: true })).toBeTruthy();
    view.rerender(
      <Screen scroll={false} header={<Probe />}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(screen.getByText("out")).toBeTruthy();
  });

  it("Screen leaves the bar alone on a tab root and under a photo header", () => {
    const setOptions = jest.fn();
    const navigation = { setOptions, isFocused: () => true, addListener: () => () => undefined };
    const scrollTo = (y: number) =>
      fireEvent.scroll(screen.getByTestId("screen-scroll"), { nativeEvent: { contentOffset: { x: 0, y } } });
    // A tab root: no stack header above it.
    const view = render(
      <NavigationContext.Provider value={navigation as never}>
        <Screen header={<Text>Mood</Text>}>
          <Text>Isi</Text>
        </Screen>
      </NavigationContext.Provider>,
    );
    scrollTo(200);
    view.unmount();
    // Paket's photo: the screen owns its bar while it scrolls.
    render(
      <HeaderShownContext.Provider value>
        <NavigationContext.Provider value={navigation as never}>
          <Screen bleed>
            <Text>Isi</Text>
          </Screen>
        </NavigationContext.Provider>
      </HeaderShownContext.Provider>,
    );
    scrollTo(200);
    expect(setOptions.mock.calls.filter(([o]) => "headerStyle" in o)).toEqual([]);
  });

  it("Screen adds no keyboard offset on Android", () => {
    const view = render(
      <Screen footer={<Text>Kaki</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBeUndefined();
    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.enabled).toBe(false);
    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(0);
  });

  it("Screen drops its own top inset under a stack header, and on Android names itself in a content line", () => {
    const setOptions = jest.fn();
    const navigation = { setOptions, isFocused: () => true, addListener: () => () => undefined };
    const view = render(
      <HeaderShownContext.Provider value>
        <NavigationContext.Provider value={navigation as never}>
          <Screen nativeTitle="Paket Makan Siang Rumahan Sehat Sekeluarga">
            <Text>Isi</Text>
          </Screen>
        </NavigationContext.Provider>
      </HeaderShownContext.Provider>,
    );
    // The native header pays the status-bar inset, so the screen adds none.
    expect(view.UNSAFE_getByType(SafeAreaView).props.edges).toEqual(["left", "right"]);
    // Headline small, 24/32, in Plus Jakarta Sans Bold, wrapping; the bar starts empty.
    const line = within(screen.getByTestId("screen-native-title")).getByText("Paket Makan Siang Rumahan Sehat Sekeluarga");
    expect(StyleSheet.flatten(line.props.style)).toMatchObject({ fontFamily: "Jakarta-Bold", fontSize: 24, lineHeight: 32 });
    expect(line.props.accessibilityRole).toBe("header");
    expect(setOptions).toHaveBeenLastCalledWith({ headerTitle: "" });
    view.unmount();
    // A short bar title (Hari's day) sets the bar on both platforms and adds no content line.
    render(
      <NavigationContext.Provider value={navigation as never}>
        <Screen title="Senin 12 Okt">
          <Text>Isi</Text>
        </Screen>
      </NavigationContext.Provider>,
    );
    expect(setOptions).toHaveBeenLastCalledWith({ title: "Senin 12 Okt" });
    expect(screen.queryByTestId("screen-native-title")).toBeNull();
  });

  it("the footer pays the bottom safe area on iOS, under the floating tab bar, and nothing more on Android", () => {
    // Jest compiles `process.env.EXPO_OS` in (the Android build), so the footer takes the platform; the iOS result is
    // unverified on an iPhone.
    let view = render(<ScreenFooter os="ios">{<Text>Kaki</Text>}</ScreenFooter>);
    const [ios] = view.UNSAFE_getAllByType(SafeAreaView);
    expect(ios.props.testID).toBe("screen-footer");
    expect(ios.props.edges).toEqual(["bottom"]);
    // The inset adds to the footer's own padding, and its surface runs under the bar.
    expect(StyleSheet.flatten(ios.props.style)).toMatchObject({ paddingBottom: 20, backgroundColor: nativeThemes.light.surface });
    expect(within(screen.getByTestId("screen-footer")).getByText("Kaki")).toBeTruthy();
    view.unmount();
    // Android: a plain view, as before. Inside the tabs NativeTabs already ends the screen above the navigation bar.
    view = render(<ScreenFooter os="android">{<Text>Kaki</Text>}</ScreenFooter>);
    expect(screen.getByTestId("screen-footer")).toBeTruthy();
    expect(view.UNSAFE_queryAllByType(SafeAreaView)).toHaveLength(0);
    view.unmount();
    // Screen draws its footer through it: on this (Android) build, one SafeAreaView for the screen and none for the footer.
    const page = render(
      <Screen footer={<Text>Kaki</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(page.UNSAFE_getAllByType(SafeAreaView)).toHaveLength(1);
    expect(page.UNSAFE_getByType(ScreenFooter).props.os).toBeUndefined();
  });

  it("HeroPager follows the cards down when one goes: 3 cards at the third, then 2, reads 2 dari 2", () => {
    const pager = (count: number) => (
      <HeroPager count={count} counterLabel={(i) => `${i + 1} dari ${count}`} accessibilityLabelFor={() => "Makan siang"}>
        {Array.from({ length: count }, (_, i) => (
          <Text key={i}>{`Kartu ${i + 1}`}</Text>
        ))}
      </HeroPager>
    );
    const view = render(pager(3));
    // To the third card.
    const control = () => screen.getByRole("adjustable");
    act(() => fireEvent(control(), "accessibilityAction", { nativeEvent: { actionName: "increment" } }));
    act(() => fireEvent(control(), "accessibilityAction", { nativeEvent: { actionName: "increment" } }));
    expect(screen.getByText("3 dari 3")).toBeTruthy();
    // The third card goes away while it is the one in view.
    view.rerender(pager(2));
    expect(screen.getByText("2 dari 2")).toBeTruthy();
    expect(control().props.accessibilityValue).toEqual({ text: "2 dari 2" });
    expect(StyleSheet.flatten(screen.getByTestId("hero-dot-1", { includeHiddenElements: true }).props.style).width).toBe(20);
    // It moves back from there, not from a card that is no longer there.
    act(() => fireEvent(control(), "accessibilityAction", { nativeEvent: { actionName: "decrement" } }));
    expect(screen.getByText("1 dari 2")).toBeTruthy();
  });
});

describe("dark theme", () => {
  const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
  const DARK = { forest: "#FFF7E9", cream: "#163D2E", canvas: "#151514", surface: "#232321" };

  beforeEach(() => {
    store.clear();
    (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(false);
  });

  // Mounts the tree under a provider whose stored preference is dark, and waits for that read to settle.
  async function renderDark(ui: ReactElement) {
    store.set("k", "dark");
    const view = render(<ThemeProvider storageKey="k">{ui}</ThemeProvider>);
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith("k"));
    await act(async () => {});
    return view;
  }

  it("Text title uses dark forest", async () => {
    await renderDark(<Text variant="title">Jadwal</Text>);
    expect(StyleSheet.flatten(screen.getByText("Jadwal").props.style).color).toBe(DARK.forest);
  });

  it("primary Button is a cream fill with forest text", async () => {
    await renderDark(<Button label="Bayar" onPress={() => {}} />);
    expect(StyleSheet.flatten(screen.getByRole("button", { name: "Bayar" }).props.style).backgroundColor).toBe(DARK.forest);
    expect(StyleSheet.flatten(screen.getByText("Bayar").props.style).color).toBe(DARK.cream);
  });

  it("a disabled primary Button sits on the disabled fill, and its label reads on it", async () => {
    await renderDark(<Button label="Bayar" disabled onPress={() => {}} />);
    expect(StyleSheet.flatten(screen.getByRole("button", { name: "Bayar" }).props.style).backgroundColor).toBe(
      nativeThemes.dark.disabledFill,
    );
    expect(StyleSheet.flatten(screen.getByText("Bayar").props.style).color).toBe(nativeThemes.dark.muted);
  });

  it("a disabled primary Button keeps the same light grey in light", () => {
    render(<Button label="Bayar" disabled onPress={() => {}} />);
    expect(StyleSheet.flatten(screen.getByRole("button", { name: "Bayar" }).props.style).backgroundColor).toBe("#CFD3C6");
  });

  it("Screen paints the dark canvas and its MoodHeader the dark mood header", async () => {
    const view = await renderDark(
      <Screen header={<MoodHeader title="Hari" />}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(StyleSheet.flatten(view.UNSAFE_getByType(SafeAreaView).props.style).backgroundColor).toBe(DARK.canvas);
    // No MoodProvider here, so the mood reads Siang: the dark Siang header and its headline ink.
    const fill = screen.getByTestId("mood-fill-siang", { includeHiddenElements: true });
    expect(StyleSheet.flatten(fill.props.style).backgroundColor).toBe(nativeMood.dark.siang.header);
    expect(StyleSheet.flatten(screen.getByText("Hari").props.style).color).toBe(nativeMood.dark.siang.headerText);
  });

  it("an open Sheet repaints when the theme changes", async () => {
    function Probe() {
      const { setPreference } = useThemePreference();
      return (
        <Pressable accessibilityRole="button" accessibilityLabel="Gelap" onPress={() => setPreference("dark")}>
          <RNText>Gelap</RNText>
        </Pressable>
      );
    }
    const sheetColor = () =>
      StyleSheet.flatten(screen.UNSAFE_getAllByProps({ accessibilityViewIsModal: true })[0].props.style).backgroundColor;
    render(
      <ThemeProvider storageKey="k">
        <Probe />
        <Sheet visible onClose={() => {}} title="Bagikan" closeLabel="Tutup">
          <Text>Isi</Text>
        </Sheet>
      </ThemeProvider>,
    );
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith("k"));
    await act(async () => {});
    expect(sheetColor()).toBe(nativeThemes.light.surface);
    fireEvent.press(screen.getByRole("button", { name: "Gelap" }));
    expect(sheetColor()).toBe(DARK.surface);
  });

  it("explicit style colour still wins over the variant", async () => {
    await renderDark(
      <Text variant="title" style={{ color: "#123456" }}>
        Pilih
      </Text>,
    );
    expect(StyleSheet.flatten(screen.getByText("Pilih").props.style).color).toBe("#123456");
  });

  it("Field keeps the dark input style when the caller passes a style", async () => {
    await renderDark(<Field label="Ceritakan kendalanya" multiline style={{ minHeight: 120, textAlignVertical: "top" }} />);
    const flat = StyleSheet.flatten(screen.getByLabelText("Ceritakan kendalanya").props.style);
    // The caller's own keys are applied...
    expect(flat.minHeight).toBe(120);
    expect(flat.textAlignVertical).toBe("top");
    // ...on top of the base input style, not instead of it.
    expect(flat.backgroundColor).toBe(DARK.surface);
    expect(flat.borderColor).toBe(nativeThemes.dark.fieldBorder);
    expect(flat.color).toBe(nativeThemes.dark.charcoal);
    expect(flat.borderWidth).toBe(1);
    // Control: a dark-only value, so the assertions above cannot pass on the light palette.
    expect(flat.color).not.toBe(nativeThemes.light.charcoal);
  });

  it("Field with a caller style still shows the error border", async () => {
    await renderDark(<Field label="Nama" error="Wajib diisi" style={{ minHeight: 120 }} />);
    const flat = StyleSheet.flatten(screen.getByLabelText("Nama").props.style);
    expect(flat.minHeight).toBe(120);
    expect(flat.borderColor).toBe(nativeThemes.dark.danger);
  });

  it("Field error text can be selected and copied", () => {
    render(<Field label="Nama" error="Wajib diisi" />);
    expect(screen.getByText("Wajib diisi").props.selectable).toBe(true);
  });

  it("Text forwards selectable", () => {
    render(<Text selectable>Salin</Text>);
    expect(screen.getByText("Salin").props.selectable).toBe(true);
  });
});
