import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { Keyboard, Modal, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import type { ReactElement } from "react";
import * as Haptics from "expo-haptics";
import * as Reanimated from "react-native-reanimated";
import { NavigationContext } from "expo-router/react-navigation";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { nativeMood } from "@catera/design-tokens";
import {
  DayArc,
  defaultMood,
  Field,
  MalamPattern,
  MoodFill,
  MoodHeader,
  MoodLabelsProvider,
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

  it("gives both tabs the width of the wider label, so the sliding pill never overhangs", () => {
    mount(<MoodToggle />);
    const content = (id: string, width: number) =>
      act(() => {
        fireEvent(screen.getByTestId(id, { includeHiddenElements: true }), "layout", {
          nativeEvent: { layout: { x: 0, y: 0, width, height: 20 } },
        });
      });
    const widthOf = (name: string) => StyleSheet.flatten(screen.getByRole("tab", { name }).props.style).width;
    expect(widthOf("Siang")).toBe(widthOf("Malam"));
    content("mood-tab-content-siang", 56);
    content("mood-tab-content-malam", 92);
    // The wider content plus the 12dp of padding on each side.
    expect(widthOf("Siang")).toBe(116);
    expect(widthOf("Malam")).toBe(116);
    const pill = StyleSheet.flatten(screen.getByTestId("mood-toggle-pill", { includeHiddenElements: true }).props.style);
    expect(pill.width).toBe(116);
    // A short pair of labels never shrinks the tabs under the 84dp floor.
    content("mood-tab-content-siang", 30);
    content("mood-tab-content-malam", 40);
    expect(widthOf("Siang")).toBe(84);
    expect(widthOf("Malam")).toBe(84);
  });

  it("reads Siang and Malam without a labels provider", () => {
    mount(<MoodToggle />);
    expect(screen.getByRole("tab", { name: "Siang" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Malam" })).toBeTruthy();
  });

  it("builds its labels from the translator the labels provider is given", () => {
    mockSystemScheme("light");
    // An English translator: t(id, en) answers with the second string.
    const t = jest.fn((_id: string, en: string) => en);
    render(
      <ThemeProvider storageKey="mood-test">
        <MoodProvider now={SIANG_NOW}>
          <MoodLabelsProvider t={t}>
            <MoodToggle />
          </MoodLabelsProvider>
        </MoodProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole("tab", { name: "Lunch" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dinner" })).toBeTruthy();
    expect(t).toHaveBeenCalledWith("Siang", "Lunch");
    expect(t).toHaveBeenCalledWith("Malam", "Dinner");
  });

  it("follows the translator when the language changes", () => {
    mockSystemScheme("light");
    const tree = (t: (id: string, en: string) => string) => (
      <ThemeProvider storageKey="mood-test">
        <MoodProvider now={SIANG_NOW}>
          <MoodLabelsProvider t={t}>
            <MoodToggle />
          </MoodLabelsProvider>
        </MoodProvider>
      </ThemeProvider>
    );
    const view = render(tree((id) => id));
    expect(screen.getByRole("tab", { name: "Siang" })).toBeTruthy();
    view.rerender(tree((_id, en) => en));
    expect(screen.getByRole("tab", { name: "Lunch" })).toBeTruthy();
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

  it("paints the title in headerText, in the title variant (30/39) that holds long names at large font scales", () => {
    mount(<MoodHeader title="Halo" />, { now: MALAM_NOW });
    expect(StyleSheet.flatten(screen.getByText("Halo").props.style).color).toBe(nativeMood.light.malam.headerText);
    expect(StyleSheet.flatten(screen.getByText("Halo").props.style)).toMatchObject({ fontSize: 30, lineHeight: 39 });
    expect(screen.getByText("Halo").props.accessibilityRole).toBe("header");
  });

  it("sets a short fixed headline in the display variant (34/40) when the caller opts in", () => {
    mount(<MoodHeader title="Halo" titleVariant="display" />);
    expect(StyleSheet.flatten(screen.getByText("Halo").props.style)).toMatchObject({ fontSize: 34, lineHeight: 40 });
  });

  it("keeps a 48dp top row whether it holds a meta line, a trailing control, the toggle or nothing", () => {
    // Pushed screens take the native header, so a mood header never carries a back button.
    for (const ui of [
      <MoodHeader key="empty" title="Halo" />,
      <MoodHeader key="meta" title="Halo" meta="Jumat" />,
      <MoodHeader key="trailing" title="Halo" trailing={<RNText>Aksi</RNText>} />,
      <MoodHeader key="toggle" title="Halo" toggle />,
    ]) {
      mount(ui);
      const row = screen.getByTestId("mood-header-row");
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({ minHeight: 48 });
      // The row comes first and the title right after it, so the title starts at one height on every tab.
      const content = screen.getByTestId("mood-header-content");
      const first = content.children[0];
      expect(typeof first === "string" ? first : first.props.testID).toBe("mood-header-row");
      expect(row).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull();
      screen.unmount();
    }
    // The toggle's 48dp tabs sit on a 3dp track; it overhangs the row evenly so the row stays 48.
    mount(<MoodHeader title="Halo" toggle />);
    const toggleSlot = screen.UNSAFE_getByProps({ accessibilityRole: "tablist" }).parent!.parent!;
    expect(StyleSheet.flatten(toggleSlot.props.style)).toMatchObject({ marginVertical: -3 });
  });

  it("sets the mood's status bar glyphs while its screen is focused and hands them back on blur", () => {
    const listeners: Record<string, (() => void)[]> = { focus: [], blur: [] };
    let focused = true;
    const navigation = {
      isFocused: () => focused,
      addListener: (event: string, cb: () => void) => {
        listeners[event].push(cb);
        return () => void listeners[event].splice(listeners[event].indexOf(cb), 1);
      },
    };
    const bars = () => screen.UNSAFE_queryAllByType(ReactNative.StatusBar).map((b) => b.props.barStyle);
    mount(
      <NavigationContext.Provider value={navigation as never}>
        <MoodHeader title="Halo" />
      </NavigationContext.Provider>,
      { now: MALAM_NOW },
    );
    // Light theme, Malam: the dark header wants light glyphs.
    expect(bars()).toEqual(["light-content"]);
    // A pushed screen covers it: its status bar unmounts, so the app's default (the theme's) shows again.
    focused = false;
    act(() => listeners.blur.forEach((cb) => cb()));
    expect(bars()).toEqual([]);
    focused = true;
    act(() => listeners.focus.forEach((cb) => cb()));
    expect(bars()).toEqual(["light-content"]);
    // With no mood header, only the theme decides.
    expect(statusBarStyle({ scheme: "light", mood: null, demo: false })).toBe("dark");
    expect(statusBarStyle({ scheme: "dark", mood: null, demo: false })).toBe("light");
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

  it("draws the Malam pattern inside the Malam fill, so it fades in and out with it", () => {
    // Siang is the current mood and the pattern is still there: it rides the fill's opacity instead of snapping.
    mount(<MoodHeader title="Halo" toggle />);
    const fill = screen.getByTestId("mood-fill-malam", { includeHiddenElements: true });
    const pattern = within(fill).getByTestId("malam-pattern", { includeHiddenElements: true });
    expect(pattern.props.accessibilityElementsHidden).toBe(true);
    expect(pattern.props.pointerEvents).toBe("none");
    expect(screen.getAllByTestId("malam-pattern", { includeHiddenElements: true })).toHaveLength(1);
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

describe("MoodFill", () => {
  it("stacks the Siang fill under a Malam fill that rides the mood, in the colours of the surface asked for", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(
      <>
        <View style={{ width: 100, height: 100 }}>
          <MoodFill surface="hero" testID="card-fill" />
        </View>
        <Probe />
      </>,
    );
    expect(flat("card-fill-siang")).toMatchObject({ backgroundColor: nativeMood.light.siang.hero, position: "absolute" });
    expect(flat("card-fill-malam")).toMatchObject({ backgroundColor: nativeMood.light.malam.hero, opacity: 0 });
    act(() => setMoodRef("malam"));
    expect(flat("card-fill-malam").opacity).toBe(1);
  });

  it("rounds both fills when given a radius, and shadows only the base fill from the current mood", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(
      <>
        <MoodFill surface="hero" testID="card-fill" radius={22} heroShadow />
        <Probe />
      </>,
    );
    expect(flat("card-fill-siang")).toMatchObject({ borderRadius: 22, borderCurve: "continuous", boxShadow: nativeMood.light.siang.heroShadow });
    expect(flat("card-fill-malam")).toMatchObject({ borderRadius: 22, borderCurve: "continuous" });
    expect(flat("card-fill-malam").boxShadow).toBeUndefined();
    act(() => setMoodRef("malam"));
    expect(flat("card-fill-siang").boxShadow).toBe(nativeMood.light.malam.heroShadow);
  });

  it("casts no shadow and has no radius unless asked, and its children ride the Malam layer", () => {
    mount(
      <MoodFill surface="header" testID="plain-fill">
        <RNText testID="inside">dalam</RNText>
      </MoodFill>,
    );
    expect(flat("plain-fill-siang").boxShadow).toBeUndefined();
    expect(flat("plain-fill-siang").borderRadius).toBeUndefined();
    expect(within(screen.getByTestId("plain-fill-malam", { includeHiddenElements: true })).getByTestId("inside")).toBeTruthy();
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

describe("StatusBand", () => {
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 30, left: 0, right: 0, bottom: 0 } };
  const mountScreen = (owned: boolean, withHeader = true) => {
    mockSystemScheme("light");
    return render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider storageKey="mood-test">
          <MoodProvider now={MALAM_NOW}>
            <TopInsetOwner owned={owned}>
              <Screen header={withHeader ? <Text>Kepala</Text> : undefined}>
                <Text>Isi</Text>
              </Screen>
            </TopInsetOwner>
          </MoodProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
  };

  it("fills the status-bar inset with the mood header colour above a header screen", () => {
    mountScreen(false);
    const band = flat("status-band");
    expect(band.height).toBe(30);
    expect(band).toMatchObject({ position: "absolute", top: 0, left: 0, right: 0 });
    // Malam at rest: the Siang fill underneath, the Malam header colour fully opaque over it.
    expect(flat("status-band-fill-siang").backgroundColor).toBe(nativeMood.light.siang.header);
    expect(flat("status-band-fill-malam").backgroundColor).toBe("#0B1F16");
    expect(flat("status-band-fill-malam").opacity).toBe(1);
  });

  it("fades with the header when the mood switches, instead of snapping (instant under reduced motion)", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mockSystemScheme("light");
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider storageKey="mood-test">
          <MoodProvider now={SIANG_NOW}>
            <Screen header={<MoodHeader title="Kepala" toggle />}>
              <Text>Isi</Text>
            </Screen>
          </MoodProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    // The band and the header are two fills of one mood: both read Siang, then both read Malam.
    expect(flat("status-band-fill-malam").opacity).toBe(0);
    expect(flat("mood-fill-malam").opacity).toBe(0);
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(flat("status-band-fill-malam").opacity).toBe(1);
    expect(flat("mood-fill-malam").opacity).toBe(1);
  });

  it("eases the band's Malam layer like the header's once motion is allowed", () => {
    mockSystemScheme("light");
    const tree = (
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider storageKey="mood-test">
          <MoodProvider now={SIANG_NOW}>
            <Screen header={<MoodHeader title="Kepala" toggle />}>
              <Text>Isi</Text>
            </Screen>
          </MoodProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );
    const view = render(tree);
    expect(flat("status-band-fill-malam").opacity).toBe(0);
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    view.rerender(tree);
    expect(flat("status-band-fill-malam").opacity).toBe(1);
  });

  it("is decorative: hidden from screen readers and never takes a touch", () => {
    mountScreen(false);
    const band = screen.getByTestId("status-band", { includeHiddenElements: true });
    expect(band.props.accessibilityElementsHidden).toBe(true);
    expect(band.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(band.props.pointerEvents).toBe("none");
  });

  it("is painted after the scroll content, so scrolled content runs under it", () => {
    const view = mountScreen(false);
    const tree = JSON.stringify(view.toJSON());
    expect(tree.indexOf('"status-band"')).toBeGreaterThan(tree.indexOf('"screen-body"'));
  });

  it("is absent while the demo strip owns the inset", () => {
    mountScreen(true);
    expect(screen.queryByTestId("status-band", { includeHiddenElements: true })).toBeNull();
  });

  it("is absent on a screen without a header, which keeps its own top edge", () => {
    mountScreen(false, false);
    expect(screen.queryByTestId("status-band", { includeHiddenElements: true })).toBeNull();
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
