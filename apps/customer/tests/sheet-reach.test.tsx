import { Dimensions, Keyboard, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { SafeAreaFrameContext, SafeAreaInsetsContext } from "react-native-safe-area-context";
import { NavigationContext } from "expo-router/react-navigation";
import { Text } from "react-native";
import { SheetBody, SheetFooter, setWindowEdgeReference, sheetHiddenBelow } from "@catera/mobile-ui";

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
    .spyOn(View.prototype as unknown as { measureInWindow: () => void }, "measureInWindow")
    .mockImplementation(((cb: (x: number, y: number, w: number, h: number) => void) =>
      // The scroll view is as much shorter as the margin it was given, as on the phone.
      cb(0, position.top, 400, position.height - marginOf())) as never);
}

/** The root view's frame, which differs from the window's size on purpose: the margin must follow the frame. */
const frame = (width: number, height: number) => ({ x: 0, y: 0, width, height });
const inFrame = (f: ReturnType<typeof frame>, node: ReactNode) => (
  <SafeAreaFrameContext.Provider value={f}>
    <SafeAreaInsetsContext.Provider value={{ top: 0, left: 0, right: 0, bottom: 34 }}>{node}</SafeAreaInsetsContext.Provider>
  </SafeAreaFrameContext.Provider>
);

/** The tab bar at the test window's font scale (80 plus a 16 label line) and the 34 inset the tests give. */
const TAB_BAR = 96 + 34;
const marginOf = () => StyleSheet.flatten(screen.getByTestId("sheet-frame").props.style).marginBottom ?? 0;
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
    const screenHeight = 914;
    const spy = jest
      .spyOn(View.prototype as unknown as { measureInWindow: () => void }, "measureInWindow")
      .mockImplementation(((cb: (x: number, y: number, w: number, h: number) => void) =>
        cb(0, screenHeight - 600, 400, 800)) as never);
    render(inFrame(frame(411, screenHeight), <SheetBody os="android">{null}</SheetBody>));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    const style = StyleSheet.flatten(screen.getByTestId("sheet-frame").props.style);
    expect(style.flex).toBe(1);
    expect(style.marginBottom).toBe(200);
    // The foot keeps the gesture bar's inset and 24 inside the scroll content.
    expect(StyleSheet.flatten(screen.getByTestId("sheet-body").props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(24);
    spy.mockRestore();
    jest.useRealTimers();
  });

  it("iOS bodies are never measured or shortened", () => {
    render(<SheetBody os="ios">{null}</SheetBody>);
    expect(StyleSheet.flatten(screen.getByTestId("sheet-frame").props.style).marginBottom ?? 0).toBe(0);
  });

  describe("a pinned footer", () => {
    const FRAME = frame(411, 914);
    const footerStyle = () => StyleSheet.flatten(screen.getByTestId("sheet-footer").props.style);
    const keyboard: Record<string, (e?: unknown) => void> = {};
    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: (e?: unknown) => void) => {
        keyboard[event] = cb;
        return { remove: () => undefined };
      }) as never);
    });
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it("sits outside the scroll view, after the content", () => {
      render(inFrame(FRAME, <SheetBody os="android" footer={<Text>Kirim</Text>}><Text>isi</Text></SheetBody>));
      expect(within(screen.getByTestId("sheet-body")).queryByText("Kirim")).toBeNull();
      expect(within(screen.getByTestId("sheet-frame")).getByText("Kirim")).toBeTruthy();
      const order = screen.getByTestId("sheet-frame").children.map((c) => (typeof c === "string" ? c : c.props.testID));
      expect(order).toEqual(["sheet-body", "sheet-footer"]);
    });

    it("clears the gesture bar at the screen's edge, with the divider on top", () => {
      render(inFrame(FRAME, <SheetBody os="android" footer={<Text>Kirim</Text>}>{null}</SheetBody>));
      expect(footerStyle().paddingBottom).toBe(34 + 16);
      expect(footerStyle().borderTopWidth).toBeGreaterThan(0);
    });

    it("is lifted by the measured hidden-below amount at the form detent", async () => {
      mockMeasure({ top: FRAME.height - 600, height: 800 });
      render(inFrame(FRAME, <SheetBody os="android" footer={<Text>Kirim</Text>}>{null}</SheetBody>));
      await settle(1000);
      // The frame ends 200 above where it was laid out, and the footer is its last child.
      expect(marginOf()).toBe(200);
      expect(within(screen.getByTestId("sheet-frame")).getByTestId("sheet-footer")).toBeTruthy();
      expect(footerStyle().paddingBottom).toBe(34 + 16);
    });

    it("is lifted by the keyboard and the inset on Android, and drops the inset it no longer pays", async () => {
      render(inFrame(FRAME, <SheetBody os="android" footer={<Text>Kirim</Text>}>{null}</SheetBody>));
      await act(async () => {
        keyboard.keyboardDidShow?.({ endCoordinates: { height: 420, screenY: 500 } });
      });
      expect(marginOf()).toBe(420 + 34);
      expect(footerStyle().paddingBottom).toBe(16);
      await act(async () => {
        keyboard.keyboardDidHide?.();
      });
      expect(marginOf()).toBe(0);
    });

    it("rides on the keyboard on iOS, where the scroll view then insets nothing itself", async () => {
      render(inFrame(FRAME, <SheetBody os="ios" footer={<Text>Kirim</Text>}>{null}</SheetBody>));
      expect(screen.getByTestId("sheet-body").props.automaticallyAdjustKeyboardInsets).toBe(false);
      expect(footerStyle().paddingBottom).toBe(34 + 16);
      await act(async () => {
        keyboard.keyboardDidShow?.({ endCoordinates: { height: 336, screenY: 578 } });
      });
      expect(marginOf()).toBe(336);
      expect(footerStyle().paddingBottom).toBe(16);
    });

    it("a body without a footer keeps its scroll behaviour and draws none", () => {
      render(inFrame(FRAME, <SheetBody os="ios">{null}</SheetBody>));
      expect(screen.queryByTestId("sheet-footer")).toBeNull();
      expect(screen.getByTestId("sheet-body").props.automaticallyAdjustKeyboardInsets).toBe(true);
    });

    it("SheetFooter pins what a nested component renders, and draws it in place outside a body", async () => {
      const view = render(inFrame(FRAME, <SheetBody os="android"><SheetFooter><Text>Pindah</Text></SheetFooter></SheetBody>));
      expect(within(screen.getByTestId("sheet-footer")).getByText("Pindah")).toBeTruthy();
      expect(within(screen.getByTestId("sheet-body")).queryByText("Pindah")).toBeNull();
      view.unmount();
      render(<SheetFooter><Text>Pindah</Text></SheetFooter>);
      expect(screen.getByText("Pindah")).toBeTruthy();
    });
  });

  describe("the margin follows the sheet", () => {
    const original = { window: Dimensions.get("window"), screen: Dimensions.get("screen") };
    // 411x914dp frame in a window 48 taller (the nav bar the window's metrics count on Android 14 and older).
    const FRAME = frame(411, 914);
    const bodyTop = () => FRAME.height - 600;
    beforeEach(() => {
      jest.useFakeTimers();
      Dimensions.set({ window: { ...original.window, width: 411, height: 962 }, screen: { ...original.screen, width: 411, height: 962 } });
    });
    afterEach(() => {
      Dimensions.set(original);
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it("measures the screen's edge in the scroll view's own window space, not by the frame's height", async () => {
      // measureInWindow is offset from the frame by a 48 status bar: the root reference ends at 48+914=962.
      mockMeasure({ top: bodyTop() + 48, height: 800 });
      render(
        inFrame(FRAME, <>
          <SheetBody os="android">{null}</SheetBody>
        </>),
      );
      setWindowEdgeReference({ measureInWindow: ((cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 0, 411, 962)) as never });
      try {
        await settle(1000);
        // top 362 + 800 = 1162 against 962 is 200; against the frame's 914 it would be 248.
        expect(marginOf()).toBe(200);
      } finally {
        setWindowEdgeReference(null);
      }
    });

    it("measures against the root frame, not the window size", async () => {
      mockMeasure({ top: bodyTop(), height: 800 });
      render(inFrame(FRAME, <SheetBody os="android">{null}</SheetBody>));
      await settle(1000);
      // 914-600+800-914 = 200; against the window's 962 it would be 152.
      expect(marginOf()).toBe(200);
    });

    it("measures again when the frame height changes (rotation, split screen)", async () => {
      const spy = mockMeasure({ top: bodyTop(), height: 800 });
      const view = render(inFrame(FRAME, <SheetBody os="android">{null}</SheetBody>));
      await settle(1000);
      expect(marginOf()).toBe(200);
      const calls = spy.mock.calls.length;
      // The frame is 100 shorter and the scroll view starts at the same place: 100 more of it is below the edge.
      view.rerender(inFrame(frame(411, 814), <SheetBody os="android">{null}</SheetBody>));
      await settle();
      expect(spy.mock.calls.length).toBeGreaterThan(calls);
      expect(marginOf()).toBe(300);
    });

    it("measures again when only the frame width changes", async () => {
      const spy = mockMeasure({ top: bodyTop(), height: 800 });
      const view = render(inFrame(FRAME, <SheetBody os="android">{null}</SheetBody>));
      await settle(1000);
      const calls = spy.mock.calls.length;
      view.rerender(inFrame(frame(511, 914), <SheetBody os="android">{null}</SheetBody>));
      await settle();
      expect(spy.mock.calls.length).toBeGreaterThan(calls);
    });

    it("re-measures on a stable detent change and on transitionEnd, not on an unstable one", async () => {
      const spy = mockMeasure({ top: bodyTop(), height: 800 });
      const nav = fakeNavigation();
      render(
        inFrame(FRAME, <NavigationContext.Provider value={nav.navigation as never}>
          <SheetBody os="android">{null}</SheetBody>
        </NavigationContext.Provider>),
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
        inFrame(FRAME, <NavigationContext.Provider value={nav.navigation as never}>
          <SheetBody os="android">{null}</SheetBody>
        </NavigationContext.Provider>),
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

    it("does not shorten or lift a tab-stack sheet by a measure while the keyboard is up, with the tab bar's share at 0", async () => {
      mockMeasure({ top: bodyTop(), height: 800 });
      const nav = fakeNavigation("tab");
      const keyboard: Record<string, () => void> = {};
      jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: () => void) => {
        keyboard[event] = cb;
        return { remove: () => undefined };
      }) as never);
      render(
        inFrame(FRAME, <NavigationContext.Provider value={nav.navigation as never}>
          <SheetBody os="android">{null}</SheetBody>
        </NavigationContext.Provider>),
      );
      await act(async () => {
        keyboard.keyboardDidShow?.();
      });
      await settle(1000);
      nav.emit("transitionEnd");
      await settle();
      expect(marginOf()).toBe(0);
    });

    it("with the keyboard up the scroll view ends at the keyboard's top, and returns when it hides", async () => {
      const position = { top: bodyTop(), height: 800 };
      mockMeasure(position);
      const keyboard: Record<string, (e?: unknown) => void> = {};
      jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: (e?: unknown) => void) => {
        keyboard[event] = cb;
        return { remove: () => undefined };
      }) as never);
      render(inFrame(FRAME, <SheetBody os="android">{null}</SheetBody>));
      await settle(1000);
      const resting = marginOf();
      // The keyboard expands the sheet to its top detent, which ends at the screen's edge.
      position.top = FRAME.height - 800;
      await act(async () => {
        keyboard.keyboardDidShow?.({ endCoordinates: { height: 420, screenY: 500 } });
      });
      await settle(1000);
      // The reported height stops at the navigation bar: its inset (34 here) is added.
      expect(marginOf()).toBe(420 + 34);
      position.top = bodyTop();
      await act(async () => {
        keyboard.keyboardDidHide?.();
      });
      await settle(100);
      expect(marginOf()).toBe(resting);
      await settle(1000);
      expect(marginOf()).toBe(resting);
    });

    it("a sheet that still reaches past the screen's edge with the keyboard up is lifted by the keyboard and that overshoot", async () => {
      // The Dapur import row: a form sheet over a modal keeps 50 below the edge even at its top detent.
      mockMeasure({ top: FRAME.height - 800 + 50, height: 800 });
      const keyboard: Record<string, (e?: unknown) => void> = {};
      jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: (e?: unknown) => void) => {
        keyboard[event] = cb;
        return { remove: () => undefined };
      }) as never);
      render(inFrame(FRAME, <SheetBody os="android" footer={<Text>Selesai</Text>}>{null}</SheetBody>));
      await settle(1000);
      expect(marginOf()).toBe(50);
      await act(async () => {
        keyboard.keyboardDidShow?.({ endCoordinates: { height: 420, screenY: 500 } });
      });
      await settle(1000);
      expect(marginOf()).toBe(420 + 34 + 50);
      await act(async () => {
        keyboard.keyboardDidHide?.();
      });
      await settle(1000);
      expect(marginOf()).toBe(50);
    });

    it("first focus: the form detent's hidden-below is not added to the keyboard while the sheet is still rising", async () => {
      // Dapur import row editor: opens at the form detent (200 below the edge), the keyboard lifts it to the top detent.
      const position = { top: bodyTop(), height: 800 };
      mockMeasure(position);
      const nav = fakeNavigation();
      const keyboard: Record<string, (e?: unknown) => void> = {};
      jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: (e?: unknown) => void) => {
        keyboard[event] = cb;
        return { remove: () => undefined };
      }) as never);
      render(
        inFrame(FRAME, <NavigationContext.Provider value={nav.navigation as never}>
          <SheetBody os="android" footer={<Text>Selesai</Text>}>{null}</SheetBody>
        </NavigationContext.Provider>),
      );
      await settle(1000);
      expect(marginOf()).toBe(200);
      const lift = 420 + 34;
      const seen: number[] = [];
      nav.emit("sheetDetentChange", { data: { stable: false } });
      await act(async () => {
        keyboard.keyboardDidShow?.({ endCoordinates: { height: 420, screenY: 500 } });
      });
      seen.push(marginOf());
      // Mid-rise: the sheet is still 120 below the edge when the 50 ms measure runs.
      position.top = FRAME.height - 800 + 120;
      await settle(60);
      seen.push(marginOf());
      await settle(300);
      seen.push(marginOf());
      expect(Math.max(...seen)).toBeLessThanOrEqual(lift + 8);
      position.top = FRAME.height - 800;
      nav.emit("sheetDetentChange", { data: { stable: true } });
      await settle(100);
      expect(marginOf()).toBe(lift);
    });

    it("a sheet that stays at the form detent under the keyboard ends at the keyboard's top and keeps its action inside the scroll view", async () => {
      // The sheet does not expand (customer alamat, masalah, ulasan at font scale 1.0): 200 of it stays below the edge.
      mockMeasure({ top: bodyTop(), height: 800 });
      const keyboard: Record<string, (e?: unknown) => void> = {};
      jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: (e?: unknown) => void) => {
        keyboard[event] = cb;
        return { remove: () => undefined };
      }) as never);
      render(inFrame(FRAME, <SheetBody os="android" footer={<Text>Nanti saja</Text>}>{null}</SheetBody>));
      await settle(1000);
      expect(within(screen.getByTestId("sheet-body")).queryByText("Nanti saja")).toBeNull();
      expect(within(screen.getByTestId("sheet-frame")).getByText("Nanti saja")).toBeTruthy();
      await act(async () => {
        keyboard.keyboardDidShow?.({ endCoordinates: { height: 420, screenY: 500 } });
      });
      await settle(1000);
      // The frame still ends at the keyboard's top ...
      expect(marginOf()).toBe(200 + 420 + 34);
      // ... but what is left above it is too short for a body and a pinned footer: the action scrolls with the field.
      expect(within(screen.getByTestId("sheet-body")).getByText("Nanti saja")).toBeTruthy();
      await act(async () => {
        keyboard.keyboardDidHide?.();
      });
      await settle(1000);
      expect(marginOf()).toBe(200);
      expect(within(screen.getByTestId("sheet-body")).queryByText("Nanti saja")).toBeNull();
      expect(within(screen.getByTestId("sheet-frame")).getByText("Nanti saja")).toBeTruthy();
    });

    const kbMock = () => {
      const keyboard: Record<string, (e?: unknown) => void> = {};
      jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: (e?: unknown) => void) => {
        keyboard[event] = cb;
        return { remove: () => undefined };
      }) as never);
      return keyboard;
    };
    const shown = { endCoordinates: { height: 420, screenY: 500 } };

    it("hiding the keyboard while the sheet stays at its top detent does not bring back the form detent's hidden-below", async () => {
      const position = { top: bodyTop(), height: 800 };
      mockMeasure(position);
      const nav = fakeNavigation();
      const keyboard = kbMock();
      render(
        inFrame(FRAME, <NavigationContext.Provider value={nav.navigation as never}>
          <SheetBody os="android" footer={<Text>Selesai</Text>}>{null}</SheetBody>
        </NavigationContext.Provider>),
      );
      await settle(1000);
      expect(marginOf()).toBe(200);
      nav.emit("sheetDetentChange", { data: { stable: false } });
      await act(async () => {
        keyboard.keyboardDidShow?.(shown);
      });
      position.top = FRAME.height - 800;
      nav.emit("sheetDetentChange", { data: { stable: true } });
      await settle(100);
      expect(marginOf()).toBe(454);
      const seen: number[] = [];
      await act(async () => {
        keyboard.keyboardDidHide?.();
      });
      seen.push(marginOf());
      await settle(30);
      seen.push(marginOf());
      await settle(300);
      seen.push(marginOf());
      expect(Math.max(...seen)).toBeLessThanOrEqual(8);
    });

    it("a second focus after the sheet was dragged to its top detent is lifted by the keyboard alone", async () => {
      const position = { top: bodyTop(), height: 800 };
      mockMeasure(position);
      const nav = fakeNavigation();
      const keyboard = kbMock();
      render(
        inFrame(FRAME, <NavigationContext.Provider value={nav.navigation as never}>
          <SheetBody os="android" footer={<Text>Kirim</Text>}>{null}</SheetBody>
        </NavigationContext.Provider>),
      );
      await settle(1000);
      await act(async () => {
        keyboard.keyboardDidShow?.(shown);
      });
      await settle(1000);
      expect(marginOf()).toBe(200 + 454);
      await act(async () => {
        keyboard.keyboardDidHide?.();
      });
      await settle(1000);
      expect(marginOf()).toBe(200);
      nav.emit("sheetDetentChange", { data: { stable: false } });
      position.top = FRAME.height - 800;
      nav.emit("sheetDetentChange", { data: { stable: true } });
      await settle(100);
      expect(marginOf()).toBe(0);
      await act(async () => {
        keyboard.keyboardDidShow?.(shown);
      });
      expect(marginOf()).toBeLessThanOrEqual(454 + 8);
      await settle(1000);
      expect(marginOf()).toBe(454);
    });

    const withFooter = (footer: ReactNode, nav?: ReturnType<typeof fakeNavigation>) =>
      inFrame(
        FRAME,
        nav ? (
          <NavigationContext.Provider value={nav.navigation as never}>
            <SheetBody os="android" footer={footer}>{null}</SheetBody>
          </NavigationContext.Provider>
        ) : (
          <SheetBody os="android" footer={footer}>{null}</SheetBody>
        ),
      );
    const noError = <Text>Kirim</Text>;
    const oneError = (
      <>
        <Text>Gagal</Text>
        <Text>Kirim</Text>
      </>
    );
    const otherError = (
      <>
        <Text>Gagal lagi</Text>
        <Text>Kirim</Text>
      </>
    );
    const scrollSpy = () => {
      const scrollTo = jest.fn();
      jest.spyOn(require("react-native").ScrollView.prototype, "scrollTo").mockImplementation(scrollTo);
      return scrollTo;
    };
    const fireFooter = (y: number, h: number) =>
      fireEvent(screen.getByTestId("sheet-footer"), "layout", { nativeEvent: { layout: { x: 0, y, width: 400, height: h } } });

    it("an inline footer that grows (a submit error) is scrolled so its top, where the error sits, is at the top of the body", async () => {
      mockMeasure({ top: bodyTop(), height: 800 });
      const keyboard = kbMock();
      const view = render(withFooter(noError));
      await settle(1000);
      await act(async () => {
        keyboard.keyboardDidShow?.(shown);
      });
      await settle(1000);
      const body = screen.getByTestId("sheet-body");
      expect(within(body).getByText("Kirim")).toBeTruthy();
      const scrollTo = scrollSpy();
      // The body is 200 tall: shorter than the grown footer (260), so the footer's top is the target.
      fireEvent(body, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 200 } } });
      fireFooter(400, 80);
      expect(scrollTo).not.toHaveBeenCalled();
      view.rerender(withFooter(oneError));
      fireFooter(400, 260);
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 400, animated: true });
      // A body taller than the footer shows the whole footer, not a scroll past its top.
      fireEvent(body, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 300 } } });
      view.rerender(withFooter(otherError));
      fireFooter(400, 120);
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 400 + 120 - 300, animated: true });
    });

    it("the keyboard flipping the footer inline on first focus does not scroll the focused field away", async () => {
      mockMeasure({ top: bodyTop(), height: 800 });
      const keyboard = kbMock();
      render(withFooter(noError));
      await settle(1000);
      fireFooter(0, 80);
      await act(async () => {
        keyboard.keyboardDidShow?.(shown);
      });
      await settle(1000);
      expect(within(screen.getByTestId("sheet-body")).getByText("Kirim")).toBeTruthy();
      const scrollTo = scrollSpy();
      // Inline it carries the keyboard-up padding and is measured taller than it was pinned: no error, no scroll.
      fireFooter(300, 120);
      fireFooter(300, 122);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("a footer content change that came before the keyboard is not an error that scrolls the field away", async () => {
      mockMeasure({ top: bodyTop(), height: 800 });
      const keyboard = kbMock();
      const view = render(withFooter(noError));
      await settle(1000);
      fireFooter(0, 80);
      view.rerender(withFooter(oneError));
      await act(async () => {
        keyboard.keyboardDidShow?.(shown);
      });
      await settle(1000);
      const scrollTo = scrollSpy();
      fireFooter(300, 160);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("a pinned footer that grows because of an error until it flips inline lands scrolled to its top", async () => {
      // A tall sheet: the keyboard is up and the footer still fits pinned until the error makes it taller.
      mockMeasure({ top: FRAME.height - 1800, height: 1800 });
      const keyboard = kbMock();
      const view = render(withFooter(noError));
      await settle(1000);
      await act(async () => {
        keyboard.keyboardDidShow?.(shown);
      });
      await settle(1000);
      fireFooter(0, 80);
      expect(within(screen.getByTestId("sheet-frame")).getByText("Kirim")).toBeTruthy();
      expect(within(screen.getByTestId("sheet-body")).queryByText("Kirim")).toBeNull();
      const scrollTo = scrollSpy();
      view.rerender(withFooter(oneError));
      fireFooter(0, 1300);
      await settle(100);
      expect(within(screen.getByTestId("sheet-body")).getByText("Kirim")).toBeTruthy();
      fireFooter(300, 1300);
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 300, animated: true });
      // The same footer again is not a reason to scroll.
      fireFooter(300, 1300);
      expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    it("a tab-stack sheet with too little room above the keyboard keeps its action inside the scroll view", async () => {
      mockMeasure({ top: 300, height: 500 });
      const nav = fakeNavigation("tab");
      const keyboard = kbMock();
      render(
        inFrame(FRAME, <NavigationContext.Provider value={nav.navigation as never}>
          <SheetBody os="android" footer={<Text>Balas</Text>}>{null}</SheetBody>
        </NavigationContext.Provider>),
      );
      expect(within(screen.getByTestId("sheet-frame")).getByText("Balas")).toBeTruthy();
      await act(async () => {
        keyboard.keyboardDidShow?.(shown);
      });
      await settle(1000);
      expect(marginOf()).toBe(454 - TAB_BAR);
      expect(within(screen.getByTestId("sheet-body")).getByText("Balas")).toBeTruthy();
      await act(async () => {
        keyboard.keyboardDidHide?.();
      });
      await settle(1000);
      expect(within(screen.getByTestId("sheet-body")).queryByText("Balas")).toBeNull();
    });

    it("a tab-stack sheet also ends at the keyboard's top, and returns when it hides", async () => {
      const nav = fakeNavigation("tab");
      const keyboard: Record<string, (e?: unknown) => void> = {};
      jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: (e?: unknown) => void) => {
        keyboard[event] = cb;
        return { remove: () => undefined };
      }) as never);
      render(
        inFrame(FRAME, <NavigationContext.Provider value={nav.navigation as never}>
          <SheetBody os="android">{null}</SheetBody>
        </NavigationContext.Provider>),
      );
      await act(async () => {
        keyboard.keyboardDidShow?.({ endCoordinates: { height: 300, screenY: 600 } });
      });
      // The tab sheet's parent already ends above the bar (96 plus the 34 inset): the lift is the keyboard's less the bar.
      expect(marginOf()).toBe(300 + 34 - TAB_BAR);
      await act(async () => {
        keyboard.keyboardDidHide?.();
      });
      expect(marginOf()).toBe(TAB_BAR);
    });

    describe("a tab-stack sheet after the keyboard", () => {
      // The sheet's container ends where the tab bar starts when the native sheet is shifted up by the bar, and at the
      // window's bottom when it is not; the JS bar margin must only fill the gap that is really there.
      const run = async (unmarginedBottom: number) => {
        mockMeasure({ top: 300, height: unmarginedBottom - 300 });
        const nav = fakeNavigation("tab");
        const keyboard = kbMock();
        render(withFooter(<Text>Balas</Text>, nav));
        await settle(1000);
        const first = marginOf();
        await act(async () => {
          keyboard.keyboardDidShow?.(shown);
        });
        await settle(1000);
        await act(async () => {
          keyboard.keyboardDidHide?.();
        });
        await settle(1000);
        return { first, after: marginOf() };
      };

      it("keeps the bar margin when the sheet still reaches the window bottom", async () => {
        const m = await run(FRAME.height);
        expect(m.first).toBe(TAB_BAR);
        expect(m.after).toBe(TAB_BAR);
      });

      it("drops the bar margin when the native sheet stays shifted up by the bar after the keyboard hid", async () => {
        const m = await run(FRAME.height - TAB_BAR);
        expect(m.after).toBe(0);
      });
    });
  });
});
