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
// No provider by default (the track falls back to Indonesian); the English test hands it an English `t`.
jest.mock("@catera/mobile-core", () => ({ ...jest.requireActual("@catera/mobile-core"), useMobile: jest.fn(() => undefined) }));
const useMobile = (jest.requireMock("@catera/mobile-core") as { useMobile: jest.Mock }).useMobile;
const english = { t: (_id: string, en: string) => en };

const SIANG_NOW = () => new Date("2026-10-09T03:00:00Z");
const RAIL = 300;
const MARKER_HALF = 12;
const ink = nativeMood.light.siang;

const wrap = (ui: ReactElement) => (
  <ThemeProvider storageKey="rantang-track-test">
    <MoodProvider now={SIANG_NOW}>{ui}</MoodProvider>
  </ThemeProvider>
);
async function mount(ui: ReactElement) {
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
  act(async () => {
    await fireEvent(byId("journey-rail"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: RAIL, height: 64 } } });
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
  it("the track has four stops at 0, a third, two thirds and the end", async () => {
    await mount(track("scheduled"));
    await measure();
    expect([0, 1, 2, 3].map((i) => flat(`journey-stop-${i}`).left)).toEqual(["0%", `${100 / 3}%`, `${200 / 3}%`, "100%"]);
    expect(has("journey-stop-4")).toBe(false);
    const x = async (stage: TrackStage) => {
      await screen.unmount();
      await mount(track(stage));
      await measure();
      return markerX();
    };
    expect(markerX()).toBeCloseTo(0);
    expect(await x("preparing")).toBeCloseTo(RAIL / 3);
    expect(await x("out_for_delivery")).toBeCloseTo((2 * RAIL) / 3);
    expect(await x("arrived_unconfirmed")).toBeCloseTo(RAIL);
    expect(await x("delivered")).toBeCloseTo(RAIL);
  });

  it("scheduled and preparing sit at different stops", async () => {
    await mount(track("scheduled"));
    await measure();
    expect(op("journey-stop-0-ring")).toBe(1);
    expect(op("journey-stop-1-ring")).toBe(0);
    expect(scaleX()).toBeCloseTo(0.0001);
    await screen.unmount();
    await mount(track("preparing"));
    await measure();
    expect(op("journey-stop-0-ring")).toBe(0);
    expect(op("journey-stop-0-done")).toBe(1);
    expect(op("journey-stop-1-ring")).toBe(1);
    expect(flat("journey-stop-1-ring").borderColor).toBe(ink.stopActive);
    expect(scaleX()).toBeCloseTo(1 / 3);
  });

  it("done stops are filled heroText, the current stop has a stopActive ring and later stops are outlined heroMeta", async () => {
    await mount(track("out_for_delivery"));
    await measure();
    expect(flat("journey-stop-0-done").backgroundColor).toBe(ink.heroText);
    expect(op("journey-stop-0-done")).toBe(1);
    expect(op("journey-stop-1-done")).toBe(1);
    expect(op("journey-stop-2-done")).toBe(0);
    expect(op("journey-stop-2-ring")).toBe(1);
    expect(op("journey-stop-3-ring")).toBe(0);
    expect(flat("journey-stop-3-ahead").borderColor).toBe(ink.heroMeta);
  });

  it("arrived_unconfirmed half fills Sampai and says it in words", async () => {
    await mount(track("arrived_unconfirmed"));
    await measure();
    expect(has("journey-stop-3-half")).toBe(true);
    expect(op("journey-stop-3-done")).toBe(0);
    expect(op("journey-stop-3-ring")).toBe(1);
    expect(screen.getByText("Ditandai sampai, menunggu konfirmasimu")).toBeTruthy();
    await screen.unmount();
    await mount(track("delivered"));
    await measure();
    expect(op("journey-stop-3-done")).toBe(1);
  });

  it("issue shows the warning stop and the words Gagal diantar", async () => {
    await mount(track("issue"));
    await measure();
    expect(screen.getAllByText("Gagal diantar").length).toBeGreaterThan(0);
    expect(has("journey-stop-3-alert")).toBe(true);
    expect(flat("journey-stop-3-warn").borderColor).toBe(ink.heroWarn);
    expect(has("journey-dash")).toBe(true);
    expect(op("journey-stop-3-ring")).toBe(0);
    await screen.unmount();
    await mount(track("delivered"));
    expect(has("journey-dash")).toBe(false);
    expect(has("journey-stop-3-warn")).toBe(false);
  });

  it("nothing animates on first paint", async () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    for (const stage of ["scheduled", "preparing", "out_for_delivery", "arrived_unconfirmed", "delivered", "issue"] as const) {
      await mount(track(stage));
      await measure();
      await screen.unmount();
    }
    // The in-progress loop may start; the fill, the marker and the stops never animate on first paint.
    expect(timing).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: nativeMotion.feature }));
  });

  it("a stage change animates the fill with transform only", async () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = await mount(track("preparing"));
    await measure();
    await view.rerender(wrap(track("out_for_delivery")));
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
    await view.rerender(wrap(track("out_for_delivery", { caption: "Berangkat 11.00" })));
    expect(timing).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: nativeMotion.feature }));
  });

  it("reduced motion makes the change instant", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = await mount(track("preparing"));
    await view.rerender(wrap(track("delivered")));
    await measure();
    expect(timing).not.toHaveBeenCalled();
    expect(markerX()).toBeCloseTo(RAIL);
    expect(op("journey-stop-3-done")).toBe(1);
  });

  it("the segment after the current stop loops while the meal is between stops", async () => {
    for (const [stage, left] of [
      ["scheduled", "0%"],
      ["preparing", `${100 / 3}%`],
      ["out_for_delivery", `${200 / 3}%`],
    ] as const) {
      const repeat = jest.spyOn(Reanimated, "withRepeat");
      await mount(track(stage));
      await measure();
      expect(repeat).toHaveBeenCalledWith(expect.anything(), -1);
      expect(flat("journey-run").left).toBe(left);
      expect(flat("journey-run").width).toBe(`${100 / 3}%`);
      expect(flat("journey-run-bar").backgroundColor).toBe(ink.heroText);
      expect(flat("journey-run-bar").transformOrigin).toBe("left center");
      await screen.unmount();
      repeat.mockRestore();
    }
  });

  it("nothing loops once Sampai is reached, for a failed meal, under reduced motion or with counts", async () => {
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    for (const stage of ["arrived_unconfirmed", "delivered", "issue"] as const) {
      await mount(track(stage));
      expect(has("journey-run")).toBe(false);
      await screen.unmount();
    }
    await mount(track("preparing", { counts: { preparing: 2 } }));
    expect(has("journey-run")).toBe(false);
    await screen.unmount();
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    await mount(track("out_for_delivery"));
    expect(has("journey-run")).toBe(false);
    expect(repeat).not.toHaveBeenCalled();
  });

  it("the container reads one sentence", async () => {
    await mount(track("preparing", { caption: "Dimasak 10.15" }));
    expect(byId("journey").props.accessible).toBe(true);
    expect(byId("journey").props.accessibilityLabel).toBe("Pesanan: Dimasak, langkah 2 dari 4");
    expect(byId("journey").props.accessibilityValue).toEqual({ text: "Dimasak 10.15" });
    for (let i = 0; i < 4; i += 1) expect(byId(`journey-stop-${i}`).props.accessibilityElementsHidden).toBe(true);
    expect(byId("journey-labels").props.importantForAccessibility).toBe("no-hide-descendants");
    await screen.unmount();
    // A failed meal is counted at the stop it reached, not at the end it never got to.
    await mount(track("issue"));
    expect(byId("journey").props.accessibilityLabel).toBe("Pesanan: Gagal diantar, langkah 3 dari 4");
    await screen.unmount();
    await mount(<RantangTrack stage="issue" reached="preparing" testID="journey" />);
    expect(byId("journey").props.accessibilityLabel).toBe("Pesanan: Gagal diantar, langkah 2 dari 4");
  });

  it("delivered has no current stop: no stopActive ring and no larger disc anywhere", async () => {
    await mount(track("delivered"));
    await measure();
    for (let i = 0; i < 4; i += 1) {
      expect(op(`journey-stop-${i}-ring`)).toBe(0);
      expect((flat(`journey-stop-${i}-disc`).transform as { scale: number }[])[0].scale).toBe(1);
      expect(op(`journey-stop-${i}-done`)).toBe(1);
    }
    await screen.unmount();
    await mount(track("arrived_unconfirmed"));
    await measure();
    expect(op("journey-stop-3-ring")).toBe(1);
    expect((flat("journey-stop-3-disc").transform as { scale: number }[])[0].scale).toBeCloseTo(1.14);
  });

  it("keeps the marker and the progress line invisible until the rail has been measured", async () => {
    await mount(track("delivered"));
    expect(op("journey-marker")).toBe(0);
    expect(op("journey-progress")).toBe(0);
    await measure();
    expect(op("journey-marker")).toBe(1);
    expect(op("journey-progress")).toBe(1);
  });

  it("reads the hero inks: heroMeta for the line, heroText for the progress and caption, heroWarn when it failed", async () => {
    await mount(track("out_for_delivery", { caption: "Berangkat 11.00" }));
    await measure();
    expect(flat("journey-line").backgroundColor).toBe(ink.heroMeta);
    expect(flat("journey-progress").backgroundColor).toBe(ink.heroText);
    expect(StyleSheet.flatten(screen.getByText("Berangkat 11.00").props.style).color).toBe(ink.heroText);
    expect(flat("journey-label-3").color).toBe(ink.heroMeta);
    expect(flat("journey-label-2").color).toBe(ink.heroText);
    await screen.unmount();
    await mount(track("issue"));
    expect(flat("journey-caption").color).toBe(ink.heroWarn);
    expect(flat("journey-label-3").color).toBe(ink.heroWarn);
  });

  it.each([
    ["scheduled", false],
    ["preparing", true],
    ["out_for_delivery", true],
    ["arrived_unconfirmed", true],
    ["delivered", true],
    ["issue", true],
  ] as const)("%s draws the marker box filled: %s", async (stage, filled) => {
    await mount(track(stage));
    await measure();
    expect(byId("journey-marker-glyph-body").props.fill != null).toBe(filled);
  });

  it("keeps each Indonesian label whole on one line inside its own column, shrinking a little rather than breaking", async () => {
    await mount(track("scheduled", { counts: trackCounts({ scheduled: 2 }) }));
    for (let i = 0; i < 4; i += 1) {
      const label = byId(`journey-label-${i}`);
      expect(label.props.numberOfLines).toBe(1);
      expect(label.props.adjustsFontSizeToFit).toBe(true);
      expect(label.props.minimumFontScale).toBe(0.85);
      expect(flat(`journey-label-${i}`)).toMatchObject({ textAlign: "center", width: "100%" });
      expect(byId(`journey-count-${i}`).props.numberOfLines).toBe(1);
      // A gutter in every column, so a label shrunk to fit at large text never touches its neighbour.
      expect(flat(`journey-label-col-${i}`)).toMatchObject({ flex: 1, paddingHorizontal: 3 });
    }
    // No two-line room in a language where nothing wraps.
    expect(has("journey-label-slot-0")).toBe(false);
    expect(flat("journey-labels").overflow).not.toBe("hidden");
  });

  it("in English a two-word label wraps in its column, one word fits, and every column holds two lines", async () => {
    useMobile.mockReturnValue(english);
    await mount(track("scheduled"));
    // "On the way" wraps (two lines, centred, the column's width); "Scheduled", "Cooking" and "Arrived" fit one line.
    expect(byId("journey-label-2").props.numberOfLines).toBe(2);
    expect(byId("journey-label-2").props.adjustsFontSizeToFit).toBe(false);
    for (const i of [0, 1, 3]) {
      expect(byId(`journey-label-${i}`).props.numberOfLines).toBe(1);
      expect(byId(`journey-label-${i}`).props.adjustsFontSizeToFit).toBe(true);
    }
    for (let i = 0; i < 4; i += 1) {
      // The label sits over two invisible caption lines, so the row is as tall whichever label wraps.
      expect(flat(`journey-label-${i}`)).toMatchObject({ position: "absolute", left: 0, right: 0, textAlign: "center" });
      const room = byId(`journey-label-slot-${i}`).children.filter((n) => typeof n !== "string" && n.props.testID === undefined);
      expect(room).toHaveLength(2);
    }
    useMobile.mockReturnValue(undefined);
  });

  it("fades the half-filled Sampai in with the fill, and puts it in place at once under reduced motion", async () => {
    const timing = jest.spyOn(Reanimated, "withTiming");
    const view = await mount(track("out_for_delivery"));
    await measure();
    expect(op("journey-stop-3-half")).toBe(0);
    await view.rerender(wrap(track("arrived_unconfirmed")));
    expect(timing).toHaveBeenCalledWith(3, expect.objectContaining({ duration: nativeMotion.feature }));
    expect(op("journey-stop-3-half")).toBe(1);
    await screen.unmount();
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    timing.mockClear();
    const quiet = await mount(track("out_for_delivery"));
    await quiet.rerender(wrap(track("arrived_unconfirmed")));
    expect(timing).not.toHaveBeenCalled();
    expect(op("journey-stop-3-half")).toBe(1);
  });

  it("with counts the figures sit under the stops and the line fills to the furthest stage reached", async () => {
    await mount(
      track("preparing", { counts: trackCounts({ scheduled: 1, preparing: 2, out_for_delivery: 3, arrived: 0, delivered: 0 }) }),
    );
    await measure();
    expect([0, 1, 2, 3].map((i) => (byId(`journey-count-${i}`).children as string[]).join(""))).toEqual(["1", "2", "3", "0"]);
    expect(scaleX()).toBeCloseTo(2 / 3);
    expect(byId("journey").props.accessibilityLabel).toBe("Pesanan: Diantar, langkah 3 dari 4");
    await screen.unmount();
    await mount(track("preparing"));
    expect(has("journey-count-0")).toBe(false);
  });

  it("maps the domain journey to a track stage", () => {
    expect(trackStage({ stage: "arrived", issue: false })).toBe("arrived_unconfirmed");
    expect(trackStage({ stage: "preparing", issue: true })).toBe("issue");
    expect(trackStage({ stage: "delivered" })).toBe("delivered");
  });
});
