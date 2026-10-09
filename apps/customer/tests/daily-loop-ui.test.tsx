import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet, Text as RNText } from "react-native";
import type { ComponentProps, ReactElement } from "react";
import * as Haptics from "expo-haptics";
import * as Reanimated from "react-native-reanimated";
import { nativeMood, nativeMotion, nativeThemes } from "@catera/design-tokens";
import {
  CheckRow,
  MoodProvider,
  Rantang,
  RantangTrack,
  StickyAction,
  StopRow,
  StoryViewer,
  ThemeProvider,
} from "@catera/mobile-ui";

// The customer setup has no SecureStore mock, so this file keeps its own in-memory one for the theme provider.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

const SIANG_NOW = () => new Date("2026-10-09T03:00:00Z"); // 10:00 WIB

function mount(ui: ReactElement, scheme: "light" | "dark" = "light") {
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
  return render(
    <ThemeProvider storageKey="daily-loop-test">
      <MoodProvider now={SIANG_NOW}>{ui}</MoodProvider>
    </ThemeProvider>,
  );
}

const byId = (id: string) => screen.getByTestId(id, { includeHiddenElements: true });
const flat = (id: string) => StyleSheet.flatten(byId(id).props.style);
const gone = (id: string) => screen.queryByTestId(id, { includeHiddenElements: true }) === null;

// The Svg host keeps a colour as a processed value and drops `"none"`, so a filled body is any non-null fill.
const bodyFilled = (id: string) => byId(id).props.fill != null;

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  // A spy's mocked return value outlives restoreAllMocks on a jest.fn made by a module factory.
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
});

describe("Rantang", () => {
  it("is a decorative drawing: an outline by default, tinted when filled, hidden from screen readers", () => {
    const view = mount(<Rantang size={24} color={nativeThemes.light.forest} />);
    expect(byId("rantang").props.accessibilityElementsHidden).toBe(true);
    expect(byId("rantang").props.importantForAccessibility).toBe("no-hide-descendants");
    expect(bodyFilled("rantang-body")).toBe(false);
    view.rerender(
      <ThemeProvider storageKey="daily-loop-test">
        <MoodProvider now={SIANG_NOW}>
          <Rantang size={24} color={nativeThemes.light.forest} filled />
        </MoodProvider>
      </ThemeProvider>,
    );
    expect(bodyFilled("rantang-body")).toBe(true);
    expect(byId("rantang-body").props.fillOpacity).toBe(0.3);
  });
});

describe("RantangTrack", () => {
  const LABELS: [string, string, string] = ["Dimasak", "Berangkat", "Sampai"];
  const RAIL = 200;
  const MARKER_HALF = 12;

  const track = (stage: "scheduled" | "preparing" | "out_for_delivery" | "delivered", caption = "Dimasak 10.15") => (
    <RantangTrack stage={stage} caption={caption} labels={LABELS} testID="journey" />
  );
  const measure = () =>
    act(() => {
      fireEvent(byId("journey-rail"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: RAIL, height: 40 } } });
    });
  const markerX = () => {
    const transform = flat("journey-marker").transform as { translateX: number }[];
    return transform[0].translateX + MARKER_HALF;
  };

  it.each([
    ["scheduled", 0, false],
    ["preparing", 0, true],
    ["out_for_delivery", RAIL / 2, true],
    ["delivered", RAIL, true],
  ] as const)("%s puts the marker at x %d with the box filled: %s", (stage, x, filled) => {
    mount(track(stage));
    measure();
    expect(markerX()).toBe(x);
    expect(bodyFilled("journey-marker-glyph-body")).toBe(filled);
  });

  it("is one element for a screen reader, labelled with the caption, and hides the three stop labels", () => {
    mount(track("preparing", "Dimasak 10.15"));
    expect(byId("journey").props.accessibilityLabel).toBe("Dimasak 10.15");
    expect(byId("journey").props.accessible).toBe(true);
    for (const label of LABELS) {
      const node = screen.getByText(label, { includeHiddenElements: true });
      // The hiding sits on the row that holds the labels, an ancestor of the text.
      expect(byId("journey-labels").props.accessibilityElementsHidden).toBe(true);
      expect(byId("journey-labels").props.importantForAccessibility).toBe("no-hide-descendants");
      expect(node).toBeTruthy();
    }
  });

  it("reads the hero inks: heroText for the marker, progress and caption, heroMeta for idle stops and labels", () => {
    const ink = nativeMood.light.siang;
    mount(track("out_for_delivery", "Berangkat 11.00"));
    measure();
    expect(flat("journey-progress").backgroundColor).toBe(ink.heroText);
    expect(flat("journey-line").backgroundColor).toBe(ink.heroMeta);
    expect(flat("journey-stop-0").backgroundColor).toBe(ink.heroText);
    expect(flat("journey-stop-1").backgroundColor).toBe(ink.heroText);
    expect(flat("journey-stop-2").backgroundColor).toBe(ink.heroMeta);
    expect(StyleSheet.flatten(screen.getByText("Berangkat 11.00").props.style)).toMatchObject({ color: ink.heroText, fontSize: 12 });
    expect(StyleSheet.flatten(screen.getByText("Sampai", { includeHiddenElements: true }).props.style).color).toBe(ink.heroMeta);
  });

  it("sets the position directly on the first render, with no timing", () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    mount(track("out_for_delivery"));
    measure();
    expect(timing).not.toHaveBeenCalled();
    expect(markerX()).toBe(RAIL / 2);
  });

  it("starts a withTiming of the feature duration when the stage changes after mount", () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = mount(track("preparing"));
    measure();
    view.rerender(
      <ThemeProvider storageKey="daily-loop-test">
        <MoodProvider now={SIANG_NOW}>{track("out_for_delivery")}</MoodProvider>
      </ThemeProvider>,
    );
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing).toHaveBeenCalledWith(0.5, expect.objectContaining({ duration: nativeMotion.feature }));
    measure();
    expect(markerX()).toBe(RAIL / 2);
  });

  it("moves instantly under reduced motion", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = mount(track("preparing"));
    view.rerender(
      <ThemeProvider storageKey="daily-loop-test">
        <MoodProvider now={SIANG_NOW}>{track("delivered")}</MoodProvider>
      </ThemeProvider>,
    );
    measure();
    expect(timing).not.toHaveBeenCalled();
    expect(markerX()).toBe(RAIL);
  });
});

describe("StoryViewer", () => {
  const viewer = (index: number, handlers: { onIndexChange?: (i: number) => void; onClose?: () => void } = {}) => (
    <StoryViewer
      count={4}
      index={index}
      onIndexChange={handlers.onIndexChange ?? (() => {})}
      onClose={handlers.onClose ?? (() => {})}
      header="Menu hari ini"
      closeLabel="Tutup"
    >
      <RNText>Isi cerita</RNText>
    </StoryViewer>
  );

  it("shows the header and the part, over a black ground", () => {
    mount(viewer(1));
    expect(screen.getByText("Menu hari ini")).toBeTruthy();
    expect(screen.getByText("Isi cerita")).toBeTruthy();
    expect(flat("story-viewer").backgroundColor).toBe("black");
  });

  it("draws one bar per part and fills the first index + 1", () => {
    mount(viewer(2));
    for (let i = 0; i < 4; i += 1) {
      expect(flat(`story-viewer-bar-${i}`).opacity).toBe(i <= 2 ? 1 : 0.4);
    }
    expect(gone("story-viewer-bar-4")).toBe(true);
    expect(byId("story-viewer-bars").props.accessibilityElementsHidden).toBe(true);
  });

  it("goes forward from the right half and does nothing on the last part", () => {
    const onIndexChange = jest.fn();
    const view = mount(viewer(1, { onIndexChange }));
    fireEvent.press(byId("story-viewer-next"));
    expect(onIndexChange).toHaveBeenCalledWith(2);
    onIndexChange.mockClear();
    view.rerender(
      <ThemeProvider storageKey="daily-loop-test">
        <MoodProvider now={SIANG_NOW}>{viewer(3, { onIndexChange })}</MoodProvider>
      </ThemeProvider>,
    );
    fireEvent.press(byId("story-viewer-next"));
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("goes back from the left half and does nothing on the first part", () => {
    const onIndexChange = jest.fn();
    const view = mount(viewer(2, { onIndexChange }));
    fireEvent.press(byId("story-viewer-prev"));
    expect(onIndexChange).toHaveBeenCalledWith(1);
    onIndexChange.mockClear();
    view.rerender(
      <ThemeProvider storageKey="daily-loop-test">
        <MoodProvider now={SIANG_NOW}>{viewer(0, { onIndexChange })}</MoodProvider>
      </ThemeProvider>,
    );
    fireEvent.press(byId("story-viewer-prev"));
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("hides the two tap halves from screen readers, which get the close button instead", () => {
    mount(viewer(0));
    for (const id of ["story-viewer-prev", "story-viewer-next"]) {
      expect(byId(id).props.accessible).toBe(false);
      expect(byId(id).props.importantForAccessibility).toBe("no");
      expect(byId(id).props.accessibilityElementsHidden).toBe(true);
    }
  });

  it("closes from a 48dp button named by closeLabel", () => {
    const onClose = jest.fn();
    mount(viewer(0, { onClose }));
    const close = screen.getByRole("button", { name: "Tutup" });
    expect(StyleSheet.flatten(close.props.style)).toMatchObject({ width: 48, height: 48 });
    fireEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("never advances on a timer", () => {
    jest.useFakeTimers();
    try {
      const onIndexChange = jest.fn();
      mount(viewer(1, { onIndexChange }));
      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      expect(onIndexChange).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("fades in and scales up from 0.92 over the feature duration on mount, instantly under reduced motion", () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = mount(viewer(0));
    expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: nativeMotion.feature }));
    view.unmount();
    timing.mockClear();
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(viewer(0));
    expect(timing).not.toHaveBeenCalled();
    expect(flat("story-viewer-stage").opacity).toBe(1);
    expect((flat("story-viewer-stage").transform as { scale: number }[])[0].scale).toBeCloseTo(1, 6);
  });

  it("starts the opening at opacity 0 and scale 0.92", () => {
    mount(viewer(0));
    expect(flat("story-viewer-stage").opacity).toBe(0);
    expect((flat("story-viewer-stage").transform as { scale: number }[])[0].scale).toBeCloseTo(0.92, 6);
  });

  it("steps through the parts for a screen reader with the header's increment and decrement actions", () => {
    const onIndexChange = jest.fn();
    mount(viewer(1, { onIndexChange }));
    const header = byId("story-viewer-header");
    expect(header.props.accessibilityRole).toBe("adjustable");
    expect(header.props.accessibilityValue).toEqual({ min: 1, max: 4, now: 2 });
    fireEvent(header, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    fireEvent(header, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(onIndexChange).toHaveBeenNthCalledWith(1, 2);
    expect(onIndexChange).toHaveBeenNthCalledWith(2, 0);
  });

  describe("swipe down", () => {
    // A single finger moving from y 100 to y 100 + dy over `ms` milliseconds, in React Native's touch history shape.
    const gesture = (dy: number, ms: number) => {
      const touch = (y: number, t: number) => ({
        touchActive: true,
        startPageX: 50,
        startPageY: 100,
        startTimeStamp: 0,
        currentPageX: 50,
        currentPageY: y,
        currentTimeStamp: t,
        previousPageX: 50,
        previousPageY: 100,
        previousTimeStamp: 0,
      });
      const event = (y: number, t: number) => ({
        nativeEvent: { touches: [], changedTouches: [], identifier: 1, timestamp: t },
        touchHistory: {
          indexOfSingleActiveTouch: 0,
          mostRecentTimeStamp: t,
          numberActiveTouches: 1,
          touchBank: [touch(y, t)],
        },
      });
      return { start: event(100, 0), end: event(100 + dy, ms) };
    };
    // PanResponder's handlers are called directly: the test renderer skips responder events on a view that does not
    // claim the touch at start, and the story only claims a downward move.
    const handler = (name: string) => byId("story-viewer").props[name] as (event: unknown) => unknown;
    const swipe = (dy: number, ms: number) => {
      const { start, end } = gesture(dy, ms);
      act(() => {
        handler("onResponderGrant")(start);
        handler("onResponderMove")(end);
        handler("onResponderRelease")(end);
      });
    };

    it("closes on a slow drag past 80dp", () => {
      const onClose = jest.fn();
      mount(viewer(1, { onClose }));
      swipe(120, 600);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes on a fast fling that is shorter than 80dp", () => {
      const onClose = jest.fn();
      mount(viewer(1, { onClose }));
      swipe(40, 50);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not close on a short, slow drag or an upward drag", () => {
      const onClose = jest.fn();
      mount(viewer(1, { onClose }));
      swipe(40, 600);
      swipe(-200, 100);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("claims the gesture once the finger has moved down past a small slop, and not before", () => {
      mount(viewer(1));
      const { start, end } = gesture(30, 100);
      handler("onResponderGrant")(start);
      expect(handler("onMoveShouldSetResponderCapture")(end)).toBe(true);
      screen.unmount();
      mount(viewer(1));
      const small = gesture(6, 100);
      handler("onResponderGrant")(small.start);
      expect(handler("onMoveShouldSetResponderCapture")(small.end)).toBe(false);
    });
  });
});

describe("CheckRow", () => {
  const row = (extra: Partial<ComponentProps<typeof CheckRow>> = {}) => (
    <CheckRow quantity={8} name="Ayam bakar" icon="sunny-outline" checked={false} onToggle={() => {}} testID="row" {...extra} />
  );

  it("is a checkbox with its state, labelled with the quantity and the dish", () => {
    const view = mount(row());
    const box = screen.getByRole("checkbox", { name: "8× Ayam bakar" });
    expect(box.props.accessibilityState).toMatchObject({ checked: false });
    view.rerender(
      <ThemeProvider storageKey="daily-loop-test">
        <MoodProvider now={SIANG_NOW}>{row({ checked: true })}</MoodProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole("checkbox", { name: "8× Ayam bakar" }).props.accessibilityState).toMatchObject({ checked: true });
  });

  it("presses through to onToggle with a tap haptic", () => {
    const onToggle = jest.fn();
    mount(row({ onToggle }));
    fireEvent.press(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it("is at least 56dp high and sets the quantity in tabular numerals", () => {
    mount(row());
    expect(StyleSheet.flatten(screen.getByRole("checkbox").props.style).minHeight).toBeGreaterThanOrEqual(56);
    expect(StyleSheet.flatten(screen.getByText("8").props.style).fontVariant).toEqual(["tabular-nums"]);
  });

  it("draws a 48dp ring that fills forest with a cream check once ticked", () => {
    const c = nativeThemes.light;
    const view = mount(row());
    expect(flat("row-box")).toMatchObject({ width: 48, height: 48, borderColor: c.controlRing });
    expect(flat("row-tick")).toMatchObject({ backgroundColor: c.forest, opacity: 0 });
    view.rerender(
      <ThemeProvider storageKey="daily-loop-test">
        <MoodProvider now={SIANG_NOW}>{row({ checked: true })}</MoodProvider>
      </ThemeProvider>,
    );
    // The mocked shared value is written in an effect, so the next render reads it.
    view.rerender(
      <ThemeProvider storageKey="daily-loop-test">
        <MoodProvider now={SIANG_NOW}>{row({ checked: true })}</MoodProvider>
      </ThemeProvider>,
    );
    expect(flat("row-tick").opacity).toBe(1);
    expect(flat("row-content").opacity).toBe(0.55);
    expect(byId("row-check-mark")).toBeTruthy();
  });

  it("strikes the name through and dims the row to 0.55 over the content duration when ticked", () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = mount(row());
    expect(StyleSheet.flatten(screen.getByText("Ayam bakar").props.style).textDecorationLine).not.toBe("line-through");
    expect(flat("row-content").opacity).toBe(1);
    view.rerender(
      <ThemeProvider storageKey="daily-loop-test">
        <MoodProvider now={SIANG_NOW}>{row({ checked: true })}</MoodProvider>
      </ThemeProvider>,
    );
    expect(StyleSheet.flatten(screen.getByText("Ayam bakar").props.style).textDecorationLine).toBe("line-through");
    expect(timing).toHaveBeenCalledWith(0.55, expect.objectContaining({ duration: nativeMotion.content }));
  });

  it("shows the meal icon when there is no photo, and the photo when there is", () => {
    const view = mount(row({ icon: "moon-outline" }));
    expect(byId("row-icon")).toBeTruthy();
    expect(gone("row-image")).toBe(true);
    view.rerender(
      <ThemeProvider storageKey="daily-loop-test">
        <MoodProvider now={SIANG_NOW}>{row({ image: "https://example.test/a.jpg" })}</MoodProvider>
      </ThemeProvider>,
    );
    expect(byId("row-image").props.source).toEqual({ uri: "https://example.test/a.jpg" });
    expect(gone("row-icon")).toBe(true);
  });

  it("lets a long dish name wrap and never truncates it", () => {
    mount(row({ name: "Nasi kuning dengan ayam bakar madu dan sambal terasi" }));
    expect(screen.getByText("Nasi kuning dengan ayam bakar madu dan sambal terasi").props.numberOfLines).toBeUndefined();
  });
});

describe("StopRow", () => {
  const ADDRESS = "Jl. Melati Raya No. 14, RT 03 RW 05, Kelurahan Cipete Selatan, Jakarta Selatan";
  const row = (extra: Partial<ComponentProps<typeof StopRow>> = {}) => (
    <StopRow
      n={3}
      name="Bu Rina"
      detail="8 porsi siang"
      address={ADDRESS}
      onMap={() => {}}
      mapLabel="Buka di Peta"
      {...extra}
    />
  );

  it("numbers the stop in a 28dp sage circle", () => {
    mount(row());
    expect(screen.getByText("3")).toBeTruthy();
    expect(flat("stop-row-badge")).toMatchObject({
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: nativeThemes.light.sage,
    });
  });

  it("keeps the address on one line and puts the whole address in the accessibility label", () => {
    mount(row());
    const address = screen.getByText(ADDRESS);
    expect(address.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(address.props.style).color).toBe(nativeThemes.light.muted);
    expect(byId("stop-row-info").props.accessibilityLabel).toContain(ADDRESS);
    expect(byId("stop-row-info").props.accessibilityLabel).toContain("Bu Rina");
    expect(byId("stop-row-info").props.accessibilityLabel).toContain("8 porsi siang");
  });

  it("sets the name and the detail together so they wrap as one line of text", () => {
    mount(row());
    const line = byId("stop-row-title");
    expect(line.props.numberOfLines).toBeUndefined();
    expect(screen.getByText("Bu Rina", { exact: false })).toBeTruthy();
    expect(screen.getByText("8 porsi siang", { exact: false })).toBeTruthy();
  });

  it("has a 48dp map button that calls onMap", () => {
    const onMap = jest.fn();
    mount(row({ onMap }));
    const map = screen.getByRole("button", { name: "Buka di Peta" });
    expect(StyleSheet.flatten(map.props.style)).toMatchObject({ width: 48, height: 48 });
    fireEvent.press(map);
    expect(onMap).toHaveBeenCalledTimes(1);
  });

  it("has a 48dp more button only when onMore is given", () => {
    const onMore = jest.fn();
    const view = mount(row({ onMore, moreLabel: "Laporkan masalah" }));
    const more = screen.getByRole("button", { name: "Laporkan masalah" });
    expect(StyleSheet.flatten(more.props.style)).toMatchObject({ width: 48, height: 48 });
    fireEvent.press(more);
    expect(onMore).toHaveBeenCalledTimes(1);
    view.rerender(
      <ThemeProvider storageKey="daily-loop-test">
        <MoodProvider now={SIANG_NOW}>{row()}</MoodProvider>
      </ThemeProvider>,
    );
    expect(screen.queryByRole("button", { name: "Laporkan masalah" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("StickyAction", () => {
  it("shows the label and the caption above it", () => {
    mount(<StickyAction label="Mulai masak" caption="12 porsi hari ini" onPress={() => {}} />);
    expect(screen.getByRole("button", { name: "Mulai masak" })).toBeTruthy();
    expect(screen.getByText("12 porsi hari ini")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText("12 porsi hari ini").props.style).color).toBe(nativeThemes.light.muted);
  });

  it("is padded 12 with a line on top, and capped at 760", () => {
    mount(<StickyAction label="Mulai masak" onPress={() => {}} testID="act" />);
    expect(flat("act")).toMatchObject({
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: nativeThemes.light.line,
      maxWidth: 760,
      width: "100%",
    });
    expect(screen.queryByText("12 porsi hari ini")).toBeNull();
  });

  it("presses through when idle", () => {
    const onPress = jest.fn();
    mount(<StickyAction label="Mulai masak" onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Mulai masak" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner and blocks presses while busy", () => {
    const onPress = jest.fn();
    mount(<StickyAction label="Mulai masak" onPress={onPress} busy testID="act" />);
    expect(byId("act-spinner")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Mulai masak" }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("blocks presses while disabled and shows no spinner", () => {
    const onPress = jest.fn();
    mount(<StickyAction label="Mulai masak" onPress={onPress} disabled testID="act" />);
    expect(gone("act-spinner")).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: "Mulai masak" }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
