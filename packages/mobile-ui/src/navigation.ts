import { use, useEffect, useState } from "react";
import { HeaderHeightContext, HeaderShownContext, NavigationContext } from "expo-router/react-navigation";

/**
 * The navigation of the screen this component sits in, or undefined outside a navigator (component tests, early
 * boot). Shared components use it instead of `useNavigation`, which throws there.
 */
export function useScreenNavigation() {
  return use(NavigationContext);
}

/** True while a native stack header (or a custom stack header) sits above this screen and pays the top inset. */
export function useUnderStackHeader(): boolean {
  return use(HeaderShownContext);
}

/**
 * The height of the native stack header above this screen, measured from the top of the screen's own navigation
 * controller: the window's top (status bar included) on a full-screen push, the sheet's top (no status bar) in an iOS
 * sheet or modal. `Screen` adds its window y to place the toast. It changes as the native header reports each new
 * height, so on iOS it follows the large title as it collapses into the inline bar. react-navigation debounces those
 * reports (100ms) only under `headerLargeTitleEnabled` or a search bar; this repo sets `headerLargeTitle`
 * (`nativeHeaderOptions`), so each report lands at once. Undefined outside a stack.
 */
export function useStackHeaderHeight(): number | undefined {
  return use(HeaderHeightContext);
}

/** Whether this component's screen is the focused one; outside a navigator it counts as focused. */
export function useScreenFocused(): boolean {
  const navigation = useScreenNavigation();
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  useEffect(() => {
    if (!navigation) return;
    setFocused(navigation.isFocused());
    const onFocus = navigation.addListener("focus", () => setFocused(true));
    const onBlur = navigation.addListener("blur", () => setFocused(false));
    return () => {
      onFocus();
      onBlur();
    };
  }, [navigation]);
  return focused;
}
