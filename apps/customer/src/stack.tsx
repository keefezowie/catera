import { useMemo } from "react";
import { router, type NativeStackNavigationOptions } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { HeaderIconButton } from "@catera/mobile-ui";
import { goToTab } from "./nav";

// The stack options, `linkTitle` and `contentTitled` are shared with Dapur in `@catera/mobile-ui` (nativeHeader.ts).

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
