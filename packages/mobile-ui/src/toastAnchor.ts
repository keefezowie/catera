import { createContext, use, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenFocused, useScreenNavigation } from "./navigation";

/**
 * Where the focused screen's chrome ends, in window points, so the toast never covers it.
 * - `top`: the distance from the window's top to the bottom edge of the header (the native bar as it is at that
 *   moment, or a MoodHeader). iOS sets the pill under it.
 * - `bottom`: the distance from the window's bottom to the top edge of whatever is pinned there (the tab bar, a
 *   StickyAction footer). Android sets the snackbar above it.
 */
export type ToastAnchor = { top?: number; bottom?: number };

type Register = (key: object, anchor: ToastAnchor | null) => void;

/** Filled by `ToastProvider`; outside one, anchors go nowhere. */
export const ToastAnchorContext = createContext<Register>(() => {});

/**
 * Material 3's navigation bar is 80dp; on Android it sits above the system navigation inset. iOS never reads a
 * bottom anchor (its toast sits at the top).
 */
export const ANDROID_TAB_BAR = 80;

/**
 * Tells the toast where this screen's chrome is while the screen is focused, and takes it back on blur or unmount.
 * Several parts of one screen may each register (the header its `top`, the footer its `bottom`); the toast clears all
 * of them (the largest `top` and the largest `bottom` win). Pass `null` (or no edge) to register nothing.
 */
export function useToastAnchor(anchor: ToastAnchor | null | undefined): void {
  const register = use(ToastAnchorContext);
  const focused = useScreenFocused();
  const key = useRef({}).current;
  const top = anchor?.top;
  const bottom = anchor?.bottom;
  useEffect(() => {
    if (!focused || (top === undefined && bottom === undefined)) return;
    register(key, { top, bottom });
    return () => register(key, null);
  }, [register, key, focused, top, bottom]);
}

type NavigationLike = { getState?: () => { type?: string } | undefined; getParent?: () => NavigationLike | undefined };

/** True when this screen, or a navigator above it, is the tab navigator (so the tab bar is drawn under it). */
function insideTabs(navigation: NavigationLike | undefined): boolean {
  for (let nav = navigation; nav; nav = nav.getParent?.()) if (nav.getState?.()?.type === "tab") return true;
  return false;
}

/**
 * How far above the window's bottom this screen ends: inside the tabs, the tab bar and the system inset under it;
 * elsewhere (a modal, a full-screen flow) only the system inset.
 */
export function useScreenBottomEdge(): number {
  const insets = useSafeAreaInsets();
  const navigation = useScreenNavigation() as NavigationLike | undefined;
  return insets.bottom + (insideTabs(navigation) ? ANDROID_TAB_BAR : 0);
}
