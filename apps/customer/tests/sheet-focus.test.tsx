import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as SafeArea from "react-native-safe-area-context";
import { AccessibilityInfo, Keyboard, StyleSheet } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { NavigationContext } from "expo-router/react-navigation";
import { nativeMotion } from "@catera/design-tokens";
import {
  ANDROID_TAB_BAR,
  DemoStrip,
  SHEET_FOCUS_FALLBACK_MS,
  SHEET_FOCUS_SETTLE_MS,
  SheetBody,
  SheetHeader,
  tabBarNativeProps,
} from "@catera/mobile-ui";

/**
 * Spec 4.1 and 4.2 (Phase G, G1b): TalkBack sent focus to the demo strip instead of the Ada masalah title, and the tab
 * bar covered "Kirim laporan" at the 0.6 detent. These pin the build side of the fix; the TalkBack double tap itself is
 * the emulator gate's.
 */

type Listener = (e: { data?: { closing?: boolean } }) => void;

/** A stand-in for the screen's navigation: `parent` is the navigator above (a "tab" one for a tab-stack sheet). */
function fakeNavigation(parent: "tab" | "stack" | null = null) {
  const listeners: Record<string, Listener[]> = {};
  const parentNav = parent ? { getState: () => ({ type: parent }), getParent: () => undefined } : undefined;
  const navigation = {
    getState: () => ({ type: "stack" }),
    getParent: () => parentNav,
    isFocused: () => true,
    goBack: () => {},
    addListener: (event: string, cb: Listener) => {
      (listeners[event] ??= []).push(cb);
      return () => void listeners[event].splice(listeners[event].indexOf(cb), 1);
    },
  };
  const emit = (event: string, closing: boolean) =>
    act(() => [...(listeners[event] ?? [])].forEach((cb) => cb({ data: { closing } })));
  return { navigation, emit };
}

/** React Native's jest setup already makes this a mock, so a spy on it would keep the calls of earlier tests. */
function spyFocus() {
  const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
  focus.mockClear();
  return focus;
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("sheet title focus", () => {
  it("the fallback timer does not read nativeMotion.feature", () => {
    // A fixed 400ms, so slowing the motion tokens can never push the focus later (spec 4.1, step 1).
    expect(SHEET_FOCUS_FALLBACK_MS).toBe(400);
    expect(SHEET_FOCUS_SETTLE_MS).toBe(250);
    expect(SHEET_FOCUS_FALLBACK_MS).not.toBe(nativeMotion.feature);
    const source = readFileSync(join(__dirname, "../../../packages/mobile-ui/src/SheetHeader.tsx"), "utf8");
    expect(source).not.toMatch(/nativeMotion/);
    expect(source).not.toMatch(/SHEET_FOCUS_FALLBACK_MS\s*=/);

    const focus = spyFocus();
    jest.useFakeTimers();
    const view = render(<SheetHeader title="Ada masalah" os="android" />);
    act(() => jest.advanceTimersByTime(SHEET_FOCUS_FALLBACK_MS - 1));
    expect(focus).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(focus).toHaveBeenCalledTimes(1);
    const [target, event] = focus.mock.calls[0] as unknown as [{ props: { children: string } }, string];
    expect(event).toBe("focus");
    expect(target.props.children).toBe("Ada masalah");
    // Unmounted while the timers are still fake, so its settle cannot reach the next test.
    view.unmount();
  });

  it("focus is sent on present and again after the settle", () => {
    const focus = spyFocus();
    const { navigation, emit } = fakeNavigation("tab");
    jest.useFakeTimers();
    const view = render(
      <NavigationContext.Provider value={navigation as never}>
        <SheetHeader title="Ada masalah" os="android" />
      </NavigationContext.Provider>,
    );
    // The sheet has not risen yet: the reader stays where it is.
    act(() => jest.advanceTimersByTime(100));
    expect(focus).not.toHaveBeenCalled();
    // Present: once at once...
    emit("transitionEnd", false);
    expect(focus).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(SHEET_FOCUS_SETTLE_MS - 1));
    expect(focus).toHaveBeenCalledTimes(1);
    // ...and once more after the settle, when TalkBack has finished re-asserting focus on the window under the sheet.
    act(() => jest.advanceTimersByTime(1));
    expect(focus).toHaveBeenCalledTimes(2);
    // The present cancelled the fallback: nothing more, however long the sheet stays.
    act(() => jest.advanceTimersByTime(5000));
    expect(focus).toHaveBeenCalledTimes(2);
    // Closing never moves the reader.
    emit("transitionEnd", true);
    act(() => jest.advanceTimersByTime(5000));
    expect(focus).toHaveBeenCalledTimes(2);
    for (const [target, event] of focus.mock.calls as unknown as [{ props: { children: string } }, string][]) {
      expect(event).toBe("focus");
      expect(target.props.children).toBe("Ada masalah");
    }
    view.unmount();
  });
});

describe("the page under a sheet", () => {
  it("the demo strip and tab bar are hidden from accessibility while a sheet is on top and restored after", () => {
    jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    const strip = () => screen.getByTestId("demo-strip", { includeHiddenElements: true });
    const page = render(<DemoStrip label="Demo · data sintetis" />);
    expect(strip().props).toMatchObject({ accessible: true, importantForAccessibility: "auto", accessibilityElementsHidden: false });
    expect(screen.getByLabelText("Demo · data sintetis")).toBeTruthy();
    expect(tabBarNativeProps(false, "ios")).toEqual({ accessibilityElementsHidden: false });

    // A sheet rises: the strip leaves the accessibility tree on both platforms.
    page.rerender(
      <>
        <DemoStrip label="Demo · data sintetis" />
        <SheetHeader title="Ada masalah" os="android" />
      </>,
    );
    expect(strip().props).toMatchObject({ accessible: false, importantForAccessibility: "no-hide-descendants", accessibilityElementsHidden: true });
    expect(screen.queryByLabelText("Demo · data sintetis")).toBeNull();
    // iOS hides the tab host: UIKit presents the sheet outside it. On Android the sheet is drawn inside the tab host
    // (react-native-screens' TabsContainer, beside the bar), so hiding the host would hide the sheet too: the bar stays
    // in the tree there, after the sheet in reading order.
    expect(tabBarNativeProps(true, "ios")).toEqual({ accessibilityElementsHidden: true });
    expect(tabBarNativeProps(true, "android")).toEqual({});

    // A confirm sheet over the first one keeps the page hidden; the page comes back only when the last sheet goes.
    page.rerender(
      <>
        <DemoStrip label="Demo · data sintetis" />
        <SheetHeader title="Ada masalah" os="android" />
        <SheetHeader title="Buang laporan?" os="android" />
      </>,
    );
    page.rerender(
      <>
        <DemoStrip label="Demo · data sintetis" />
        <SheetHeader title="Ada masalah" os="android" />
      </>,
    );
    expect(strip().props.importantForAccessibility).toBe("no-hide-descendants");
    page.rerender(<DemoStrip label="Demo · data sintetis" />);
    expect(strip().props).toMatchObject({ accessible: true, importantForAccessibility: "auto", accessibilityElementsHidden: false });
    expect(screen.getByLabelText("Demo · data sintetis")).toBeTruthy();
  });
});

describe("tab-stack form sheets", () => {
  it("the form sheet content reserves the tab bar height", () => {
    jest.spyOn(SafeArea, "useSafeAreaInsets").mockReturnValue({ top: 24, bottom: 24, left: 0, right: 0 });
    const keyboard: Record<string, () => void> = {};
    jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: () => void) => {
      keyboard[event] = cb;
      return { remove: () => void delete keyboard[event] };
    }) as never);
    const body = () => screen.getByTestId("sheet-body");
    const within = (parent: "tab" | "stack", os: string) => {
      const { navigation } = fakeNavigation(parent);
      return render(
        <NavigationContext.Provider value={navigation as never}>
          <SheetBody os={os}>{null}</SheetBody>
        </NavigationContext.Provider>,
      );
    };

    // Android, in a tab's stack: the bar (80dp and the system inset under it) is drawn over the sheet's bottom, so the
    // scroll view ends above it and the last button scrolls clear of it.
    let view = within("tab", "android");
    expect(StyleSheet.flatten(body().props.style).marginBottom).toBe(ANDROID_TAB_BAR + 24);
    expect(StyleSheet.flatten(body().props.contentContainerStyle).paddingBottom).toBe(24);

    // The keyboard covers the bar: no reserve while it is up, and it returns when it goes.
    act(() => keyboard.keyboardDidShow());
    expect(StyleSheet.flatten(body().props.style).marginBottom).toBe(0);
    expect(StyleSheet.flatten(body().props.contentContainerStyle).paddingBottom).toBe(24 + 24);
    act(() => keyboard.keyboardDidHide());
    expect(StyleSheet.flatten(body().props.style).marginBottom).toBe(ANDROID_TAB_BAR + 24);
    view.unmount();

    // A sheet over the root stack (a purchase, the Dapur import) has no bar under it; iOS presents every sheet above
    // the tab bar. Both keep the plain foot over the system inset.
    view = within("stack", "android");
    expect(StyleSheet.flatten(body().props.style).marginBottom).toBe(0);
    expect(StyleSheet.flatten(body().props.contentContainerStyle).paddingBottom).toBe(24 + 24);
    view.unmount();
    within("tab", "ios");
    expect(StyleSheet.flatten(body().props.style).marginBottom).toBe(0);
    expect(StyleSheet.flatten(body().props.contentContainerStyle).paddingBottom).toBe(24 + 24);
  });
});
