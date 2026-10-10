import type { NativeStackNavigationOptions } from "expo-router";
import type { NativePalette } from "@catera/design-tokens";
import { fonts } from "./type";

/**
 * What `nativeHeaderOptions` returns. `headerTopInsetEnabled` states the Android inset rule; the stack computes its own
 * value from the safe-area inset and lays it over the options, so on Android the same rule also travels in
 * `unstable_nativeProps.headerConfig.topInsetEnabled`, which the stack applies last.
 */
export type NativeHeaderOptions = NativeStackNavigationOptions & { headerTopInsetEnabled?: boolean };

/**
 * The platform's own header for every pushed screen, in Plus Jakarta Sans at the platform's sizes.
 * - iOS: a large title (34, forest) that collapses into the inline title (17) on scroll, over the plain canvas, and
 *   the system back button with no label.
 * - Android: the small top app bar on the canvas with the Material back arrow and a 22 title. While the demo strip is
 *   shown it already pays the status-bar inset, so the bar adds none (`demo`).
 * Colours come from the theme palette only: pushed screens never wear the mood. `os` defaults to the running platform.
 */
export function nativeHeaderOptions({
  palette,
  demo,
  os = process.env.EXPO_OS,
}: {
  palette: NativePalette;
  demo: boolean;
  os?: string;
}): NativeHeaderOptions {
  if (os === "ios")
    return {
      headerLargeTitle: true,
      headerTransparent: true,
      headerShadowVisible: false,
      headerLargeTitleShadowVisible: false,
      headerBackButtonDisplayMode: "minimal",
      headerTintColor: palette.forest,
      headerLargeStyle: { backgroundColor: palette.canvas },
      headerStyle: { backgroundColor: palette.canvas },
      headerLargeTitleStyle: { fontFamily: fonts.bold, fontSize: 34, color: palette.forest },
      headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17, color: palette.charcoal },
    };
  return {
    headerShadowVisible: false,
    headerStyle: { backgroundColor: palette.canvas },
    headerTintColor: palette.charcoal,
    headerTitleStyle: { fontFamily: fonts.bold, fontSize: 22, color: palette.charcoal },
    headerTopInsetEnabled: !demo,
    unstable_nativeProps: { headerConfig: { topInsetEnabled: !demo } },
  };
}
