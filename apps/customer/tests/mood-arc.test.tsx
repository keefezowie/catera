import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import type { ReactElement } from "react";
import * as Haptics from "expo-haptics";
import * as Reanimated from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import { nativeMood } from "@catera/design-tokens";
import { MoodArc, MoodHeader, MoodProvider, MoodToggle, ThemeProvider } from "@catera/mobile-ui";

jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

const SIANG_NOW = () => new Date("2026-10-09T03:00:00Z"); // 10:00 WIB
const MALAM_NOW = () => new Date("2026-10-09T10:00:00Z"); // 17:00 WIB

const ENDS = {
  siang: { title: "Siang", detail: "2 pengantaran", label: "Makan siang" },
  malam: { title: "Malam", detail: "17.00", label: "Makan malam" },
};

function mount(ui: ReactElement, { now = SIANG_NOW, scheme = "light" as "light" | "dark" } = {}) {
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
  return render(
    <ThemeProvider storageKey="mood-arc-test">
      <MoodProvider now={now}>{ui}</MoodProvider>
    </ThemeProvider>,
  );
}

const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
/** The arc as wide as a 360dp phone's header content (20dp padding each side). */
const layout = (width = 320) =>
  fireEvent(screen.getByTestId("mood-arc"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height: 120 } } });
const tablists = () =>
  screen.UNSAFE_root.findAll((n) => typeof n.type === "string" && n.props.accessibilityRole === "tablist");
const discAt = () => {
  const t = flat("mood-arc-disc").transform as { translateX?: number; translateY?: number }[];
  return { x: t.find((p) => "translateX" in p)!.translateX!, y: t.find((p) => "translateY" in p)!.translateY! };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("MoodArc", () => {
  it("the arc is a tablist and switching fires the select haptic", () => {
    mount(<MoodArc {...ENDS} />);
    expect(screen.getByTestId("mood-arc").props.accessibilityRole).toBe("tablist");
    const siang = screen.getByRole("tab", { name: "Makan siang, 2 pengantaran" });
    const malam = screen.getByRole("tab", { name: "Makan malam, 17.00" });
    expect(siang.props.accessibilityState).toMatchObject({ selected: true });
    expect(malam.props.accessibilityState).toMatchObject({ selected: false });
    // The chosen end has nothing to confirm.
    fireEvent.press(siang);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    fireEvent.press(malam);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "Makan malam, 17.00" }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole("tab", { name: "Makan siang, 2 pengantaran" }).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it("speaks the title when no spoken label is given (English reads Lunch, 2 deliveries)", () => {
    mount(
      <MoodArc siang={{ title: "Lunch", detail: "2 deliveries" }} malam={{ title: "Dinner", detail: "None" }} />,
    );
    expect(screen.getByRole("tab", { name: "Lunch, 2 deliveries", selected: true })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dinner, None", selected: false })).toBeTruthy();
  });

  it("gives each end a target of at least 48dp both ways, in a 104dp block at font scale 1.0", () => {
    mount(<MoodArc {...ENDS} />);
    for (const end of ["siang", "malam"]) {
      const s = flat(`mood-arc-tab-${end}`);
      expect(s.width).toBeGreaterThanOrEqual(48);
      const marker = flat(`mood-arc-marker-${end}`);
      expect(marker).toMatchObject({ width: 50, height: 50 });
      // The column stacks its top padding, the marker and the two label lines, with no gaps between them.
      expect(s.gap).toBeUndefined();
      const height =
        (s.paddingTop as number) +
        (marker.height as number) +
        (flat(`mood-arc-title-${end}`).lineHeight as number) +
        (flat(`mood-arc-detail-${end}`).lineHeight as number);
      expect(height).toBeGreaterThanOrEqual(48);
      // The owner-approved canvas gives the arc about 104dp under the headline.
      expect(height).toBe(104);
    }
  });

  it("gives no press feedback on the chosen end, and keeps it on the other", () => {
    const spring = jest.spyOn(Reanimated, "withSpring");
    mount(<MoodArc {...ENDS} />);
    fireEvent(screen.getByTestId("mood-arc-tab-siang"), "pressIn");
    expect(spring).not.toHaveBeenCalled();
    fireEvent(screen.getByTestId("mood-arc-tab-malam"), "pressIn");
    expect(spring).toHaveBeenCalledWith(0.97, expect.anything());
  });

  it("the idle end has the outline ring", () => {
    mount(<MoodArc {...ENDS} />);
    layout();
    // Both ends carry the same 44dp ring, so they read as matching buttons; the disc covers the chosen one.
    for (const end of ["siang", "malam"]) {
      expect(flat(`mood-arc-ring-${end}`)).toMatchObject({
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: nativeMood.light.siang.markerIdle,
      });
    }
    expect(flat("mood-arc-disc")).toMatchObject({ width: 44, height: 44, backgroundColor: nativeMood.light.siang.markerActive });
    // The idle end's glyph is markerIdle; the chosen end's glyph rides the disc in onToggleActive.
    const idleMoon = within(screen.getByTestId("mood-arc-ring-malam", { includeHiddenElements: true })).UNSAFE_getByProps({
      name: "moon",
    });
    expect(idleMoon.props.color).toBe(nativeMood.light.siang.markerIdle);
    const discSun = within(screen.getByTestId("mood-arc-disc", { includeHiddenElements: true })).UNSAFE_getByProps({
      name: "sunny",
    });
    expect(discSun.props.color).toBe(nativeMood.light.siang.onToggleActive);
  });

  it.each([
    ["light", "siang"],
    ["light", "malam"],
    ["dark", "siang"],
    ["dark", "malam"],
  ] as const)("paints the %s %s look from the mood tokens", (scheme, mood) => {
    mount(<MoodArc {...ENDS} />, { scheme, now: mood === "siang" ? SIANG_NOW : MALAM_NOW });
    layout();
    const m = nativeMood[scheme][mood];
    expect(flat("mood-arc-disc").backgroundColor).toBe(m.markerActive);
    const idle = mood === "siang" ? "malam" : "siang";
    expect(flat(`mood-arc-ring-${idle}`).borderColor).toBe(m.markerIdle);
    expect(StyleSheet.flatten(screen.getByText("Siang").props.style).color).toBe(m.headerText);
    expect(StyleSheet.flatten(screen.getByText("2 pengantaran").props.style).color).toBe(m.headerMeta);
    const glyph = within(screen.getByTestId("mood-arc-disc", { includeHiddenElements: true })).UNSAFE_getByProps({
      name: mood === "siang" ? "sunny" : "moon",
    });
    expect(glyph.props.color).toBe(m.onToggleActive);
  });

  it("sets the title bold 13 and the detail 12 in tabular figures", () => {
    mount(<MoodArc {...ENDS} />);
    expect(StyleSheet.flatten(screen.getByText("Siang").props.style)).toMatchObject({ fontSize: 13, fontFamily: "Jakarta-Bold" });
    expect(StyleSheet.flatten(screen.getByText("17.00").props.style)).toMatchObject({
      fontSize: 12,
      fontVariant: ["tabular-nums"],
    });
  });

  it("moves the disc from the sun end to the moon end along the arc, instantly under reduced motion", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(<MoodArc {...ENDS} />);
    layout();
    const sun = discAt();
    // The disc sits centred on the sun marker: the 96dp column's centre minus the disc's radius.
    expect(sun.x).toBe(48 - 22);
    fireEvent.press(screen.getByRole("tab", { name: "Makan malam, 17.00" }));
    const moon = discAt();
    expect(moon.x).toBe(320 - 48 - 22);
    expect(moon.y).toBeCloseTo(sun.y, 6);
    expect(flat("mood-arc-disc").backgroundColor).toBe(nativeMood.light.malam.markerActive);
  });

  it("cross-fades the disc glyph from the sun to the moon, instantly under reduced motion", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(<MoodArc {...ENDS} />);
    layout();
    // Both glyphs ride the disc; only opacity tells them apart, so the moon never shows over the sun marker.
    expect(flat("mood-arc-disc-glyph-siang").opacity).toBe(1);
    expect(flat("mood-arc-disc-glyph-malam").opacity).toBe(0);
    fireEvent.press(screen.getByRole("tab", { name: "Makan malam, 17.00" }));
    expect(flat("mood-arc-disc-glyph-siang").opacity).toBe(0);
    expect(flat("mood-arc-disc-glyph-malam").opacity).toBe(1);
    expect(flat("mood-arc-disc-glyph-malam").transform).toBeUndefined();
  });

  it("follows a switch made elsewhere (the Jelajah meal segment is the same mood)", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(
      <>
        <MoodArc {...ENDS} />
        <MoodToggle />
      </>,
    );
    layout();
    // The toggle tab, whose own label is "Malam" (the arc tab only shows that word as its title).
    fireEvent.press(screen.getAllByRole("tab").find((t) => t.props.accessibilityLabel === "Malam")!);
    expect(screen.getByRole("tab", { name: "Makan malam, 17.00" }).props.accessibilityState).toMatchObject({ selected: true });
    expect(discAt().x).toBe(320 - 48 - 22);
  });

  it("draws the disc and the track once it knows its width, and the chosen end is filled from the first frame", () => {
    mount(<MoodArc {...ENDS} />);
    expect(screen.queryByTestId("mood-arc-disc", { includeHiddenElements: true })).toBeNull();
    // Before layout the chosen end's filled disc sits in its own marker, so neither end looks idle.
    expect(flat("mood-arc-seed-siang-disc")).toMatchObject({
      width: 44,
      height: 44,
      backgroundColor: nativeMood.light.siang.markerActive,
    });
    const seed = screen.getByTestId("mood-arc-seed-siang", { includeHiddenElements: true });
    expect(seed.props.pointerEvents).toBe("none");
    expect(within(seed).UNSAFE_getByProps({ name: "sunny" }).props.color).toBe(nativeMood.light.siang.onToggleActive);
    expect(screen.queryByTestId("mood-arc-seed-malam", { includeHiddenElements: true })).toBeNull();
    layout();
    expect(screen.queryByTestId("mood-arc-seed-siang", { includeHiddenElements: true })).toBeNull();
    const disc = screen.getByTestId("mood-arc-disc", { includeHiddenElements: true });
    expect(disc.props.accessibilityElementsHidden).toBe(true);
    expect(disc.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(disc.props.pointerEvents).toBe("none");
    expect(screen.getByTestId("mood-arc-track", { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  });

  it("arc labels wrap at font scale 1.3 without overlapping (a style check)", () => {
    // Jest has no text layout or font scale, so this checks the styles that let the labels wrap under their markers at
    // any scale; the 360dp, font scale 1.3 look itself is the emulator capture in the Task 9 report.
    mount(
      <MoodArc
        siang={{ title: "Siang", detail: "12 pengantaran", label: "Makan siang" }}
        malam={{ title: "Malam", detail: "Tidak ada", label: "Makan malam" }}
      />,
    );
    layout(320);
    for (const end of ["siang", "malam"] as const) {
      const column = flat(`mood-arc-tab-${end}`).width as number;
      for (const id of [`mood-arc-title-${end}`, `mood-arc-detail-${end}`]) {
        const node = screen.getByTestId(id);
        const s = StyleSheet.flatten(node.props.style);
        // Each label is held to its marker's column and wraps inside it; it never truncates.
        expect(s.maxWidth).toBe(column);
        expect(s.textAlign).toBe("center");
        expect(node.props.numberOfLines).toBeUndefined();
      }
    }
    // The two columns sit at opposite ends of a 320dp row and leave the middle to the arc.
    const row = flat("mood-arc-row");
    expect(row).toMatchObject({ flexDirection: "row", justifyContent: "space-between" });
    const sum = (flat("mood-arc-tab-siang").width as number) + (flat("mood-arc-tab-malam").width as number);
    expect(sum).toBeLessThan(320);
  });
});

describe("MoodHeader with the arc", () => {
  it("shows the arc under the headline and no toggle in the top row", () => {
    mount(<MoodHeader title="Halo" meta="Jumat 9 Okt" toggle arc={ENDS} />);
    expect(tablists()).toHaveLength(1);
    expect(screen.getByTestId("mood-arc")).toBeTruthy();
    expect(screen.queryByTestId("mood-toggle-pill", { includeHiddenElements: true })).toBeNull();
    expect(within(screen.getByTestId("mood-header-row")).queryByRole("tab")).toBeNull();
    expect(within(screen.getByTestId("mood-header-row")).getByText("Jumat 9 Okt")).toBeTruthy();
  });

  it("has no arc unless asked", () => {
    mount(<MoodHeader title="Halo" />);
    expect(screen.queryByTestId("mood-arc")).toBeNull();
  });
});
