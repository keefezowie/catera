import type { ColorValue } from "react-native";
import type { NativeTabsHostNativeProps, NativeTabsLabelStyle } from "expo-router/unstable-native-tabs";
import type { NativePalette } from "@catera/design-tokens";
import { barTone } from "./theme";
import { useSheetOnTop } from "./sheets";
import { fonts } from "./type";

export type TabBarColors = {
  backgroundColor: ColorValue;
  indicatorColor: ColorValue;
  rippleColor: ColorValue;
  tintColor: ColorValue;
  iconColor: { default: ColorValue; selected: ColorValue };
  labelColor: { default: ColorValue; selected: ColorValue };
};

/**
 * The native tab bar's colours in both apps. They come from the theme palette only, so a Siang / Malam switch never
 * reaches the bar. Selected tabs are forest, the rest muted; on Android the selected icon sits on the `tabIndicator`
 * pill, and a press ripples in the same tint so the ripple previews the pill it leads to.
 */
export function tabBarColors(palette: NativePalette, os: string | undefined = process.env.EXPO_OS): TabBarColors {
  return {
    backgroundColor: barTone(palette, os),
    indicatorColor: palette.tabIndicator,
    rippleColor: palette.tabIndicator,
    tintColor: palette.forest,
    iconColor: { default: palette.muted, selected: palette.forest },
    labelColor: { default: palette.muted, selected: palette.forest },
  };
}

/**
 * Tab labels in Plus Jakarta Sans SemiBold at the platform's own size: 10 on iOS, 12 on Android (Material 3 label
 * medium). The native bar scales and speaks its labels itself, so nothing here caps text size or sets a spoken label.
 * `os` defaults to the running platform.
 */
export function tabLabelStyle(os: string | undefined = process.env.EXPO_OS): NativeTabsLabelStyle {
  return { fontFamily: fonts.semibold, fontSize: os === "ios" ? 10 : 12 };
}

/**
 * The tab host's accessibility while a sheet is on top or not (spec 4.1), for `NativeTabs`' `unstable_nativeProps`.
 * - iOS: the host leaves the tree (`accessibilityElementsHidden`) while a sheet is up. UIKit presents the sheet outside
 *   the host, so the sheet stays readable.
 * - Android: nothing. react-native-screens 4.26 draws a tab-stack bottom sheet inside the tab host, beside the bar
 *   (`TabsContainer`), and gives JS no handle on the bar alone, so hiding the host would hide the sheet as well. The bar
 *   comes after the sheet in reading order, so it cannot take the first focus.
 * The host passes props it does not know on to its native view (react-native-screens' `TabsHost.ios`), where the view
 * props apply; its types list only its own, hence the cast. `os` defaults to the running platform.
 */
export function tabBarNativeProps(sheetOnTop: boolean, os: string | undefined = process.env.EXPO_OS): NativeTabsHostNativeProps {
  return (os === "ios" ? { accessibilityElementsHidden: sheetOnTop } : {}) as NativeTabsHostNativeProps;
}

/** `tabBarNativeProps` for the sheet state right now. */
export function useTabBarNativeProps(os?: string) {
  return tabBarNativeProps(useSheetOnTop(), os);
}
