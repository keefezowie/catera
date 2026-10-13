import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import type { ReactElement } from "react";
import * as Reanimated from "react-native-reanimated";
import { nativeMood, nativeMotion } from "@catera/design-tokens";
import {
  MoodProvider,
  RantangTrack,
  ThemeProvider,
  trackCounts,
  trackStage,
  type TrackCounts,
  type TrackStage,
} from "@catera/mobile-ui";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-font", () => ({ ...jest.requireActual("expo-font"), isLoaded: () => true }));

const SIANG_NOW = () => new Date("2026-10-09T03:00:00Z");
const RAIL = 300;
const MARKER_HALF = 12;
const ink = nativeMood.light.siang;

const wrap = (ui: ReactElement) => (
  <ThemeProvider storageKey="rantang-track-test">
    <MoodProvider now={SIANG_NOW}>{ui}</MoodProvider>
  </ThemeProvider>
);
function mount(ui: ReactElement) {
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
  return render(wrap(ui));
}
const track = (stage: TrackStage, extra: { counts?: TrackCounts; caption?: string } = {}) => (
  <RantangTrack stage={stage} testID="journey" {...extra} />
);
const byId = (id: string) => screen.getByTestId(id, { includeHiddenElements: true });
const has = (id: string) => screen.queryByTestId(id, { includeHiddenElements: true }) !== null;
const flat = (id: string) => StyleSheet.flatten(byId(id).props.style);
const measure = () =>
  act(() => {
    fireEvent(byId("journey-rail"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: RAIL, height: 64 } } });
  });
const markerX = () => (flat("journey-marker").transform as { translateX: number }[])[0].translateX + MARKER_HALF;
const scaleX = () => (flat("journey-progress").transform as { scaleX: number }[])[0].scaleX;
const op = (id: string) => flat(id).opacity as number;

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
});

describe("RantangTrack", () => {
  it("the track has four stops at 0, a third, two thirds and the end", () => {
    mount(track("scheduled"));
    measure();
    expect([0, 1, 2, 3].map((i) => flat(`journey-stop-${i}`).left)).toEqual(["0%", `${100 / 3}%`, `${200 / 3}%`, "100%"]);
    expect(has("journey-stop-4")).toBe(false);
    const x = (stage: TrackStage) => {
      screen.unmount();
      mount(track(stage));
      measure();
      return markerX();
    };
    expect(markerX()).toBeCloseTo(0);
    expect(x("preparing")).toBeCloseTo(RAIL / 3);
    expect(x("out_for_delivery")).toBeCloseTo((2 * RAIL) / 3);
    expect(x("arrived_unconfirmed")).toBeCloseTo(RAIL);
    expect(x("delivered")).toBeCloseTo(RAIL);
  });

  it("scheduled and preparing sit at different stops", () => {
    mount(track("scheduled"));
    measure();
    expect(op("journey-stop-0-ring")).toBe(1);
    expect(op("journey-stop-1-ring")).toBe(0);
    expect(scaleX()).toBeCloseTo(0.0001);
    screen.unmount();
    mount(track("preparing"));
    measure();
    expect(op("journey-stop-0-ring")).toBe(0);
    expect(op("journey-stop-0-done")).toBe(1);
    expect(op("journey-stop-1-ring")).toBe(1);
    expect(flat("journey-stop-1-ring").borderColor).toBe(ink.stopActive);
    expect(scaleX()).toBeCloseTo(1 / 3);
  });

  it("done stops are filled heroText, the current stop has a stopActive ring and later stops are outlined heroMeta", () => {
    mount(track("out_for_delivery"));
    measure();
    expect(flat("journey-stop-0-done").backgroundColor).toBe(ink.heroText);
    expect(op("journey-stop-0-done")).toBe(1);
    expect(op("journey-stop-1-done")).toBe(1);
    expect(op("journey-stop-2-done")).toBe(0);
    expect(op("journey-stop-2-ring")).toBe(1);
    expect(op("journey-stop-3-ring")).toBe(0);
    expect(flat("journey-stop-3-ahead").borderColor).toBe(ink.heroMeta);
  });

  it("arrived_unconfirmed half fills Sampai and says it in words", () => {
    mount(track("arrived_unconfirmed"));
    measure();
    expect(has("journey-stop-3-half")).toBe(true);
    expect(op("journey-stop-3-done")).toBe(0);
    expect(op("journey-stop-3-ring")).toBe(1);
    expect(screen.getByText("Ditandai sampai, menunggu konfirmasimu")).toBeTruthy();
    screen.unmount();
    mount(track("delivered"));
    measure();
    expect(op("journey-stop-3-done")).toBe(1);
  });

  it("issue shows the warning stop and the words Gagal diantar", () => {
    mount(track("issue"));
    measure();
    expect(screen.getAllByText("Gagal diantar").length).toBeGreaterThan(0);
    expect(has("journey-stop-3-alert")).toBe(true);
    expect(flat("journey-stop-3-warn").borderColor).toBe(ink.heroWarn);
    expect(has("journey-dash")).toBe(true);
    expect(op("journey-stop-3-ring")).toBe(0);
    screen.unmount();
    mount(track("delivered"));
    expect(has("journey-dash")).toBe(false);
    expect(has("journey-stop-3-warn")).toBe(false);
  });

  it("nothing animates on first paint", () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    for (const stage of ["scheduled", "preparing", "out_for_delivery", "arrived_unconfirmed", "delivered", "issue"] as const) {
      mount(track(stage));
      measure();
      screen.unmount();
    }
    expect(timing).not.toHaveBeenCalled();
  });

  it("a stage change animates the fill with transform only", () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = mount(track("preparing"));
    measure();
    view.rerender(wrap(track("out_for_delivery")));
    expect(timing).toHaveBeenCalledWith(2, expect.objectContaining({ duration: nativeMotion.feature }));
    expect(scaleX()).toBeCloseTo(2 / 3);
    const style = flat("journey-progress");
    // The bar keeps its box; only transform (and the measured-opacity gate) changes.
    expect(style.width).toBeUndefined();
    expect(style.left).toBe(0);
    expect(style.right).toBe(0);
    expect(style.transformOrigin).toBe("left center");
    // A refresh with the same stage starts nothing.
    timing.mockClear();
    view.rerender(wrap(track("out_for_delivery", { caption: "Berangkat 11.00" })));
    expect(timing).not.toHaveBeenCalled();
  });

  it("reduced motion makes the change instant", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = mount(track("preparing"));
    view.rerender(wrap(track("delivered")));
    measure();
    expect(timing).not.toHaveBeenCalled();
    expect(markerX()).toBeCloseTo(RAIL);
    expect(op("journey-stop-3-done")).toBe(1);
  });

  it("the track never starts a loop", () => {
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    const view = mount(track("scheduled"));
    for (const stage of ["preparing", "out_for_delivery", "arrived_unconfirmed", "delivered", "issue"] as const) {
      view.rerender(wrap(track(stage)));
    }
    expect(repeat).not.toHaveBeenCalled();
  });

  it("the container reads one sentence", () => {
    mount(track("preparing", { caption: "Dimasak 10.15" }));
    expect(byId("journey").props.accessible).toBe(true);
    expect(byId("journey").props.accessibilityLabel).toBe("Pesanan: Dimasak, langkah 2 dari 4");
    expect(byId("journey").props.accessibilityValue).toEqual({ text: "Dimasak 10.15" });
    for (let i = 0; i < 4; i += 1) expect(byId(`journey-stop-${i}`).props.accessibilityElementsHidden).toBe(true);
    expect(byId("journey-labels").props.importantForAccessibility).toBe("no-hide-descendants");
    screen.unmount();
    mount(track("issue"));
    expect(byId("journey").props.accessibilityLabel).toBe("Pesanan: Gagal diantar, langkah 4 dari 4");
  });

  it("with counts the figures sit under the stops and the line fills to the furthest stage reached", () => {
    mount(
      track("preparing", { counts: trackCounts({ scheduled: 1, preparing: 2, out_for_delivery: 3, arrived: 0, delivered: 0 }) }),
    );
    measure();
    expect([0, 1, 2, 3].map((i) => (byId(`journey-count-${i}`).children as string[]).join(""))).toEqual(["1", "2", "3", "0"]);
    expect(scaleX()).toBeCloseTo(2 / 3);
    expect(byId("journey").props.accessibilityLabel).toBe("Pesanan: Diantar, langkah 3 dari 4");
    screen.unmount();
    mount(track("preparing"));
    expect(has("journey-count-0")).toBe(false);
  });

  it("maps the domain journey to a track stage", () => {
    expect(trackStage({ stage: "arrived", issue: false })).toBe("arrived_unconfirmed");
    expect(trackStage({ stage: "preparing", issue: true })).toBe("issue");
    expect(trackStage({ stage: "delivered" })).toBe("delivered");
  });
});
