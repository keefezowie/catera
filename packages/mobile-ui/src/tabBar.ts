import type { ColorValue } from "react-native";
import type { NativeTabsLabelStyle } from "expo-router/unstable-native-tabs";
import type { NativePalette } from "@catera/design-tokens";
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
export function tabBarColors(palette: NativePalette): TabBarColors {
  return {
    backgroundColor: palette.tabBar,
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
