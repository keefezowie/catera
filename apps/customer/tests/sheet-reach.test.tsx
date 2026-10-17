import { Dimensions, Keyboard, ScrollView, StyleSheet } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { NavigationContext } from "expo-router/react-navigation";
import { SheetBody, sheetHiddenBelow } from "@catera/mobile-ui";

type Listener = (e?: { data?: { stable?: boolean } }) => void;

/** A navigation that records the listeners the sheet body adds and lets a test emit the events react-native-screens sends. */
function fakeNavigation(stateType: "stack" | "tab" = "stack") {
  const listeners = new Map<string, Set<Listener>>();
  const navigation = {
    getState: () => ({ type: stateType }),
    getParent: () => undefined,
    addListener: (event: string, listener: Listener) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(event, set);
      return () => {
        set.delete(listener);
      };
    },
  };
  const emit = (event: string, e?: { data?: { stable?: boolean } }) => listeners.get(event)?.forEach((l) => l(e));
  const count = (event: string) => listeners.get(event)?.size ?? 0;
  return { navigation, emit, count };
}

function mockMeasure(position: { top: number; height: number }) {
  return jest
    .spyOn(ScrollView.prototype as unknown as { measureInWindow: () => void }, "measureInWindow")
    .mockImplementation(((cb: (x: number, y: number, w: number, h: number) => void) =>
      // The scroll view is as much shorter as the margin it was given, as on the phone.
      cb(0, position.top, 400, position.height - marginOf())) as never);
}

const marginOf = () => StyleSheet.flatten(screen.getByTestId("sheet-body").props.style).marginBottom ?? 0;
const settle = (ms = 100) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

/**
 * react-native-screens 4.26 lays an Android form sheet out at its tallest detent and slides it down to the lower one, so
 * the lower part of the scroll view, with the last button, sits under the screen's edge. The body measures itself and
 * ends at the edge.
 */
describe("a form sheet's last button clears the gesture bar", () => {
  it("the part of the body below the screen is what the scroll view gives up", () => {
    // 1080x2400 at 420dpi is 411x914dp: a body from y=480 and 640 high ends at 1120, 206 under the edge.
    expect(sheetHiddenBelow({ top: 480, height: 640, margin: 0, windowHeight: 914 })).toBe(206);
    // Already shortened by 206: the same sheet measures the same, so it does not flip-flop.
    expect(sheetHiddenBelow({ top: 480, height: 434, margin: 206, windowHeight: 914 })).toBe(206);
    // Expanded: the sheet moved up by that much, nothing is below the edge.
    expect(sheetHiddenBelow({ top: 274, height: 640, margin: 0, windowHeight: 914 })).toBe(0);
    expect(sheetHiddenBelow({ top: 274, height: 434, margin: 206, windowHeight: 914 })).toBe(0);
  });

  it("an Android root-stack body ends at the screen's edge once measured", async () => {
    jest.useFakeTimers();
    const screenHeight = Dimensions.get("screen").height;
    const spy = jest
      .spyOn(ScrollView.prototype as unknown as { measureInWindow: () => void }, "measureInWindow")
      .mockImplementation(((cb: (x: number, y: number, w: number, h: number) => void) =>
        cb(0, screenHeight - 600, 400, 800)) as never);
    render(<SheetBody os="android">{null}</SheetBody>);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    const style = StyleSheet.flatten(screen.getByTestId("sheet-body").props.style);
    expect(style.flex).toBe(1);
    expect(style.marginBottom).toBe(200);
    // The foot keeps the gesture bar's inset and 24 inside the scroll content.
    expect(StyleSheet.flatten(screen.getByTestId("sheet-body").props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(24);
    spy.mockRestore();
    jest.useRealTimers();
  });

  it("iOS bodies are never measured or shortened", () => {
    render(<SheetBody os="ios">{null}</SheetBody>);
    expect(StyleSheet.flatten(screen.getByTestId("sheet-body").props.style).marginBottom ?? 0).toBe(0);
  });

  describe("the margin follows the sheet", () => {
    const original = { window: Dimensions.get("window"), screen: Dimensions.get("screen") };
    const bodyTop = () => original.window.height - 600;
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      Dimensions.set(original);
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it("measures again when the window height changes (rotation, split screen)", async () => {
      const spy = mockMeasure({ top: bodyTop(), height: 800 });
      render(<SheetBody os="android">{null}</SheetBody>);
      await settle(1000);
      expect(marginOf()).toBe(200);
      const calls = spy.mock.calls.length;
      // The window is 100 shorter and the scroll view starts at the same place: 100 more of it is below the edge.
      await act(async () => {
        const h = original.window.height - 100;
        Dimensions.set({ window: { ...original.window, height: h }, screen: { ...original.screen, height: h } });
      });
      await settle();
      expect(spy.mock.calls.length).toBeGreaterThan(calls);
      expect(marginOf()).toBe(300);
    });

    it("measures again when only the width changes", async () => {
      const spy = mockMeasure({ top: bodyTop(), height: 800 });
      render(<SheetBody os="android">{null}</SheetBody>);
      await settle(1000);
      const calls = spy.mock.calls.length;
      await act(async () => {
        Dimensions.set({ window: { ...original.window, width: original.window.width + 100 }, screen: original.screen });
      });
      await settle();
      expect(spy.mock.calls.length).toBeGreaterThan(calls);
    });

    it("re-measures on a stable detent change and on transitionEnd, not on an unstable one", async () => {
      const spy = mockMeasure({ top: bodyTop(), height: 800 });
      const nav = fakeNavigation();
      render(
        <NavigationContext.Provider value={nav.navigation as never}>
          <SheetBody os="android">{null}</SheetBody>
        </NavigationContext.Provider>,
      );
      await settle(1000);
      let calls = spy.mock.calls.length;
      nav.emit("sheetDetentChange", { data: { stable: false } });
      await settle();
      expect(spy.mock.calls.length).toBe(calls);
      nav.emit("sheetDetentChange", { data: { stable: true } });
      await settle();
      expect(spy.mock.calls.length).toBe(calls + 1);
      calls = spy.mock.calls.length;
      nav.emit("transitionEnd");
      await settle();
      expect(spy.mock.calls.length).toBe(calls + 1);
    });

    it("removes its listeners and timers when the sheet unmounts", async () => {
      const spy = mockMeasure({ top: bodyTop(), height: 800 });
      const nav = fakeNavigation();
      const view = render(
        <NavigationContext.Provider value={nav.navigation as never}>
          <SheetBody os="android">{null}</SheetBody>
        </NavigationContext.Provider>,
      );
      expect(nav.count("transitionEnd")).toBe(1);
      expect(nav.count("sheetDetentChange")).toBe(1);
      nav.emit("transitionEnd");
      const before = spy.mock.calls.length;
      view.unmount();
      expect(nav.count("transitionEnd")).toBe(0);
      expect(nav.count("sheetDetentChange")).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
      await settle(1000);
      expect(spy.mock.calls.length).toBe(before);
    });

    it("never measures a tab-stack sheet, even with the tab bar's share at 0 under the keyboard", async () => {
      const spy = mockMeasure({ top: bodyTop(), height: 800 });
      const nav = fakeNavigation("tab");
      const keyboard: Record<string, () => void> = {};
      jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: () => void) => {
        keyboard[event] = cb;
        return { remove: () => undefined };
      }) as never);
      render(
        <NavigationContext.Provider value={nav.navigation as never}>
          <SheetBody os="android">{null}</SheetBody>
        </NavigationContext.Provider>,
      );
      const before = spy.mock.calls.length;
      await act(async () => {
        keyboard.keyboardDidShow?.();
      });
      await settle(1000);
      nav.emit("transitionEnd");
      await settle();
      expect(spy.mock.calls.length).toBe(before);
      expect(nav.count("sheetDetentChange")).toBe(0);
      expect(marginOf()).toBe(0);
    });
  });
});
