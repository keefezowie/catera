import { createContext, use, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// The native stack puts each screen's own `presentation` option in this context (NativeStackView.native.js, around
// every route it renders). expo-router 57 does not re-export it, so it is read from its file; the package has no
// `exports` map, and the file ships with its type declaration.
import { ScreenPresentationContext } from "expo-router/build/react-navigation/native-stack/utils/ScreenPresentationContext";
import { useScreenFocused, useScreenNavigation } from "./navigation";

/**
 * Where the focused screen's chrome ends, in window points, so the toast never covers it.
 * - `top`: the distance from the window's top to the bottom edge of the header (the native bar as it is at that
 *   moment, or a MoodHeader). iOS sets the pill under it on full-screen screens.
 * - `bottom`: the distance from the window's bottom to the top edge of whatever is pinned there (the tab bar, a
 *   StickyAction footer). Android sets the snackbar above it, and so does iOS in a sheet.
 * - `sheet`: the screen is presented as a sheet. A sheet's header is measured inside the sheet, not the window, so iOS
 *   shows that screen's toasts at the bottom instead (above the home indicator, the keyboard and any footer); a sheet
 *   has no tab bar under it, so Android sets the snackbar on the system inset rather than above a tab bar.
 *   `useToastAnchor` fills it in from the screen's presentation; callers do not pass it.
 */
export type ToastAnchor = { top?: number; bottom?: number; sheet?: boolean };

type Register = (key: object, anchor: ToastAnchor | null) => void;

/** Filled by `ToastProvider`; outside one, anchors go nowhere. */
export const ToastAnchorContext = createContext<Register>(() => {});

/**
 * Material 3's navigation bar is 80dp; on Android it sits above the system navigation inset. iOS reads a bottom
 * anchor only in a sheet, which never sits inside the tabs.
 */
export const ANDROID_TAB_BAR = 80;

/** The presentations iOS draws as a card sliding over the screen below, rather than a full screen. */
const SHEETS = new Set(["modal", "pageSheet", "formSheet"]);

/**
 * True when this screen's route is presented as a sheet (`flow("modal")`, `useModalOptions`, `sheetOptions`). It reads
 * what the native stack already knows about the route, never a window measurement (which reports 0 inside a native
 * modal on Fabric). It sees the nearest route only: a navigator nested inside a sheet would read its own route.
 */
export function usePresentedAsSheet(): boolean {
  const presentation = use(ScreenPresentationContext);
  return presentation !== undefined && SHEETS.has(presentation);
}

/**
 * Tells the toast where this screen's chrome is while the screen is focused, and takes it back on blur or unmount.
 * Several parts of one screen may each register (the header its `top`, the footer its `bottom`); the toast clears all
 * of them (the largest `top` and the largest `bottom` win). In a sheet an anchor with no edge still registers, so a
 * sheet's title row alone moves the iOS toast to the bottom. Pass `null` to register nothing.
 */
export function useToastAnchor(anchor: ToastAnchor | null | undefined): void {
  const register = use(ToastAnchorContext);
  const focused = useScreenFocused();
  const sheet = usePresentedAsSheet();
  const key = useRef({}).current;
  const live = anchor != null;
  const top = anchor?.top;
  const bottom = anchor?.bottom;
  useEffect(() => {
    if (!focused || !live || (top === undefined && bottom === undefined && !sheet)) return;
    register(key, { top, bottom, sheet });
    return () => register(key, null);
  }, [register, key, focused, live, top, bottom, sheet]);
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
