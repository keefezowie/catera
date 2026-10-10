import { useMemo } from "react";
import type { NativeStackNavigationOptions } from "expo-router";
import type { NativePalette } from "@catera/design-tokens";
import { useColors } from "./theme";
import { fonts } from "./type";

/**
 * What `nativeHeaderOptions` returns. `headerTopInsetEnabled` states the Android inset rule, but react-native-screens
 * 4.26 ignores `topInsetEnabled` on Android (edge-to-edge) and pads the toolbar by the window's status-bar inset
 * wherever the bar sits, so under the demo strip it paid the inset twice on the emulator. The rule therefore travels in
 * `unstable_nativeProps.headerConfig.disableTopInsetApplication`, which turns that padding off.
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
    unstable_nativeProps: { headerConfig: { disableTopInsetApplication: demo } },
  };
}

/**
 * Every stack's screen options in both apps, the root stack and each tab's stack: the native header above, plus the
 * theme canvas behind the screens while they slide. `demo` is whether the demo strip is shown (`useMobile().demo`).
 */
export function useStackScreenOptions(demo: boolean): NativeStackNavigationOptions {
  const palette = useColors();
  return useMemo<NativeStackNavigationOptions>(
    () => ({ ...nativeHeaderOptions({ palette, demo }), contentStyle: { backgroundColor: palette.canvas } }),
    [palette, demo],
  );
}

/**
 * The `title` a link carried (`?title=`), so a screen named by its record has its final header on the first frame.
 * A link without one (a cold link, a notification) gives `undefined`, and the screen falls back to its generic name.
 */
export function linkTitle(params: object | undefined): string | undefined {
  const title = (params as { title?: unknown } | undefined)?.title;
  return typeof title === "string" && title ? title : undefined;
}

/**
 * The options of a screen whose name is a `Screen nativeTitle`: iOS shows `title` as the large title; on Android the
 * name is the first content line, so the bar starts empty and takes it on scroll. `os` defaults to the running platform.
 */
export function contentTitled(title: string, os: string | undefined = process.env.EXPO_OS): NativeStackNavigationOptions {
  return os === "ios" ? { title } : { title, headerTitle: "" };
}
