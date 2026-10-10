import { useMemo } from "react";
import { router, type NativeStackNavigationOptions } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { HeaderIconButton, nativeHeaderOptions, useColors } from "@catera/mobile-ui";
import { goToTab } from "./nav";

/**
 * The platform's own header for every pushed screen, in the root stack and in each tab's stack (iOS large title with
 * the system back button, Android small top app bar with the Material back arrow), on the theme canvas, as in the
 * customer app.
 */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const { demo } = useMobile();
  const palette = useColors();
  return useMemo<NativeStackNavigationOptions>(
    () => ({ ...nativeHeaderOptions({ palette, demo }), contentStyle: { backgroundColor: palette.canvas } }),
    [palette, demo],
  );
}

/**
 * The options of a screen named by its record (a customer, a package, a report's customer) through `Screen
 * nativeTitle`: iOS shows `title` as the large title until the record arrives; on Android the name is the first
 * content line, so the bar starts empty and takes it on scroll.
 */
export function contentTitled(title: string, os: string | undefined = process.env.EXPO_OS): NativeStackNavigationOptions {
  return os === "ios" ? { title } : { title, headerTitle: "" };
}

/** Leaves a modal above the tabs: back to what opened it, or Hari ini when a link opened it cold. */
const closeModal = () => (router.canGoBack() ? router.back() : goToTab("index"));

/**
 * Aktifkan and Impor cover the tab bar, which both platforms reserve for a modal task: Close at the leading edge,
 * labelled "Tutup", in place of back (Material's full-screen dialog has the same close).
 */
export function useModalOptions(): NativeStackNavigationOptions {
  const { t } = useMobile();
  return useMemo<NativeStackNavigationOptions>(
    () => ({
      presentation: "modal",
      headerBackVisible: false,
      headerLeft: () => <HeaderIconButton icon="close" label={t("Tutup", "Close")} onPress={closeModal} />,
    }),
    [t],
  );
}
