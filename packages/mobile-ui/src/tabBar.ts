import { useWindowDimensions, type ColorValue } from "react-native";
import type { NativeTabsHostNativeProps, NativeTabsLabelStyle } from "expo-router/native-tabs";
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

/** The largest text scale an Android tab label grows to: past it, four labels in a 360-412dp bar cut to "Beran…". */
export const TAB_LABEL_MAX_SCALE = 1.3;

/**
 * Tab labels in Plus Jakarta Sans SemiBold at the platform's own size: 10 on iOS, 12 on Android (Material 3 label
 * medium). The native bar speaks its labels itself, so nothing here sets a spoken label. iOS keeps its own text-size
 * handling (the bar's large content viewer). Android scales the label with the system font size, and a quarter-width
 * column cannot hold "Beranda" or "Pelanggan" at the largest sizes, so above `TAB_LABEL_MAX_SCALE` the size is set
 * back to land where 1.3 would. `os` defaults to the running platform; `fontScale` is the system font scale.
 */
export function tabLabelStyle(os: string | undefined = process.env.EXPO_OS, fontScale = 1): NativeTabsLabelStyle {
  if (os === "ios") return { fontFamily: fonts.semibold, fontSize: 10 };
  return { fontFamily: fonts.semibold, fontSize: fontScale > TAB_LABEL_MAX_SCALE ? (12 * TAB_LABEL_MAX_SCALE) / fontScale : 12 };
}

/** `tabLabelStyle` for the running platform and the system font scale right now. */
export function useTabLabelStyle(): NativeTabsLabelStyle {
  return tabLabelStyle(process.env.EXPO_OS, useWindowDimensions().fontScale);
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
