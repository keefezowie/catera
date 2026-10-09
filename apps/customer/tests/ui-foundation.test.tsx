import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Platform, Pressable, StyleSheet, Text as RNText, View } from "react-native";
import type { ReactElement } from "react";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import * as Reanimated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoidingView, Modal, ScrollView } from "react-native";
import {
  AppHeader,
  Button,
  Chip,
  colors,
  DemoStrip,
  fontFor,
  fonts,
  PressableRow,
  PressableScale,
  RoundButton,
  Screen,
  Segmented,
  Sheet,
  Stepper,
  Text,
  ThemeProvider,
  TopInsetOwner,
  useThemePreference,
} from "@catera/mobile-ui";

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

describe("AppHeader", () => {
  it("shows a one-line title and a back button", () => {
    const onBack = jest.fn();
    render(<AppHeader title="Bantuan dan laporan" onBack={onBack} backLabel="Kembali" />);
    expect(screen.getByText("Bantuan dan laporan").props.numberOfLines).toBe(1);
    fireEvent.press(screen.getByRole("button", { name: "Kembali" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("modal shows a close button", () => {
    const onBack = jest.fn();
    render(<AppHeader title="Masuk" onBack={onBack} backLabel="Tutup" modal />);
    fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("has no button when there is nothing to go back to", () => {
    render(<AppHeader title="Hari" backLabel="Kembali" />);
    expect(screen.queryByRole("button")).toBeNull();
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
    expect(StyleSheet.flatten(label.props.style).color).toBe(colors.forest);
    const strip = screen.getByLabelText("Demo · data sintetis");
    expect(strip.props.accessibilityRole).toBe("text");
    const style = StyleSheet.flatten(strip.props.style);
    expect(style.backgroundColor).toBe(colors.sage);
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

  it("Sheet with an empty title renders no heading", () => {
    render(
      <Sheet visible onClose={() => {}} title="" closeLabel="Tutup">
        <Text>Isi</Text>
      </Sheet>,
    );
    expect(screen.queryByRole("header", { includeHiddenElements: true })).toBeNull();
  });

  it("Screen offsets the iOS keyboard by the window position of the screen", () => {
    jest.replaceProperty(Platform, "OS", "ios");
    const view = render(
      <Screen footer={<Text>Kaki</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    const safe = view.UNSAFE_getByType(SafeAreaView);
    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(0);
    // The header and demo strip sit above the screen, so the screen asks the OS where it really starts.
    mockWindowY = 96;
    act(() => safe.props.onLayout({ nativeEvent: { layout: { x: 0, y: 96, width: 390, height: 800 } } }));
    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(96);
  });

  it("Screen adds no keyboard offset on Android", () => {
    const view = render(
      <Screen footer={<Text>Kaki</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBeUndefined();
    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(0);
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

  it("Screen and AppHeader paint the dark canvas", async () => {
    const view = await renderDark(
      <>
        <AppHeader title="Hari" backLabel="Kembali" />
        <Screen>
          <Text>Isi</Text>
        </Screen>
      </>,
    );
    expect(StyleSheet.flatten(view.UNSAFE_getByType(SafeAreaView).props.style).backgroundColor).toBe(DARK.canvas);
    const bars = view.UNSAFE_getAllByType(View).filter((v) => StyleSheet.flatten(v.props.style)?.paddingBottom === 8);
    expect(bars.length).toBeGreaterThan(0);
    expect(StyleSheet.flatten(bars[0].props.style).backgroundColor).toBe(DARK.canvas);
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
    expect(sheetColor()).toBe(colors.surface);
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

  it("Text forwards selectable", () => {
    render(<Text selectable>Salin</Text>);
    expect(screen.getByText("Salin").props.selectable).toBe(true);
  });
});
