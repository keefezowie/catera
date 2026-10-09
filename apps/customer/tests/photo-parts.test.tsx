import { fireEvent, render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { Image, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { contrastRatio, nativeMood, nativeThemes } from "@catera/design-tokens";
import { CalendarPhotoCell, MoodProvider, PhotoRing, StoryCover, Text, ThemeProvider } from "@catera/mobile-ui";

// The customer setup has no SecureStore mock, so this file keeps its own in-memory one for the dark theme case.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
const gone = (id: string) => screen.queryByTestId(id, { includeHiddenElements: true }) === null;

// React Native's jest environment reports a font scale of 2, so every case states the one it means. The hook module is
// replaced rather than spied on: the components read it through react-native's lazy export, which a spy does not reach.
let mockFontScale = 1;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 800, scale: 2, fontScale: mockFontScale }),
}));
const setFontScale = (fontScale: number) => {
  mockFontScale = fontScale;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  setFontScale(1);
});

describe("PhotoRing", () => {
  const base = { uri: "https://example.test/a.jpg", size: 60 as const, accessibilityLabel: "Soto" };

  it("draws a 3dp ring in the theme's sunrise ink", () => {
    render(<PhotoRing {...base} ring="sunrise" />);
    expect(flat("photo-ring")).toMatchObject({
      borderWidth: 3,
      borderColor: nativeThemes.light.sunriseInk,
      width: 60,
      height: 60,
      borderRadius: 30,
    });
  });

  it("draws the forest ring, and no visible ring for none, at the same size", () => {
    const view = render(<PhotoRing {...base} size={66} ring="forest" />);
    expect(flat("photo-ring")).toMatchObject({ borderColor: nativeThemes.light.forest, width: 66, height: 66 });
    view.unmount();
    render(<PhotoRing {...base} size={66} ring="none" />);
    expect(flat("photo-ring")).toMatchObject({ borderColor: "transparent", width: 66, height: 66 });
  });

  it("shows the photo cover-fit", () => {
    render(<PhotoRing {...base} ring="forest" />);
    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: base.uri });
    expect(image.props.resizeMode).toBe("cover");
  });

  it("covered shows a cream disc with the closed lunchbox and no photo", () => {
    render(<PhotoRing {...base} ring="forest" covered />);
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
    expect(flat("photo-ring-covered").backgroundColor).toBe(nativeThemes.light.cream);
    expect(screen.getByTestId("photo-ring-lunchbox", { includeHiddenElements: true })).toBeTruthy();
  });

  it("an empty uri renders the ring's ground and no Image", () => {
    render(<PhotoRing {...base} uri="" ring="forest" />);
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
    expect(flat("photo-ring")).toMatchObject({ borderColor: nativeThemes.light.forest, width: 60, height: 60 });
    expect(screen.getByTestId("photo-ring")).toBeTruthy();
  });

  it("without onPress it is not a button", () => {
    render(<PhotoRing {...base} ring="forest" label="Soto" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Soto")).toBeTruthy();
  });

  it("with onPress it is a button that fires the select haptic and exposes selected", () => {
    const onPress = jest.fn();
    const view = render(<PhotoRing {...base} ring="sunrise" label="Soto" selected onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Soto" });
    expect(button.props.accessibilityState.selected).toBe(true);
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    view.rerender(<PhotoRing {...base} ring="sunrise" label="Soto" selected={false} onPress={onPress} />);
    expect(screen.getByRole("button", { name: "Soto" }).props.accessibilityState.selected).toBe(false);
  });

  it("the pressable target is at least 48dp whatever the size", () => {
    render(<PhotoRing {...base} ring="sunrise" onPress={() => {}} />);
    const style = StyleSheet.flatten(screen.getByRole("button").props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style.minWidth).toBeGreaterThanOrEqual(48);
  });

  it("the label is bold when selected and caption weight otherwise, and wraps", () => {
    const view = render(<PhotoRing {...base} ring="sunrise" label="Soto" selected onPress={() => {}} />);
    const selected = StyleSheet.flatten(screen.getByText("Soto").props.style);
    expect(selected.fontSize).toBe(12);
    expect(selected.color).toBe(nativeThemes.light.forest);
    view.rerender(<PhotoRing {...base} ring="sunrise" label="Soto" onPress={() => {}} />);
    const quiet = StyleSheet.flatten(screen.getByText("Soto").props.style);
    expect(quiet.fontSize).toBe(11);
    expect(quiet.color).toBe(nativeThemes.light.muted);
    expect(screen.getByText("Soto").props.numberOfLines).toBeUndefined();
  });
});

describe("CalendarPhotoCell", () => {
  const siang = nativeMood.light.siang;
  const base = {
    day: 12,
    uri: "https://example.test/a.jpg",
    menuSet: true,
    dinnerToo: false,
    past: false,
    today: false,
    selected: false,
    onPress: () => {},
    accessibilityLabel: "12 Oktober",
  };

  it("is a 52dp, radius 12 button of at least 48dp that fires the select haptic", () => {
    const onPress = jest.fn();
    render(<CalendarPhotoCell {...base} onPress={onPress} selected />);
    const button = screen.getByRole("button", { name: "12 Oktober" });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ height: 52, borderRadius: 12 });
    expect(StyleSheet.flatten(button.props.style).minWidth).toBeGreaterThanOrEqual(48);
    expect(button.props.accessibilityState.selected).toBe(true);
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("with a photo and a menu it shows the image and the day in a cream pill, with no dashed border", () => {
    render(<CalendarPhotoCell {...base} />);
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: base.uri });
    expect(gone("cell-dashed")).toBe(true);
    expect(flat("cell-number-pill")).toMatchObject({
      backgroundColor: nativeThemes.light.cream,
      position: "absolute",
      left: 4,
      bottom: 4,
    });
    expect(StyleSheet.flatten(screen.getByText("12").props.style).color).toBe(nativeThemes.light.forest);
  });

  it("menu not set draws a dashed 1.5dp markerIdle border and a sun, and no image", () => {
    render(<CalendarPhotoCell {...base} menuSet={false} />);
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
    expect(flat("cell-dashed")).toMatchObject({
      borderStyle: "dashed",
      borderWidth: 1.5,
      borderColor: siang.markerIdle,
      borderRadius: 12,
    });
    expect(siang.markerIdle).toBe("#9A7A55");
    expect(screen.getByTestId("cell-sun", { includeHiddenElements: true })).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText("12").props.style).color).toBe(siang.headerMeta);
  });

  it("no meal shows the plain number in headerMeta, with no image, border or sun", () => {
    render(<CalendarPhotoCell {...base} uri={null} menuSet={false} />);
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
    expect(gone("cell-dashed")).toBe(true);
    expect(gone("cell-sun")).toBe(true);
    expect(gone("cell-number-pill")).toBe(true);
    expect(StyleSheet.flatten(screen.getByText("12").props.style).color).toBe(siang.headerMeta);
  });

  it("dinnerToo adds the forest moon badge; without it there is none", () => {
    const view = render(<CalendarPhotoCell {...base} dinnerToo />);
    expect(flat("cell-moon").backgroundColor).toBe(nativeThemes.light.forest);
    expect(flat("cell-moon")).toMatchObject({ position: "absolute", top: 4, right: 4 });
    view.rerender(<CalendarPhotoCell {...base} />);
    expect(gone("cell-moon")).toBe(true);
  });

  it("past dims the photo to 0.5 and turns the pill forest with cream text", () => {
    const view = render(<CalendarPhotoCell {...base} />);
    expect(flat("cell-photo").opacity).toBe(1);
    view.rerender(<CalendarPhotoCell {...base} past />);
    expect(flat("cell-photo").opacity).toBe(0.5);
    expect(flat("cell-number-pill").backgroundColor).toBe(nativeThemes.light.forest);
    expect(StyleSheet.flatten(screen.getByText("12").props.style).color).toBe(nativeThemes.light.cream);
  });

  it("today adds a 2.5dp todayRing outline and selected a 2.5dp headerText one", () => {
    const view = render(<CalendarPhotoCell {...base} />);
    expect(gone("cell-outline-today")).toBe(true);
    expect(gone("cell-outline-selected")).toBe(true);
    view.rerender(<CalendarPhotoCell {...base} today />);
    expect(flat("cell-outline-today")).toMatchObject({
      borderWidth: 2.5,
      borderColor: siang.todayRing,
      borderRadius: 12,
    });
    expect(gone("cell-outline-selected")).toBe(true);
    view.rerender(<CalendarPhotoCell {...base} selected />);
    expect(flat("cell-outline-selected")).toMatchObject({
      borderWidth: 2.5,
      borderColor: siang.headerText,
      borderRadius: 12,
    });
    expect(gone("cell-outline-today")).toBe(true);
  });

  it("today and selected together keep both outlines, the selected one inside", () => {
    render(<CalendarPhotoCell {...base} today selected />);
    expect(flat("cell-outline-today").borderColor).toBe(siang.todayRing);
    expect(flat("cell-outline-selected").borderColor).toBe(siang.headerText);
    expect(flat("cell-outline-selected").top).toBeGreaterThan(flat("cell-outline-today").top as number);
  });

  it("under light Malam the outlines read the mood tokens that stay visible on the dark header", () => {
    render(
      <MoodProvider now={() => new Date("2026-10-09T08:00:00Z")}>
        <CalendarPhotoCell {...base} today selected />
      </MoodProvider>,
    );
    expect(flat("cell-outline-selected").borderColor).toBe("#FFF7E9");
    expect(flat("cell-outline-today").borderColor).toBe("#F5C9A6");
    // The theme colours these replaced are the ones that failed 3:1 on the Malam header.
    expect(contrastRatio(nativeThemes.light.forest, nativeMood.light.malam.header)).toBeLessThan(3);
    expect(contrastRatio(nativeThemes.light.sunriseInk, nativeMood.light.malam.header)).toBeLessThan(3);
  });

  it("outlines never take touches", () => {
    render(<CalendarPhotoCell {...base} today selected />);
    expect(screen.getByTestId("cell-outline-today", { includeHiddenElements: true }).props.pointerEvents).toBe("none");
    expect(screen.getByTestId("cell-outline-selected", { includeHiddenElements: true }).props.pointerEvents).toBe("none");
  });

  it("at font scale 1.3 a photo cell falls back to the number with a 6dp photo dot", () => {
    setFontScale(1.3);
    render(<CalendarPhotoCell {...base} />);
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
    expect(flat("cell-photo-dot")).toMatchObject({ width: 6, height: 6, borderRadius: 3 });
    expect(gone("cell-number-pill")).toBe(true);
    expect(StyleSheet.flatten(screen.getByText("12").props.style).color).toBe(siang.headerMeta);
  });

  it("at font scale 1.3 dinner becomes a small moon beside the photo dot, with no corner badge", () => {
    setFontScale(1.3);
    const view = render(<CalendarPhotoCell {...base} day={28} dinnerToo />);
    expect(gone("cell-moon")).toBe(true);
    expect(screen.getByTestId("cell-moon-dot", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("cell-photo-dot", { includeHiddenElements: true })).toBeTruthy();
    view.rerender(<CalendarPhotoCell {...base} day={28} />);
    expect(gone("cell-moon-dot")).toBe(true);
    expect(screen.getByTestId("cell-photo-dot", { includeHiddenElements: true })).toBeTruthy();
  });

  it("a covered day whose uri is empty falls back to the number with the dot, and renders no Image", () => {
    const view = render(<CalendarPhotoCell {...base} uri="" />);
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
    expect(gone("cell-photo")).toBe(true);
    expect(gone("cell-number-pill")).toBe(true);
    expect(gone("cell-dashed")).toBe(true);
    expect(screen.getByTestId("cell-photo-dot", { includeHiddenElements: true })).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText("12").props.style).color).toBe(siang.headerMeta);
    // Dinner shows as the moon dot here too, never as the corner badge over a photo that is not there.
    view.rerender(<CalendarPhotoCell {...base} uri="" dinnerToo />);
    expect(gone("cell-moon")).toBe(true);
    expect(screen.getByTestId("cell-moon-dot", { includeHiddenElements: true })).toBeTruthy();
  });

  it("an empty uri on a day whose menu is not set is still the dashed cell", () => {
    render(<CalendarPhotoCell {...base} uri="" menuSet={false} />);
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
    expect(flat("cell-dashed").borderStyle).toBe("dashed");
    expect(gone("cell-photo-dot")).toBe(true);
  });

  it("below font scale 1.3 the photo stays, and the empty and unset cells never get the dot", () => {
    setFontScale(1.29);
    const view = render(<CalendarPhotoCell {...base} />);
    expect(screen.UNSAFE_getByType(Image)).toBeTruthy();
    expect(gone("cell-photo-dot")).toBe(true);
    setFontScale(2);
    view.rerender(<CalendarPhotoCell {...base} uri={null} menuSet={false} />);
    expect(gone("cell-photo-dot")).toBe(true);
    view.rerender(<CalendarPhotoCell {...base} menuSet={false} />);
    expect(gone("cell-photo-dot")).toBe(true);
    expect(flat("cell-dashed").borderStyle).toBe("dashed");
  });
});

describe("StoryCover", () => {
  const base = { uri: "https://example.test/a.jpg", title: "Menu hari ini", segments: 4, active: 2, width: 200, height: 320 };

  it("is the requested size with a cover-fit photo", () => {
    render(<StoryCover {...base} />);
    expect(flat("story-cover")).toMatchObject({ width: 200, height: 320 });
    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: base.uri });
    expect(image.props.resizeMode).toBe("cover");
  });

  it("an empty uri keeps the dark ground, the bars and the title, with no Image", () => {
    render(<StoryCover {...base} uri="" />);
    expect(screen.UNSAFE_queryByType(Image)).toBeNull();
    expect(flat("story-cover").backgroundColor).toBe(nativeThemes.light.forest);
    expect(screen.getByTestId("story-segment-3", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("Menu hari ini")).toBeTruthy();
  });

  it("renders one bar per segment, the first `active` at full opacity and the rest at 0.4, all cream", () => {
    render(<StoryCover {...base} />);
    const opacities = [0, 1, 2, 3].map((i) => flat(`story-segment-${i}`).opacity);
    expect(opacities).toEqual([1, 1, 0.4, 0.4]);
    expect(gone("story-segment-4")).toBe(true);
    expect(flat("story-segment-0").backgroundColor).toBe(nativeThemes.light.cream);
    expect(flat("story-segment-3").backgroundColor).toBe(nativeThemes.light.cream);
  });

  it("lays a bottom gradient over the photo", () => {
    render(<StoryCover {...base} />);
    expect(flat("story-gradient").experimental_backgroundImage).toBe(
      "linear-gradient(rgba(11,31,22,0) 40%, rgba(11,31,22,0.9))",
    );
  });

  it("shows the title in cream label type, wrapping rather than truncating", () => {
    render(<StoryCover {...base} />);
    const title = screen.getByText("Menu hari ini");
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({ color: nativeThemes.light.cream, fontSize: 12 });
    expect(title.props.numberOfLines).toBeUndefined();
  });

  it("keeps the same cream inks in the dark theme, because they sit on a photo", () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    render(
      <ThemeProvider storageKey="photo-parts-test">
        <StoryCover {...base} />
        <Text testID="theme-probe">Gelap</Text>
      </ThemeProvider>,
    );
    // The probe proves the dark theme is live, so the unchanged cream below is the cover's choice and not an accident.
    expect(StyleSheet.flatten(screen.getByTestId("theme-probe").props.style).color).toBe(nativeThemes.dark.charcoal);
    expect(nativeThemes.dark.cream).not.toBe(nativeThemes.light.cream);
    expect(StyleSheet.flatten(screen.getByText("Menu hari ini").props.style).color).toBe(nativeThemes.light.cream);
    expect(flat("story-segment-0").backgroundColor).toBe(nativeThemes.light.cream);
  });
});
