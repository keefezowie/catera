import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { Keyboard, Modal, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import type { ReactElement } from "react";
import * as Haptics from "expo-haptics";
import * as Reanimated from "react-native-reanimated";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { nativeMood } from "@catera/design-tokens";
import {
  DayArc,
  defaultMood,
  Field,
  MalamPattern,
  MoodHeader,
  MoodProvider,
  MoodToggle,
  Screen,
  Sheet,
  statusBarStyle,
  Text,
  ThemeProvider,
  TopInsetOwner,
  useMood,
  useMoodColors,
} from "@catera/mobile-ui";

// The customer setup has no SecureStore mock, so this file keeps its own in-memory one.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

const SIANG_NOW = () => new Date("2026-10-09T07:59:00Z"); // 14:59 WIB
const MALAM_NOW = () => new Date("2026-10-09T08:00:00Z"); // 15:00 WIB

let setMoodRef: (m: "siang" | "malam") => void = () => {};

function Probe() {
  const { mood, setMood } = useMood();
  const palette = useMoodColors();
  setMoodRef = setMood;
  return (
    <View>
      <RNText testID="mood">{mood}</RNText>
      <RNText testID="header">{palette.header}</RNText>
    </View>
  );
}

function mockSystemScheme(scheme: "light" | "dark") {
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
}

function mount(ui: ReactElement, { now = SIANG_NOW, scheme = "light" as "light" | "dark" } = {}) {
  mockSystemScheme(scheme);
  return render(
    <ThemeProvider storageKey="mood-test">
      <MoodProvider now={now}>{ui}</MoodProvider>
    </ThemeProvider>,
  );
}

const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
const text = (id: string) => screen.getByTestId(id).props.children;

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe("defaultMood", () => {
  it.each([
    ["2026-10-09T07:59:00Z", "siang"], // 14:59 WIB
    ["2026-10-09T08:00:00Z", "malam"], // 15:00 WIB
    ["2026-10-09T16:59:00Z", "malam"], // 23:59 WIB
    ["2026-10-09T17:00:00Z", "siang"], // 00:00 WIB the next day
  ])("%s gives %s", (iso, expected) => {
    expect(defaultMood(new Date(iso))).toBe(expected);
  });

  it("reads the Jakarta clock whatever the device timezone", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "America/Los_Angeles";
      expect(defaultMood(new Date("2026-10-09T08:00:00Z"))).toBe("malam");
      expect(defaultMood(new Date("2026-10-09T07:59:00Z"))).toBe("siang");
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("MoodProvider and colours", () => {
  it("starts from the clock and keeps the choice while the app is open", () => {
    mount(<Probe />, { now: MALAM_NOW });
    expect(text("mood")).toBe("malam");
    act(() => setMoodRef("siang"));
    expect(text("mood")).toBe("siang");
  });

  it("returns siang and a no-op setter without a provider", () => {
    render(<Probe />);
    expect(text("mood")).toBe("siang");
    act(() => setMoodRef("malam"));
    expect(text("mood")).toBe("siang");
  });

  it("useMoodColors follows the theme and the mood", () => {
    const light = mount(<Probe />, { now: MALAM_NOW, scheme: "light" });
    expect(text("header")).toBe("#0B1F16");
    light.unmount();
    mount(<Probe />, { now: SIANG_NOW, scheme: "dark" });
    expect(text("header")).toBe("#3A2617");
  });

  it("useMoodColors(mood) reads that mood without switching", () => {
    function Both() {
      return <RNText testID="both">{useMoodColors("malam").header + useMoodColors("siang").header}</RNText>;
    }
    mount(<Both />, { scheme: "light" });
    expect(text("both")).toBe(nativeMood.light.malam.header + nativeMood.light.siang.header);
  });
});

describe("statusBarStyle", () => {
  it.each([
    [{ scheme: "light", mood: "malam", demo: false }, "light"],
    [{ scheme: "light", mood: "malam", demo: true }, "dark"],
    [{ scheme: "dark", mood: "siang", demo: true }, "light"],
    [{ scheme: "light", mood: "siang", demo: false }, "dark"],
    [{ scheme: "dark", mood: "malam", demo: false }, "light"],
    [{ scheme: "dark", mood: "siang", demo: false }, "light"],
  ] as const)("%j is %s", (input, expected) => {
    expect(statusBarStyle(input)).toBe(expected);
  });
});

describe("MoodToggle", () => {
  it("is a tablist with Siang and Malam, and the active one is selected", () => {
    mount(<MoodToggle />);
    // The track itself is not an accessible element: grouping it would hide the two tabs from a screen reader.
    expect(screen.UNSAFE_getByProps({ accessibilityRole: "tablist" })).toBeTruthy();
    const siang = screen.getByRole("tab", { name: "Siang" });
    const malam = screen.getByRole("tab", { name: "Malam" });
    expect(siang.props.accessibilityState.selected).toBe(true);
    expect(malam.props.accessibilityState.selected).toBe(false);
  });

  it("pressing Malam sets the mood and fires the select haptic", () => {
    mount(
      <>
        <MoodToggle />
        <Probe />
      </>,
    );
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(text("mood")).toBe("malam");
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
  });

  it("pressing the tab that is already active changes nothing and stays quiet", () => {
    mount(<MoodToggle />);
    fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it("each tab is at least 48dp tall", () => {
    mount(<MoodToggle />);
    for (const tab of screen.getAllByRole("tab")) {
      expect(StyleSheet.flatten(tab.props.style).minHeight).toBeGreaterThanOrEqual(48);
    }
  });

  it("uses the labels the provider is given", () => {
    mockSystemScheme("light");
    render(
      <ThemeProvider storageKey="mood-test">
        <MoodProvider now={SIANG_NOW} labels={{ siang: "Lunch", malam: "Dinner" }}>
          <MoodToggle />
        </MoodProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole("tab", { name: "Lunch" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dinner" })).toBeTruthy();
  });
});

describe("MoodHeader", () => {
  it("cross-fades two stacked fills; Malam is fully opaque after the switch (instant under reduced motion)", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(
      <>
        <MoodHeader title="Halo" toggle />
        <Probe />
      </>,
    );
    expect(flat("mood-fill-siang").backgroundColor).toBe(nativeMood.light.siang.header);
    expect(flat("mood-fill-malam").backgroundColor).toBe(nativeMood.light.malam.header);
    expect(flat("mood-fill-malam").opacity).toBe(0);
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(flat("mood-fill-malam").opacity).toBe(1);
  });

  it("animates the Malam fill opacity once the header re-renders without reduced motion", () => {
    const view = mount(<MoodHeader title="Halo" toggle />);
    expect(flat("mood-fill-malam").opacity).toBe(0);
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    view.rerender(
      <ThemeProvider storageKey="mood-test">
        <MoodProvider now={SIANG_NOW}>
          <MoodHeader title="Halo" toggle />
        </MoodProvider>
      </ThemeProvider>,
    );
    expect(flat("mood-fill-malam").opacity).toBe(1);
  });

  it("paints the title in headerText", () => {
    mount(<MoodHeader title="Halo" />, { now: MALAM_NOW });
    expect(StyleSheet.flatten(screen.getByText("Halo").props.style).color).toBe(nativeMood.light.malam.headerText);
    expect(StyleSheet.flatten(screen.getByText("Halo").props.style)).toMatchObject({ fontSize: 34, lineHeight: 40 });
  });

  it("shows the meta line in headerMeta and lets a trailing node replace the toggle", () => {
    mount(<MoodHeader title="Halo" meta="Jumat, 9 Okt" trailing={<RNText>Aksi</RNText>} />, { now: MALAM_NOW });
    expect(StyleSheet.flatten(screen.getByText("Jumat, 9 Okt").props.style).color).toBe(nativeMood.light.malam.headerMeta);
    expect(screen.getByText("Aksi")).toBeTruthy();
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: "tablist" })).toBeNull();
  });

  it("renders the decorative day arc, hidden from accessibility", () => {
    mount(<MoodHeader title="Halo" arc />);
    const arc = screen.getByTestId("day-arc", { includeHiddenElements: true });
    expect(arc.props.accessibilityElementsHidden).toBe(true);
    expect(arc.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(StyleSheet.flatten(arc.props.style).height).toBe(70);
  });

  it("has no arc unless asked", () => {
    mount(<MoodHeader title="Halo" />);
    expect(screen.queryByTestId("day-arc", { includeHiddenElements: true })).toBeNull();
  });

  it("draws the Malam pattern only in Malam", () => {
    mount(
      <>
        <MoodHeader title="Halo" toggle />
        <Probe />
      </>,
    );
    expect(screen.queryByTestId("malam-pattern", { includeHiddenElements: true })).toBeNull();
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    const pattern = screen.getByTestId("malam-pattern", { includeHiddenElements: true });
    expect(pattern.props.accessibilityElementsHidden).toBe(true);
    expect(pattern.props.pointerEvents).toBe("none");
  });

  it("MalamPattern alone renders nothing in Siang", () => {
    mount(<MalamPattern />);
    expect(screen.queryByTestId("malam-pattern", { includeHiddenElements: true })).toBeNull();
  });

  it("makes room for an overlapping card: bottom padding of at least overlap + 16, and a 32 corner", () => {
    mount(<MoodHeader title="Halo" overlap={58} testID="hero-header" />);
    const style = flat("hero-header");
    expect(style.paddingBottom).toBeGreaterThanOrEqual(58 + 16);
    expect(style.borderBottomLeftRadius).toBe(32);
    expect(style.borderBottomRightRadius).toBe(32);
  });

  it("uses a 28 corner without overlap", () => {
    mount(<MoodHeader title="Halo" testID="plain-header" />);
    expect(flat("plain-header").borderBottomLeftRadius).toBe(28);
  });

  it("pays the status-bar inset itself, unless the demo strip owns it", () => {
    const metrics = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 30, left: 0, right: 0, bottom: 0 } };
    const top = (owned: boolean) => {
      mockSystemScheme("light");
      const view = render(
        <SafeAreaProvider initialMetrics={metrics}>
          <ThemeProvider storageKey="mood-test">
            <MoodProvider now={SIANG_NOW}>
              <TopInsetOwner owned={owned}>
                <MoodHeader title="Halo" testID="h" />
              </TopInsetOwner>
            </MoodProvider>
          </ThemeProvider>
        </SafeAreaProvider>,
      );
      const value = flat("h").paddingTop as number;
      view.unmount();
      return value;
    };
    const owned = top(true);
    expect(top(false)).toBe(owned + 30);
  });

  it("caps its content at 760 and centres it", () => {
    mount(<MoodHeader title="Halo" />);
    expect(flat("mood-header-content")).toMatchObject({ maxWidth: 760, width: "100%", alignSelf: "center" });
  });
});

describe("DayArc", () => {
  const layout = () => fireEvent(screen.getByTestId("day-arc", { includeHiddenElements: true }), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 70 } },
  });

  it("draws nothing inside until it knows its width", () => {
    mount(<DayArc />);
    expect(screen.queryByTestId("day-arc-active", { includeHiddenElements: true })).toBeNull();
  });

  it("moves the active disc from the sun end to the moon end (instant under reduced motion)", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(
      <>
        <DayArc />
        <MoodToggle />
      </>,
    );
    layout();
    const at = () => {
      const t = flat("day-arc-active").transform as { translateX?: number; translateY?: number }[];
      return { x: t.find((p) => "translateX" in p)!.translateX!, y: t.find((p) => "translateY" in p)!.translateY! };
    };
    const sun = at();
    expect(flat("day-arc-active")).toMatchObject({ width: 40, height: 40 });
    expect(flat("day-arc-active").backgroundColor).toBe(nativeMood.light.siang.markerActive);
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    const moon = at();
    expect(moon.x).toBeGreaterThan(sun.x);
    expect(flat("day-arc-active").backgroundColor).toBe(nativeMood.light.malam.markerActive);
    expect(flat("day-arc-sun-glyph").opacity).toBe(0);
    expect(flat("day-arc-moon-glyph").opacity).toBe(1);
  });

  it("keeps an idle sun and moon outline, 32dp, in markerIdle", () => {
    mount(<DayArc />);
    layout();
    for (const id of ["day-arc-idle-sun", "day-arc-idle-moon"]) {
      expect(flat(id)).toMatchObject({ width: 32, height: 32, borderColor: nativeMood.light.siang.markerIdle });
    }
  });
});

describe("Text display variant", () => {
  it("is 34/40 with tight tracking", () => {
    render(<Text variant="display">Besar</Text>);
    expect(StyleSheet.flatten(screen.getByText("Besar").props.style)).toMatchObject({
      fontSize: 34,
      lineHeight: 40,
      letterSpacing: -1,
      fontFamily: "Jakarta-ExtraBold",
    });
  });
});

describe("Screen with a header", () => {
  it("renders the header before the body and leaves the top inset to it", () => {
    const view = render(
      <Screen header={<Text testID="hdr">Kepala</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    const tree = JSON.stringify(view.toJSON());
    expect(tree.indexOf('"hdr"')).toBeGreaterThan(-1);
    expect(tree.indexOf('"hdr"')).toBeLessThan(tree.indexOf('"screen-body"'));
    expect(view.UNSAFE_getByType(SafeAreaView).props.edges).toEqual(["left", "right"]);
  });

  it("puts the header inside the scroll view so it scrolls away with the page", () => {
    const view = render(
      <Screen header={<Text testID="hdr">Kepala</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    const scroll = view.UNSAFE_getByType(ReactNative.ScrollView);
    expect(scroll.findByProps({ testID: "hdr" })).toBeTruthy();
  });

  it("keeps the header above a non-scrolling body", () => {
    const view = render(
      <Screen scroll={false} header={<Text testID="hdr">Kepala</Text>}>
        <Text>Isi</Text>
      </Screen>,
    );
    const tree = JSON.stringify(view.toJSON());
    expect(tree.indexOf('"hdr"')).toBeLessThan(tree.indexOf('"screen-body"'));
    expect(view.UNSAFE_queryByType(ReactNative.ScrollView)).toBeNull();
  });

  it("keeps the top edge when there is no header", () => {
    const view = render(
      <Screen>
        <Text>Isi</Text>
      </Screen>,
    );
    expect(view.UNSAFE_getByType(SafeAreaView).props.edges).toEqual(["top", "left", "right"]);
  });
});

describe("Sheet keyboard", () => {
  // Since the Modal is navigationBarTranslucent, Android no longer resizes it for the keyboard, so the sheet lifts
  // itself by the keyboard height.
  function captureKeyboard() {
    const handlers: Record<string, (e: unknown) => void> = {};
    const remove = jest.fn();
    jest.spyOn(Keyboard, "addListener").mockImplementation(((name: string, cb: (e: unknown) => void) => {
      handlers[name] = cb;
      return { remove };
    }) as never);
    return { handlers, remove };
  }
  const sheetPadding = () =>
    StyleSheet.flatten(screen.UNSAFE_getAllByProps({ accessibilityViewIsModal: true })[0].props.style).paddingBottom;

  it("pads the sheet by the keyboard height while it is open, and releases it on hide", () => {
    const { handlers } = captureKeyboard();
    render(
      <Sheet visible onClose={() => {}} title="Pindah" closeLabel="Tutup">
        <Field label="Alasan" value="" onChangeText={() => {}} />
      </Sheet>,
    );
    expect(sheetPadding()).toBe(20);
    act(() => handlers.keyboardDidShow({ endCoordinates: { height: 300 } }));
    expect(sheetPadding()).toBeGreaterThanOrEqual(300);
    act(() => handlers.keyboardDidHide({}));
    expect(sheetPadding()).toBe(20);
  });

  it("scrolls its content only once it outgrows the room above the keyboard", () => {
    const view = render(
      <Sheet visible onClose={() => {}} title="Pelanggan" closeLabel="Tutup">
        <Field label="Nama" value="" onChangeText={() => {}} />
      </Sheet>,
    );
    const body = () => view.UNSAFE_getByType(ScrollView);
    expect(body().props.keyboardShouldPersistTaps).toBe("handled");
    expect(body().props.scrollEnabled).toBe(false);
    act(() => body().props.onLayout({ nativeEvent: { layout: { height: 300 } } }));
    act(() => body().props.onContentSizeChange(320, 300));
    expect(body().props.scrollEnabled).toBe(false);
    act(() => body().props.onContentSizeChange(320, 640));
    expect(body().props.scrollEnabled).toBe(true);
  });

  it("keeps the sheet below the status bar and the scrim behind the whole window", () => {
    const metrics = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 30, left: 0, right: 0, bottom: 0 } };
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Sheet visible onClose={() => {}} title="Pelanggan" closeLabel="Tutup">
          <Text>Isi</Text>
        </Sheet>
      </SafeAreaProvider>,
    );
    const sheet = StyleSheet.flatten(screen.UNSAFE_getAllByProps({ accessibilityViewIsModal: true })[0].props.style);
    expect(sheet.marginTop).toBeGreaterThanOrEqual(30);
    const scrim = StyleSheet.flatten(screen.getByLabelText("Tutup", { includeHiddenElements: true }).props.style);
    expect(scrim).toMatchObject({ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 });
  });

  it("stops listening when the sheet closes or unmounts", () => {
    const { remove } = captureKeyboard();
    const view = render(
      <Sheet visible onClose={() => {}} title="Pindah" closeLabel="Tutup">
        <Text>Isi</Text>
      </Sheet>,
    );
    view.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("forgets the keyboard when the sheet is hidden while it is up", () => {
    const { handlers } = captureKeyboard();
    const sheet = (visible: boolean) => (
      <Sheet visible={visible} onClose={() => {}} title="Pindah" closeLabel="Tutup">
        <Text>Isi</Text>
      </Sheet>
    );
    const view = render(sheet(true));
    act(() => handlers.keyboardDidShow({ endCoordinates: { height: 300 } }));
    view.rerender(sheet(false));
    view.rerender(sheet(true));
    expect(sheetPadding()).toBe(20);
    expect(view.UNSAFE_getByType(Modal).props.visible).toBe(true);
  });
});
