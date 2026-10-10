import { useMemo } from "react";
import { router, type NativeStackNavigationOptions } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { HeaderIconButton, nativeHeaderOptions, useColors } from "@catera/mobile-ui";
import { goToTab } from "./nav";

/**
 * The platform's own header for every pushed screen, in the root stack and in each tab's stack (iOS large title with
 * the system back button, Android small top app bar with the Material back arrow), on the theme canvas.
 */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const { demo } = useMobile();
  const palette = useColors();
  return useMemo<NativeStackNavigationOptions>(
    () => ({ ...nativeHeaderOptions({ palette, demo }), contentStyle: { backgroundColor: palette.canvas } }),
    [palette, demo],
  );
}

/** A `title` a link carried, so the header is final on the first frame. */
export function linkTitle(params: object | undefined): string | undefined {
  const title = (params as { title?: unknown } | undefined)?.title;
  return typeof title === "string" && title ? title : undefined;
}

/**
 * The options of a screen whose name is a `Screen nativeTitle`: iOS shows `title` as the large title; on Android the
 * name is the first content line, so the bar starts empty and takes it on scroll.
 */
export function contentTitled(title: string, os: string | undefined = process.env.EXPO_OS): NativeStackNavigationOptions {
  return os === "ios" ? { title } : { title, headerTitle: "" };
}

/** Leaves a flow above the tabs: back to what opened it, or Beranda when it was opened cold. */
const closeFlow = () => (router.canGoBack() ? router.back() : goToTab("index"));

/**
 * The flows that cover the tab bar (sign-in, sign-up, recovery, Beli, Perpanjang, Bayar, a claim link) are modal, as
 * both platforms only let a modal task cover the tab bar: Close at the leading edge, labelled "Tutup", in place of
 * back (Material's full-screen dialog has the same close). Close is a back, so a screen that guards its exit (Bayar
 * once paid) still decides where it goes.
 */
export function useFlowOptions() {
  const { t } = useMobile();
  return useMemo(
    () =>
      (presentation: "modal" | "fullScreenModal"): NativeStackNavigationOptions => ({
        presentation,
        headerBackVisible: false,
        headerLeft: () => <HeaderIconButton icon="close" slot="leading" label={t("Tutup", "Close")} onPress={closeFlow} />,
      }),
    [t],
  );
}
