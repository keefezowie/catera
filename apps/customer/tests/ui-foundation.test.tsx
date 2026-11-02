import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Platform, StyleSheet } from "react-native";
import { HeaderShownContext, NavigationContext } from "expo-router/react-navigation";
import { use, type ReactElement } from "react";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import * as Reanimated from "react-native-reanimated";
import {
  Button,
  Card,
  Chip,
  DemoStrip,
  Field,
  fontFor,
  fonts,
  HeroPager,
  LayoutScaleProvider,
  tabBarColors,
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
  Stepper,
  Text,
  ThemeProvider,
  TopInsetOwner,
  useScreenMargin,
  useTouchTarget,
} from "@catera/mobile-ui";
import { nativeLayout, nativeMood, nativeThemes } from "@catera/design-tokens";

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

/** The phone a test draws on; by default the size React Native's jest setup reports, so other tests see no change. */
const DEFAULT_WINDOW = { width: 750, height: 1334, scale: 2, fontScale: 2 };
let mockWindow = DEFAULT_WINDOW;
/** The same window at the default text size, where the type ramp's line heights hold (above 1, Android drops them). */
const DEFAULT_TEXT = { ...DEFAULT_WINDOW, fontScale: 1 };
afterEach(() => void (mockWindow = DEFAULT_WINDOW));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));

// The test renderer gives host refs no measure methods, so the screen's SafeAreaView gets a stand-in that reports a
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

// Only host elements exist in the tree. The SafeAreaView stand-in above is a host View that keeps its props, so a
// SafeAreaView is the host that carries `edges`; a ScrollView is its native RCTScrollView.
const safeAreas = () => screen.container.queryAll((n) => "edges" in n.props);
const scrollViews = () => screen.container.queryAll((n) => n.type === "RCTScrollView");
// KeyboardAvoidingView draws a plain View and keeps none of its own props, so a stand-in host keeps them for the test.
jest.mock("react-native/Libraries/Components/Keyboard/KeyboardAvoidingView", () => {
  const React = require("react");
  const { View } = require("react-native");
  const KeyboardAvoidingView = (props: object) => React.createElement(View, { testID: "keyboard-avoiding", ...props });
  return { __esModule: true, default: KeyboardAvoidingView };
});

test("fontFor maps weights to static families", () => {
  expect(fontFor(undefined)).toBe(fonts.regular);
  expect(fontFor("500")).toBe(fonts.medium);
  expect(fontFor("600")).toBe(fonts.semibold);
  expect(fontFor("bold")).toBe(fonts.bold);
  expect(fontFor("700")).toBe(fonts.bold);
  expect(fontFor("800")).toBe(fonts.extrabold);
});

test("Text turns a caller's fontWeight into a family", async () => {
  await render(<Text style={{ fontWeight: "700" }}>Halo</Text>);
  const style = StyleSheet.flatten(screen.getByText("Halo").props.style);
  expect(style.fontFamily).toBe("Jakarta-Bold");
  expect(style.fontWeight).toBeUndefined();
});

test("an explicit fontFamily wins over the variant weight", async () => {
  await render(
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
] as const)("%s uses the documented ramp", async (variant, size, line) => {
  mockWindow = DEFAULT_TEXT;
  await render(<Text variant={variant}>x</Text>);
  const s = StyleSheet.flatten(screen.getByText("x").props.style);
  expect([s.fontSize, s.lineHeight]).toEqual([size, line]);
});

test("title and heading use the bold family", async () => {
  await render(<Text variant="title">Jadwal</Text>);
  expect(StyleSheet.flatten(screen.getByText("Jadwal").props.style).fontFamily).toBe("Jakarta-Bold");
});

describe("press feedback and haptics", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  test("Button fires onPress and a light haptic", async () => {
    const onPress = jest.fn();
    await render(<Button label="Bayar" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  test("disabled Button fires no haptic", async () => {
    const onPress = jest.fn();
    await render(<Button label="Bayar" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole("button", { name: "Bayar" }));
    expect(onPress).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  test("Chip fires a selection haptic", async () => {
    const onPress = jest.fn();
    await render(<Chip label="Halal" selected={false} onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Halal" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  test("a rejected haptic never throws", async () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error("no motor"));
    await render(<Button label="Bayar" onPress={() => {}} />);
    expect(async () => await fireEvent.press(screen.getByRole("button", { name: "Bayar" }))).not.toThrow();
  });

  test("does not scale when reduced motion is on", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    await render(<PressableScale testID="p" haptic="none" />);
    await fireEvent(screen.getByTestId("p"), "pressIn");
    const style = StyleSheet.flatten(screen.getByTestId("p").props.style);
    const scales = (style.transform ?? []).map((t: { scale?: number }) => t.scale).filter((v: unknown) => v !== undefined);
    expect(scales.every((v: number) => v === 1)).toBe(true);
    // The Reanimated jest mock does not replay shared-value changes; the 0.85 dim is checked on the emulator.
    expect(style.transform).toBeUndefined();
  });
});

test("RoundButton presses with a haptic", async () => {
  jest.clearAllMocks();
  const onPress = jest.fn();
  await render(<RoundButton icon="heart-outline" label="Simpan" onPress={onPress} />);
  await fireEvent.press(screen.getByRole("button", { name: "Simpan" }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
});

describe("shared foundation (audit 001)", () => {
  // An earlier test leaves the shared reanimated mock returning true; start from motion on.
  beforeEach(() => (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(false));
  afterEach(() => (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(false));

  it("renders the demo strip only in demo mode", async () => {
    const Harness = ({ demo }: { demo: boolean }) => (
      <>{demo ? <DemoStrip label="Demo (data contoh)" /> : null}</>
    );
    const view = await render(<Harness demo={false} />);
    expect(screen.queryByText("Demo (data contoh)")).toBeNull();
    await view.rerender(<Harness demo />);
    const label = screen.getByText("Demo (data contoh)");
    // Spec 2.3 (audit 9-07): the strip is a neutral band, canvas under muted text, never sage under forest.
    expect(StyleSheet.flatten(label.props.style).color).toBe(nativeThemes.light.muted);
    const strip = screen.getByLabelText("Demo (data contoh)");
    expect(strip.props.accessibilityRole).toBe("text");
    const style = StyleSheet.flatten(strip.props.style);
    expect(style.backgroundColor).toBe(nativeThemes.light.canvas);
    expect(style.minHeight).toBeGreaterThanOrEqual(24);
  });

  it("chips and segments are 48dp", async () => {
    await render(
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

  it("title and heading are headers", async () => {
    await render(
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

  it("Text forwards accessibilityLabel and accessible", async () => {
    await render(
      <Text accessible accessibilityLabel="Tiga porsi">
        3
      </Text>,
    );
    expect(screen.getByLabelText("Tiga porsi").props.accessible).toBe(true);
  });

  it("Stepper labels come from props and its buttons are 48dp", async () => {
    jest.clearAllMocks();
    const onChange = jest.fn();
    await render(
      <Stepper label="Porsi" value={2} onChange={onChange} decreaseLabel="Decrease Porsi" increaseLabel="Increase Porsi" />,
    );
    const less = screen.getByRole("button", { name: "Decrease Porsi" });
    const more = screen.getByRole("button", { name: "Increase Porsi" });
    expect(StyleSheet.flatten(less.props.style)).toMatchObject({ width: 48, height: 48 });
    await fireEvent.press(more);
    expect(onChange).toHaveBeenCalledWith(3);
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    await fireEvent.press(less);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("PressableRow dims when pressed and does not scale", async () => {
    jest.clearAllMocks();
    const onPress = jest.fn();
    await render(
      <PressableRow testID="row" accessibilityRole="button" accessibilityLabel="Baris" onPress={onPress}>
        <Text>Baris</Text>
      </PressableRow>,
    );
    expect(StyleSheet.flatten(screen.getByTestId("row").props.style)?.opacity ?? 1).toBe(1);
    await fireEvent(screen.getByTestId("row"), "responderGrant", {
      nativeEvent: { touches: [], changedTouches: [] },
      persist() {},
    });
    const pressed = StyleSheet.flatten(screen.getByTestId("row").props.style);
    expect(pressed.opacity).toBe(0.7);
    expect(pressed.transform).toBeUndefined();
    expect(screen.getByTestId("row").props.accessibilityLabel).toBe("Baris");
    await fireEvent.press(screen.getByTestId("row"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it("caps the body at 760 and keeps taps alive over the keyboard", async () => {
    await render(
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
    expect(scrollViews()[0].props.keyboardShouldPersistTaps).toBe("handled");
    expect(screen.getByTestId("keyboard-avoiding")).toBeTruthy();
  });

  it("Screen leaves the top inset to the demo strip while it is shown", async () => {
    const safeEdges = async (owned: boolean) => {
      const view = await render(
        <TopInsetOwner owned={owned}>
          <Screen>
            <Text>Isi</Text>
          </Screen>
        </TopInsetOwner>,
      );
      const edges = safeAreas()[0].props.edges;
      await view.unmount();
      return edges;
    };
    expect(await safeEdges(false)).toEqual(["top", "left", "right"]);
    expect(await safeEdges(true)).toEqual(["left", "right"]);
  });
});

describe("disabled look survives reduced motion", () => {
  afterEach(() => jest.restoreAllMocks());
  const opacityOf = (name: string) => StyleSheet.flatten(screen.getByRole("button", { name }).props.style).opacity;

  test.each([false, true])("disabled secondary Button stays at 0.45 (reduced motion %s)", async (reduced) => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(reduced);
    await render(<Button label="Salin" variant="secondary" disabled onPress={() => {}} />);
    expect(opacityOf("Salin")).toBe(0.45);
  });

  test.each([false, true])("an enabled Button rests at full opacity (reduced motion %s)", async (reduced) => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(reduced);
    await render(<Button label="Simpan" variant="secondary" onPress={() => {}} />);
    expect(opacityOf("Simpan") ?? 1).toBe(1);
  });
});

describe("Button on a surface the theme does not own", () => {
  const style = (name: string) => StyleSheet.flatten(screen.getByRole("button", { name }).props.style);
  const labelColor = (name: string) =>
    StyleSheet.flatten(screen.getByText(name).props.style).color;

  test("ink sets the label colour and edge the border of a secondary button", async () => {
    await render(<Button label="Belum" variant="secondary" ink="#FFF7E9" edge="#8FB59F" onPress={() => {}} />);
    expect(labelColor("Belum")).toBe("#FFF7E9");
    expect(style("Belum")).toMatchObject({ borderWidth: 1, borderColor: "#8FB59F", minHeight: 48 });
  });

  test("ink colours a text button and a disabled one still fades", async () => {
    await render(<Button label="Ada masalah" variant="text" ink="#FFF7E9" edge="#8FB59F" disabled onPress={() => {}} />);
    expect(labelColor("Ada masalah")).toBe("#FFF7E9");
    expect(style("Ada masalah").borderWidth).toBeUndefined();
    expect(style("Ada masalah").opacity).toBe(0.45);
  });

  test("without ink and edge it reads the theme, as before", async () => {
    await render(<Button label="Salin" variant="secondary" onPress={() => {}} />);
    expect(labelColor("Salin")).toBe(nativeThemes.light.forest);
    expect(style("Salin").borderColor).toBe(nativeThemes.light.secondaryBorder);
  });
});

describe("Screen details", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockWindowY = 0;
  });

  it("Screen's scroll view is the first one in the screen and lets the system inset it", async () => {
    // iOS collapses the large title and minimizes the tab bar from the first scroll view, and insets it for the bars
    // and the keyboard itself (`automaticallyAdjustKeyboardInsets`). Jest runs the Android build, where
    // `process.env.EXPO_OS` is compiled in, so the iOS keyboard branch is checked by reading only; it is unverified on
    // a device.
    const view = await render(
      <Screen footer={<Text>Kaki</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    const scrolls = scrollViews();
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0].props).toMatchObject({ contentInsetAdjustmentBehavior: "automatic", automaticallyAdjustKeyboardInsets: false });
    // A page that starts under a transparent header (Paket's photo) is not pushed below the bar.
    await view.rerender(
      <Screen bleed>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(scrollViews()).toHaveLength(1);
    expect(scrollViews()[0].props.contentInsetAdjustmentBehavior).toBe("never");
    // A tab root's mood header already pays the top inset (and the screen drops its top edge), so iOS must not add a
    // second one under it.
    await view.rerender(
      <Screen header={<Text>Mood</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(scrollViews()).toHaveLength(1);
    expect(scrollViews()[0].props.contentInsetAdjustmentBehavior).toBe("never");
  });

  it("Screen tones the Android top bar once the page scrolls and back at the top, only on the crossing", async () => {
    const setOptions = jest.fn();
    const navigation = { setOptions, isFocused: () => true, addListener: () => () => undefined };
    const onScroll = jest.fn();
    await render(
      <HeaderShownContext.Provider value>
        <NavigationContext.Provider value={navigation as never}>
          <Screen onScroll={onScroll}>
            <Text>Isi</Text>
          </Screen>
        </NavigationContext.Provider>
      </HeaderShownContext.Provider>,
    );
    const scroll = screen.getByTestId("screen-scroll");
    const at = async (y: number) => await fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y } } });
    const tones = () =>
      setOptions.mock.calls.filter(([o]) => "headerStyle" in o).map(([o]) => o.headerStyle.backgroundColor);
    // At rest the stack's own canvas bar stands; nothing is set until the page moves.
    expect(tones()).toEqual([]);
    // Material's scrolled state is the navigation bar's surface-container tone, set once however far the page goes.
    await at(1);
    await at(40);
    await at(400);
    expect(tones()).toEqual([nativeThemes.light.tabBar]);
    expect(nativeThemes.light.tabBar).toBe("#FFFFFF");
    // Back at the top, the canvas again, once.
    await at(0);
    await at(0);
    expect(tones()).toEqual([nativeThemes.light.tabBar, nativeThemes.light.canvas]);
    // The screen's own handler still hears every event.
    expect(onScroll).toHaveBeenCalledTimes(5);
  });

  it("iOS keeps the automatic inset under a mood header and the header pays no top inset there; Android as before", async () => {
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
    const view = await render(
      <Screen header={<Probe />}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(screen.getByText("in")).toBeTruthy();
    // The status band still paints the header colour under the status bar.
    expect(screen.getByTestId("status-band", { includeHiddenElements: true })).toBeTruthy();
    await view.rerender(
      <Screen scroll={false} header={<Probe />}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(screen.getByText("out")).toBeTruthy();
  });

  it("Screen leaves the bar alone on a tab root and under a photo header", async () => {
    const setOptions = jest.fn();
    const navigation = { setOptions, isFocused: () => true, addListener: () => () => undefined };
    const scrollTo = async (y: number) =>
      await fireEvent.scroll(screen.getByTestId("screen-scroll"), { nativeEvent: { contentOffset: { x: 0, y } } });
    // A tab root: no stack header above it.
    const view = await render(
      <NavigationContext.Provider value={navigation as never}>
        <Screen header={<Text>Mood</Text>}>
          <Text>Isi</Text>
        </Screen>
      </NavigationContext.Provider>,
    );
    await scrollTo(200);
    await view.unmount();
    // Paket's photo: the screen owns its bar while it scrolls.
    await render(
      <HeaderShownContext.Provider value>
        <NavigationContext.Provider value={navigation as never}>
          <Screen bleed>
            <Text>Isi</Text>
          </Screen>
        </NavigationContext.Provider>
      </HeaderShownContext.Provider>,
    );
    await scrollTo(200);
    expect(setOptions.mock.calls.filter(([o]) => "headerStyle" in o)).toEqual([]);
  });

  it("Screen adds no keyboard offset on Android", async () => {
    await render(
      <Screen footer={<Text>Kaki</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(screen.getByTestId("keyboard-avoiding").props.behavior).toBeUndefined();
    expect(screen.getByTestId("keyboard-avoiding").props.enabled).toBe(false);
    expect(screen.getByTestId("keyboard-avoiding").props.keyboardVerticalOffset).toBe(0);
  });

  it("Screen drops its own top inset under a stack header, and on Android names itself in a content line", async () => {
    mockWindow = DEFAULT_TEXT;
    const setOptions = jest.fn();
    const navigation = { setOptions, isFocused: () => true, addListener: () => () => undefined };
    const view = await render(
      <HeaderShownContext.Provider value>
        <NavigationContext.Provider value={navigation as never}>
          <Screen nativeTitle="Paket Makan Siang Rumahan Sehat Sekeluarga">
            <Text>Isi</Text>
          </Screen>
        </NavigationContext.Provider>
      </HeaderShownContext.Provider>,
    );
    // The native header pays the status-bar inset, so the screen adds none.
    expect(safeAreas()[0].props.edges).toEqual(["left", "right"]);
    // Headline small, 24/32, in Plus Jakarta Sans Bold, wrapping; the bar starts empty.
    const line = within(screen.getByTestId("screen-native-title")).getByText("Paket Makan Siang Rumahan Sehat Sekeluarga");
    expect(StyleSheet.flatten(line.props.style)).toMatchObject({ fontFamily: "Jakarta-Bold", fontSize: 24, lineHeight: 32 });
    expect(line.props.accessibilityRole).toBe("header");
    expect(setOptions).toHaveBeenLastCalledWith({ headerTitle: "" });
    await view.unmount();
    // A short bar title (Hari's day) sets the bar on both platforms and adds no content line.
    await render(
      <NavigationContext.Provider value={navigation as never}>
        <Screen title="Senin 12 Okt">
          <Text>Isi</Text>
        </Screen>
      </NavigationContext.Provider>,
    );
    expect(setOptions).toHaveBeenLastCalledWith({ title: "Senin 12 Okt" });
    expect(screen.queryByTestId("screen-native-title")).toBeNull();
  });

  it("the footer pays the bottom safe area on iOS, under the floating tab bar, and nothing more on Android", async () => {
    // Jest compiles `process.env.EXPO_OS` in (the Android build), so the footer takes the platform; the iOS result is
    // unverified on an iPhone.
    let view = await render(<ScreenFooter os="ios">{<Text>Kaki</Text>}</ScreenFooter>);
    const [ios] = safeAreas();
    expect(ios.props.testID).toBe("screen-footer");
    expect(ios.props.edges).toEqual(["bottom"]);
    // The inset adds to the footer's own padding, and its surface runs under the bar.
    expect(StyleSheet.flatten(ios.props.style)).toMatchObject({ paddingBottom: 20, backgroundColor: nativeThemes.light.surface });
    expect(within(screen.getByTestId("screen-footer")).getByText("Kaki")).toBeTruthy();
    await view.unmount();
    // Android: a plain view, as before. Inside the tabs NativeTabs already ends the screen above the navigation bar.
    view = await render(<ScreenFooter os="android">{<Text>Kaki</Text>}</ScreenFooter>);
    expect(screen.getByTestId("screen-footer")).toBeTruthy();
    expect(safeAreas()).toHaveLength(0);
    await view.unmount();
    // Screen draws its footer through it: on this (Android) build, one SafeAreaView for the screen and none for the footer.
    await render(
      <Screen footer={<Text>Kaki</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(safeAreas()).toHaveLength(1);
    // The footer's `os` defaults to the running platform: Android here, so the footer is the plain view.
    expect(safeAreas()[0].props.testID).not.toBe("screen-footer");
    expect(screen.getByTestId("screen-footer").props.edges).toBeUndefined();
  });

  it("HeroPager follows the cards down when one goes: 3 cards at the third, then 2, reads 2 dari 2", async () => {
    const pager = (count: number) => (
      <HeroPager count={count} counterLabel={(i) => `${i + 1} dari ${count}`} accessibilityLabelFor={() => "Makan siang"}>
        {Array.from({ length: count }, (_, i) => (
          <Text key={i}>{`Kartu ${i + 1}`}</Text>
        ))}
      </HeroPager>
    );
    const view = await render(pager(3));
    // To the third card.
    const control = () => screen.getByRole("adjustable");
    await fireEvent(control(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    await fireEvent(control(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(screen.getByText("3 dari 3")).toBeTruthy();
    // The third card goes away while it is the one in view.
    await view.rerender(pager(2));
    expect(screen.getByText("2 dari 2")).toBeTruthy();
    expect(control().props.accessibilityValue).toEqual({ text: "2 dari 2" });
    expect(StyleSheet.flatten(screen.getByTestId("hero-dot-1", { includeHiddenElements: true }).props.style).width).toBe(20);
    // It moves back from there, not from a card that is no longer there.
    await fireEvent(control(), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(screen.getByText("1 dari 2")).toBeTruthy();
  });
});

describe("dark theme", () => {
  const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
  const DARK = { forest: "#9CCBAE", cream: "#163D2E", canvas: "#151514", surface: "#292927" };

  beforeEach(() => {
    store.clear();
    (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(false);
  });

  // Mounts the tree under a provider whose stored preference is dark, and waits for that read to settle.
  async function renderDark(ui: ReactElement) {
    store.set("k", "dark");
    const view = await render(<ThemeProvider storageKey="k">{ui}</ThemeProvider>);
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith("k"));
    await act(async () => {});
    return view;
  }

  it("dark cards draw no border and no shadow: they stand off the page by tone (v2 and the classic card)", async () => {
    await renderDark(
      <>
        <LayoutScaleProvider value="v2">
          <Card testID="v2-card">
            <Text>a</Text>
          </Card>
        </LayoutScaleProvider>
        <Card testID="classic-card">
          <Text>b</Text>
        </Card>
      </>,
    );
    const v2 = StyleSheet.flatten(screen.getByTestId("v2-card").props.style);
    expect(v2).toMatchObject({ borderWidth: 0, padding: 16, backgroundColor: DARK.surface });
    expect(v2.boxShadow).toBeUndefined();
    // The classic card (Dapur) keeps its 1px border, drawn in the surface colour, so it is invisible in dark.
    const classic = StyleSheet.flatten(screen.getByTestId("classic-card").props.style);
    expect(classic).toMatchObject({ borderWidth: 1, borderColor: DARK.surface });
    expect(classic.boxShadow).toBeUndefined();
  });

  it("Text title uses the dark charcoal ink, never forest (direction K)", async () => {
    await renderDark(<Text variant="title">Jadwal</Text>);
    expect(StyleSheet.flatten(screen.getByText("Jadwal").props.style).color).toBe(nativeThemes.dark.charcoal);
  });

  it("primary Button is a light-forest fill with cream text", async () => {
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

  it("a disabled primary Button keeps the same light grey in light", async () => {
    await render(<Button label="Bayar" disabled onPress={() => {}} />);
    expect(StyleSheet.flatten(screen.getByRole("button", { name: "Bayar" }).props.style).backgroundColor).toBe("#CFD3C6");
  });

  it("Screen paints the dark canvas and its MoodHeader the dark mood header", async () => {
    const view = await renderDark(
      <Screen header={<MoodHeader title="Hari" />}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(StyleSheet.flatten(safeAreas()[0].props.style).backgroundColor).toBe(DARK.canvas);
    // No MoodProvider here, so the mood reads Siang: the dark Siang header and its headline ink.
    const fill = screen.getByTestId("mood-fill-siang", { includeHiddenElements: true });
    expect(StyleSheet.flatten(fill.props.style).backgroundColor).toBe(nativeMood.dark.siang.header);
    expect(StyleSheet.flatten(screen.getByText("Hari").props.style).color).toBe(nativeMood.dark.siang.headerText);
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
    await renderDark(<Field label="Ceritakan masalahnya" multiline style={{ minHeight: 120, textAlignVertical: "top" }} />);
    const flat = StyleSheet.flatten(screen.getByLabelText("Ceritakan masalahnya").props.style);
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

  it("Field error text can be selected and copied", async () => {
    await render(<Field label="Nama" error="Wajib diisi" />);
    expect(screen.getByText("Wajib diisi").props.selectable).toBe(true);
  });

  it("Text forwards selectable", async () => {
    await render(<Text selectable>Salin</Text>);
    expect(screen.getByText("Salin").props.selectable).toBe(true);
  });
});

describe("layout scale", () => {
  const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never);
  const sample = (
    <>
      <Button label="Lanjut" onPress={() => {}} />
      <Chip label="Halal" selected={false} onPress={() => {}} />
      <Segmented options={[{ value: "a", label: "Satu" }, { value: "b", label: "Dua" }]} value="a" onChange={() => {}} />
      <Field label="Nama" />
    </>
  );

  it("v2 geometry: button 50 and fully round, chip and segment 34, field 50", async () => {
    await render(<LayoutScaleProvider value="v2">{sample}</LayoutScaleProvider>);
    expect(flat(screen.getByRole("button", { name: "Lanjut" }))).toMatchObject({ minHeight: 50, borderRadius: 25 });
    const chip = screen.getByRole("button", { name: "Halal" });
    expect(flat(chip)).toMatchObject({ minHeight: 34, borderRadius: 17 });
    expect(chip.props.hitSlop).toEqual({ top: 5, bottom: 5 });
    const segment = screen.getByRole("tab", { name: "Satu" });
    expect(flat(segment)).toMatchObject({ minHeight: 34, borderRadius: 17 });
    expect(segment.props.hitSlop).toEqual({ top: 5, bottom: 5 });
    expect(flat(screen.getByLabelText("Nama"))).toMatchObject({ minHeight: 50 });
  });

  it("v2 without target keeps hitSlop 5", async () => {
    let target = 0;
    function Probe() {
      target = useTouchTarget();
      return null;
    }
    await render(
      <LayoutScaleProvider value="v2">
        <Probe />
        {sample}
        <Stepper label="Porsi" decreaseLabel="Kurangi" increaseLabel="Tambah" value={2} onChange={() => {}} />
      </LayoutScaleProvider>,
    );
    expect(target).toBe(44);
    expect(screen.getByRole("button", { name: "Halal" }).props.hitSlop).toEqual({ top: 5, bottom: 5 });
    for (const name of ["Satu", "Dua"]) expect(screen.getByRole("tab", { name }).props.hitSlop).toEqual({ top: 5, bottom: 5 });
    // A 44 circle already meets the 44 target, so the stepper buttons carry no slop, as before.
    for (const name of ["Kurangi", "Tambah"]) expect(screen.getByRole("button", { name }).props.hitSlop).toBeUndefined();
  });

  it("v2 geometry: a text button is 50 tall, a card is radius 16 with padding 16 and gap 8", async () => {
    await render(
      <LayoutScaleProvider value="v2">
        <Button label="Nanti" variant="text" onPress={() => {}} />
        <Card testID="card">
          <Text testID="in-card">Isi</Text>
        </Card>
      </LayoutScaleProvider>,
    );
    expect(flat(screen.getByRole("button", { name: "Nanti" })).minHeight).toBe(50);
    // Light draws a 1px hairline, so the padding gives it up: border plus padding is still 16.
    expect(flat(screen.getByTestId("card"))).toMatchObject({ borderRadius: 16, padding: 15, gap: 8, borderWidth: 1 });
  });

  it("v2 geometry: a light card has a hairline and a faint shadow, the attention tone keeps its warm edge, all sit 16 in", async () => {
    await render(
      <LayoutScaleProvider value="v2">
        <Card testID="surface">
          <Text>a</Text>
        </Card>
        <Card testID="sage" tone="sage">
          <Text>b</Text>
        </Card>
        <Card testID="attention" tone="attention">
          <Text>c</Text>
        </Card>
      </LayoutScaleProvider>,
    );
    const light = nativeThemes.light;
    expect(flat(screen.getByTestId("surface"))).toMatchObject({
      borderWidth: 1, borderColor: light.cardBorder, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", backgroundColor: light.surface, padding: 15,
    });
    // The sage fill is 1.10:1 on white, so it carries the same hairline and shadow as a white card.
    expect(flat(screen.getByTestId("sage"))).toMatchObject({
      borderWidth: 1, borderColor: light.cardBorder, boxShadow: light.cardShadow, backgroundColor: light.sage, padding: 15,
    });
    const attention = flat(screen.getByTestId("attention"));
    expect(attention.borderColor).toBe(nativeThemes.light.attentionBorder);
    expect(attention.borderWidth + (attention.padding as number)).toBe(16);
  });

  it("the tab bar is white on iOS and a filled step on Android, which has no divider", () => {
    expect(tabBarColors(nativeThemes.light, "ios")).toMatchObject({ backgroundColor: "#FFFFFF" });
    expect(tabBarColors(nativeThemes.light, "android")).toMatchObject({ backgroundColor: "#E9E9E7", indicatorColor: "#C6C6C2" });
    expect(tabBarColors(nativeThemes.dark, "android").backgroundColor).toBe(nativeThemes.dark.tabBar);
  });

  it("the classic card (Dapur) gets the same light hairline and shadow, with its padding unchanged", async () => {
    await render(
      <Card testID="classic">
        <Text>a</Text>
      </Card>,
    );
    expect(flat(screen.getByTestId("classic"))).toMatchObject({
      borderWidth: 1, borderColor: nativeThemes.light.cardBorder, boxShadow: nativeThemes.light.cardShadow, padding: 16,
    });
  });

  it("v2 geometry: the screen body takes the 16 margin", async () => {
    await render(
      <LayoutScaleProvider value="v2">
        <Screen>
          <Text>Isi</Text>
        </Screen>
      </LayoutScaleProvider>,
    );
    expect(flat(screen.getByTestId("screen-body")).paddingHorizontal).toBe(16);
  });

  it("v2 geometry: the footer is filled with the canvas, with 16 under it and a line hairline on top in light", async () => {
    // A surface-coloured bar would swallow the edge of a card scrolling under it; the canvas fill keeps a visible tone step.
    await render(
      <LayoutScaleProvider value="v2">
        <ScreenFooter>
          <Text>Kaki</Text>
        </ScreenFooter>
      </LayoutScaleProvider>,
    );
    const footer = flat(screen.getByTestId("screen-footer"));
    expect(footer).toMatchObject({ backgroundColor: nativeThemes.light.canvas, paddingBottom: 16, borderTopWidth: 1, borderTopColor: nativeThemes.light.line });
  });

  it("v2 geometry: the stepper's buttons are 44 circles on the glyph tone and a leading node sits before the label", async () => {
    await render(
      <LayoutScaleProvider value="v2">
        <Stepper
          testID="stepper"
          leading={<Text>Ikon</Text>}
          label="Porsi"
          value={2}
          onChange={() => {}}
          decreaseLabel="Decrease Porsi"
          increaseLabel="Increase Porsi"
        />
      </LayoutScaleProvider>,
    );
    expect(flat(screen.getByRole("button", { name: "Decrease Porsi" }))).toMatchObject({
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: nativeThemes.light.sage,
    });
    expect(flat(screen.getByRole("button", { name: "Increase Porsi" }))).toMatchObject({ width: 44, height: 44 });
    expect(flat(screen.getByTestId("stepper")).minHeight).toBe(56);
    // Forest marks selection and the one primary control only: the glyphs are ink.
    expect(flat(screen.getByText("−")).color).toBe(nativeThemes.light.charcoal);
    expect(flat(screen.getByText("+")).color).toBe(nativeThemes.light.charcoal);
    expect(within(screen.getByTestId("stepper")).getByText("Ikon")).toBeTruthy();
  });

  it("classic geometry: the footer keeps the surface fill and its hairline, and the stepper its 48 buttons", async () => {
    await render(
      <>
        <ScreenFooter>
          <Text>Kaki</Text>
        </ScreenFooter>
        <Stepper label="Porsi" value={2} onChange={() => {}} decreaseLabel="Decrease Porsi" increaseLabel="Increase Porsi" />
      </>,
    );
    expect(flat(screen.getByTestId("screen-footer"))).toMatchObject({
      backgroundColor: nativeThemes.light.surface,
      paddingBottom: 20,
      borderTopWidth: 1,
    });
    const less = flat(screen.getByRole("button", { name: "Decrease Porsi" }));
    expect(less).toMatchObject({ width: 48, height: 48 });
    expect(less.backgroundColor).toBeUndefined();
    expect(flat(screen.getByText("−")).color).toBe(nativeThemes.light.forest);
  });

  it("v2 geometry: the new type ladder", async () => {
    mockWindow = DEFAULT_TEXT;
    await render(
      <>
        <Text variant="largeTitle">a</Text>
        <Text variant="heroTitle">b</Text>
        <Text variant="section">c</Text>
        <Text variant="rowTitle">d</Text>
        <Text variant="bodyL">e</Text>
        <Text variant="bodyStrong">f</Text>
        <Text variant="meta">g</Text>
      </>,
    );
    const s = (name: string) => flat(screen.getByText(name));
    expect(s("a")).toMatchObject({ fontSize: 32, lineHeight: 40, letterSpacing: -0.8, fontFamily: "Jakarta-Bold" });
    expect(s("b")).toMatchObject({ fontSize: 24, lineHeight: 30, letterSpacing: -0.4, fontFamily: "Jakarta-Bold" });
    expect(s("c")).toMatchObject({ fontSize: 20, lineHeight: 26, letterSpacing: -0.2, fontFamily: "Jakarta-Bold" });
    expect(s("d")).toMatchObject({ fontSize: 17, lineHeight: 22, fontFamily: "Jakarta-SemiBold" });
    expect(s("e")).toMatchObject({ fontSize: 15, lineHeight: 22, fontFamily: "Jakarta" });
    expect(s("f")).toMatchObject({ fontSize: 15, lineHeight: 22, fontFamily: "Jakarta-SemiBold" });
    expect(s("g")).toMatchObject({ fontSize: 13, lineHeight: 18, color: nativeThemes.light.muted });
  });

  it("classic geometry unchanged without a provider", async () => {
    await render(
      <>
        {sample}
        <Card testID="card">
          <Text testID="in-card">Isi</Text>
        </Card>
        <Screen>
          <Text>Isi</Text>
        </Screen>
      </>,
    );
    expect(flat(screen.getByRole("button", { name: "Lanjut" }))).toMatchObject({ minHeight: 48, borderRadius: 10 });
    const chip = screen.getByRole("button", { name: "Halal" });
    expect(flat(chip)).toMatchObject({ minHeight: 48, borderRadius: 9 });
    expect(chip.props.hitSlop).toBeUndefined();
    expect(flat(screen.getByRole("tab", { name: "Satu" })).minHeight).toBe(48);
    expect(flat(screen.getByLabelText("Nama"))).toMatchObject({ minHeight: 48, borderRadius: 9 });
    expect(flat(screen.getByTestId("card"))).toMatchObject({ borderRadius: 16, padding: 16, gap: 10, borderWidth: 1 });
    expect(flat(screen.getByTestId("screen-body")).paddingHorizontal).toBe(20);
  });

  it("the margin hook reads 16 under v2 and 20 otherwise", async () => {
    const Probe = () => <Text testID="margin">{String(useScreenMargin())}</Text>;
    await render(<Probe />);
    expect(screen.getByTestId("margin").props.children).toBe("20");
    await render(
      <LayoutScaleProvider value="v2">
        <Probe />
      </LayoutScaleProvider>,
    );
    expect(screen.getByTestId("margin").props.children).toBe("16");
  });

  it("nativeLayout carries the spec values", () => {
    expect(nativeLayout.control).toEqual({ button: 50, field: 50, search: 44, chip: 34, icon: 44 });
    expect(nativeLayout.row).toEqual({ single: 56, media: 72, keyValue: 40, info: 48, compact: 64, check: 56 });
    expect(nativeLayout.space).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 });
  });
});

describe("Screen bottom inset without a footer", () => {
  const insets = () => require("react-native-safe-area-context").useSafeAreaInsets as jest.Mock;
  const withNavBar = async (run: () => Promise<void>) => {
    const original = insets().getMockImplementation();
    insets().mockImplementation(() => ({ top: 0, bottom: 24, left: 0, right: 0 }));
    try {
      await run();
    } finally {
      insets().mockImplementation(original);
    }
  };
  const nav = (type: string) => ({ isFocused: () => true, getState: () => ({ type }), getParent: () => undefined, setOptions: jest.fn(), addListener: jest.fn(() => () => {}) });
  const mount = async (type: string, footer?: boolean) =>
    await render(
      <LayoutScaleProvider value="v2">
        <NavigationContext.Provider value={nav(type) as never}>
          <Screen footer={footer ? <Text>Kaki</Text> : undefined}>
            <Text>Isi</Text>
          </Screen>
        </NavigationContext.Provider>
      </LayoutScaleProvider>,
    );
  const bottom = () =>
    (StyleSheet.flatten(screen.getByTestId("screen-scroll").props.contentContainerStyle) as { paddingBottom: number }).paddingBottom;

  it("adds the navigation-bar inset outside the tabs", async () => {
    await withNavBar(async () => {
      await mount("stack");
      expect(bottom()).toBe(32 + 24);
    });
  });
  it("adds nothing inside the tabs", async () => {
    await withNavBar(async () => {
      await mount("tab");
      expect(bottom()).toBe(32);
    });
  });
  it("does not add it twice when a footer exists", async () => {
    await withNavBar(async () => {
      await mount("stack", true);
      expect(bottom()).toBe(32);
    });
  });
});

describe("Segmented at large text", () => {
  const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;
  const three = [
    { value: "a", label: "Pembatalan" },
    { value: "b", label: "Pembayaran" },
    { value: "c", label: "Lainnya" },
  ];
  const at = (window: { width: number; fontScale: number }) => void (mockWindow = { height: 800, scale: 3, ...window });
  afterEach(() => void (mockWindow = DEFAULT_WINDOW));

  it("Segmented with 3 options stacks into rows at font 1.3 in v2; classic unchanged", async () => {
    await at({ width: 360, fontScale: 1.3 });
    const view = await render(
      <LayoutScaleProvider value="v2">
        <Segmented options={three} value="b" onChange={() => {}} />
      </LayoutScaleProvider>,
    );
    expect(flat(screen.getByTestId("segmented")).flexDirection).toBe("column");
    for (const label of ["Pembatalan", "Pembayaran", "Lainnya"]) {
      const row = screen.getByRole("tab", { name: label });
      // A full-width 48 row: no flex share of a squeezed track, and no hit slop needed.
      expect(flat(row)).toMatchObject({ minHeight: 48, alignSelf: "stretch" });
      expect(flat(row).flex).toBeUndefined();
      expect(row.props.hitSlop).toBeUndefined();
      // The label never shrinks or gets cut: it wraps inside its row if it must.
      const text = screen.getByText(label);
      expect(text.props.adjustsFontSizeToFit).toBeFalsy();
      expect(text.props.numberOfLines).toBeUndefined();
    }
    await view.unmount();

    // Classic (Dapur) keeps its one row of flex segments at the same size.
    await render(<Segmented options={three} value="b" onChange={() => {}} />);
    expect(flat(screen.getByTestId("segmented")).flexDirection).toBe("row");
    expect(flat(screen.getByRole("tab", { name: "Pembatalan" }))).toMatchObject({ flex: 1, minHeight: 48 });
  });

  it("two options stay a row at font 1.3, and three stay a row on a wide screen", async () => {
    await at({ width: 360, fontScale: 1.3 });
    const view = await render(
      <LayoutScaleProvider value="v2">
        <Segmented options={three.slice(0, 2)} value="a" onChange={() => {}} />
      </LayoutScaleProvider>,
    );
    expect(flat(screen.getByTestId("segmented")).flexDirection).toBe("row");
    expect(flat(screen.getByRole("tab", { name: "Pembatalan" }))).toMatchObject({ flex: 1, minHeight: 34 });
    await view.unmount();
    await at({ width: 412, fontScale: 1 });
    await render(
      <LayoutScaleProvider value="v2">
        <Segmented options={three} value="a" onChange={() => {}} />
      </LayoutScaleProvider>,
    );
    expect(flat(screen.getByTestId("segmented")).flexDirection).toBe("row");
  });

  it("stacked rows keep the track and the chosen segment's colours in the dark palette", async () => {
    await at({ width: 360, fontScale: 1.3 });
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("seg", "dark");
    await render(
      <ThemeProvider storageKey="seg">
        <LayoutScaleProvider value="v2">
          <Segmented options={three} value="b" onChange={() => {}} />
        </LayoutScaleProvider>
      </ThemeProvider>,
    );
    await waitFor(() => expect(SecureStore.getItemAsync).toHaveBeenCalledWith("seg"));
    await act(async () => {});
    const dark = nativeThemes.dark;
    expect(flat(screen.getByTestId("segmented")).backgroundColor).toBe(dark.fill);
    expect(flat(screen.getByRole("tab", { name: "Pembayaran" })).backgroundColor).toBe(dark.forest);
    expect(flat(screen.getByRole("tab", { name: "Lainnya" })).backgroundColor).toBeUndefined();
  });
});
