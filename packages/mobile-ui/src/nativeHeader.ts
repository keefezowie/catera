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

/** The longest name a link may put in the bar, in characters, "…" included. */
export const LINK_TITLE_MAX = 60;

/**
 * The `title` a link carried (`?title=`), so a screen named by its record has its final header on the first frame.
 * A link without one (a cold link, a notification) gives `undefined`, and the screen falls back to its generic name.
 * The name is the caller's word, not the record's, so it is capped at `LINK_TITLE_MAX` characters: a longer one is cut
 * at the last space past the halfway mark (else mid-word) and ends in "…". Screens show it only while loading; on an
 * error or a missing record they fall back to the generic name, and an OS link loses it (`withoutLinkTitle`).
 */
export function linkTitle(params: object | undefined): string | undefined {
  const raw = (params as { title?: unknown } | undefined)?.title;
  if (typeof raw !== "string") return undefined;
  const title = raw.trim().replace(/\s+/g, " ");
  if (!title) return undefined;
  // Counted in code points, so an emoji is never split in half.
  const chars = Array.from(title);
  if (chars.length <= LINK_TITLE_MAX) return title;
  const kept = chars.slice(0, LINK_TITLE_MAX - 1).join("");
  const space = kept.lastIndexOf(" ");
  return `${(space >= LINK_TITLE_MAX / 2 ? kept.slice(0, space) : kept).trimEnd()}…`;
}

/** A query key as the router reads it: `+` is a space and percent escapes are decoded. */
function queryKey(pair: string): string {
  const key = pair.split("=")[0].replace(/\+/g, " ");
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

/**
 * An OS link (a deep link, a link opened from another app) without its `title` param. Only links the app builds itself
 * may name a screen before its record loads; anyone can craft an OS link, so it opens with the generic name until the
 * record says otherwise. Every other param, the path and the hash are kept as they were.
 */
export function withoutLinkTitle(link: string): string {
  const hashAt = link.indexOf("#");
  const head = hashAt === -1 ? link : link.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : link.slice(hashAt);
  const queryAt = head.indexOf("?");
  if (queryAt === -1) return link;
  const pairs = head.slice(queryAt + 1).split("&");
  const kept = pairs.filter((pair) => pair && queryKey(pair) !== "title");
  if (kept.length === pairs.length) return link;
  return `${head.slice(0, queryAt)}${kept.length ? `?${kept.join("&")}` : ""}${hash}`;
}

/**
 * The options of a screen whose name is a `Screen nativeTitle`: iOS shows `title` as the large title; on Android the
 * name is the first content line, so the bar starts empty and takes it on scroll. `os` defaults to the running platform.
 */
export function contentTitled(title: string, os: string | undefined = process.env.EXPO_OS): NativeStackNavigationOptions {
  return os === "ios" ? { title } : { title, headerTitle: "" };
}
