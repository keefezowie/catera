import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as SafeArea from "react-native-safe-area-context";
import { AccessibilityInfo, Keyboard, StyleSheet } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { NavigationContext } from "expo-router/react-navigation";
import { nativeMotion } from "@catera/design-tokens";
import {
  ANDROID_TAB_BAR,
  androidTabBarHeight,
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

// React Native's jest environment reports a font scale of 2; the suite states the one it means.
let mockFontScale = 1;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 800, scale: 2.625, fontScale: mockFontScale }),
}));

type Listener = (e: { data?: { closing?: boolean } }) => void;

/**
 * A stand-in for the screen's navigation: `parent` is the navigator above (a "tab" one for a tab-stack sheet). `emit`
 * of "focus" or "blur" also moves what `isFocused` reports, as react-navigation does.
 */
function fakeNavigation(parent: "tab" | "stack" | null = null) {
  const listeners: Record<string, Listener[]> = {};
  const parentNav = parent ? { getState: () => ({ type: parent }), getParent: () => undefined } : undefined;
  let focused = true;
  const navigation = {
    getState: () => ({ type: "stack" }),
    getParent: () => parentNav,
    isFocused: () => focused,
    goBack: () => {},
    addListener: (event: string, cb: Listener) => {
      (listeners[event] ??= []).push(cb);
      return () => void listeners[event].splice(listeners[event].indexOf(cb), 1);
    },
  };
  const emit = (event: string, closing = false) =>
    act(() => {
      if (event === "focus") focused = true;
      if (event === "blur") focused = false;
      [...(listeners[event] ?? [])].forEach((cb) => cb({ data: { closing } }));
    });
  return { navigation, emit };
}

/** React Native's jest setup already makes this a mock, so a spy on it would keep the calls of earlier tests. */
function spyFocus() {
  const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
  focus.mockClear();
  return focus;
}

afterEach(() => {
  mockFontScale = 1;
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

describe("the strip follows the sheet's focus, not its mount", () => {
  const LABEL = "Demo · data sintetis";
  const strip = () => screen.getByTestId("demo-strip", { includeHiddenElements: true });
  const hidden = () => strip().props.importantForAccessibility === "no-hide-descendants";
  const sheet = (navigation: unknown, title = "Ada masalah") => (
    <NavigationContext.Provider value={navigation as never}>
      <SheetHeader title={title} os="android" />
    </NavigationContext.Provider>
  );

  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
  });

  it("a push over the sheet restores the strip, and coming back hides it again", () => {
    // Signed out, Kirim laporan pushes /login over Ada masalah without closing it: the sheet stays mounted under it.
    const ada = fakeNavigation("tab");
    const view = render(
      <>
        <DemoStrip label={LABEL} />
        {sheet(ada.navigation)}
      </>,
    );
    expect(hidden()).toBe(true);
    ada.emit("blur");
    expect(hidden()).toBe(false);
    expect(screen.getByLabelText(LABEL)).toBeTruthy();
    ada.emit("focus");
    expect(hidden()).toBe(true);
    view.unmount();
  });

  it("a blur (tab switch) restores the strip, and the sheet leaving while blurred does not count twice", () => {
    // Android keeps tab A's stack, its sheet included, mounted after a switch to tab B.
    const ada = fakeNavigation("tab");
    const view = render(
      <>
        <DemoStrip label={LABEL} />
        {sheet(ada.navigation)}
      </>,
    );
    ada.emit("blur");
    expect(hidden()).toBe(false);
    view.rerender(<DemoStrip label={LABEL} />);
    expect(hidden()).toBe(false);
    // A later sheet still hides the strip: the count did not go below zero.
    const next = fakeNavigation("tab");
    view.rerender(
      <>
        <DemoStrip label={LABEL} />
        {sheet(next.navigation, "Ubah hari")}
      </>,
    );
    expect(hidden()).toBe(true);
    view.unmount();
  });

  it("a confirm over a sheet keeps the strip hidden until the last sheet goes", () => {
    const ada = fakeNavigation("tab");
    const view = render(
      <>
        <DemoStrip label={LABEL} />
        {sheet(ada.navigation)}
      </>,
    );
    // The root stack presents the confirm (focused) and the sheet under it blurs.
    const confirm = fakeNavigation(null);
    view.rerender(
      <>
        <DemoStrip label={LABEL} />
        {sheet(ada.navigation)}
        {sheet(confirm.navigation, "Buang laporan?")}
      </>,
    );
    ada.emit("blur");
    expect(hidden()).toBe(true);
    // The confirm closes and the sheet takes the focus back: still hidden.
    view.rerender(
      <>
        <DemoStrip label={LABEL} />
        {sheet(ada.navigation)}
      </>,
    );
    ada.emit("focus");
    expect(hidden()).toBe(true);
    view.rerender(<DemoStrip label={LABEL} />);
    expect(hidden()).toBe(false);
    view.unmount();
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

  it("the reserve grows with the bar's label at font scale 1.3", () => {
    jest.spyOn(SafeArea, "useSafeAreaInsets").mockReturnValue({ top: 24, bottom: 24, left: 0, right: 0 });
    // The bar's 12/16 label line grows 16 × 0.3 = 4.8dp at 1.3; the reserve rounds it up and never shrinks below 80.
    expect(androidTabBarHeight(1)).toBe(ANDROID_TAB_BAR);
    expect(androidTabBarHeight(0.85)).toBe(ANDROID_TAB_BAR);
    expect(androidTabBarHeight(1.3)).toBe(ANDROID_TAB_BAR + 5);
    mockFontScale = 1.3;
    const { navigation } = fakeNavigation("tab");
    render(
      <NavigationContext.Provider value={navigation as never}>
        <SheetBody os="android">{null}</SheetBody>
      </NavigationContext.Provider>,
    );
    expect(StyleSheet.flatten(screen.getByTestId("sheet-body").props.style).marginBottom).toBe(ANDROID_TAB_BAR + 5 + 24);
  });
});
