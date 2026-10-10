import { useMemo } from "react";
import { router, type NativeStackNavigationOptions } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { HeaderIconButton } from "@catera/mobile-ui";
import { goToTab } from "./nav";

// The stack options, `linkTitle` and `contentTitled` are shared with the customer app in `@catera/mobile-ui`
// (nativeHeader.ts), so the two apps' headers cannot drift apart.

/** Leaves a modal above the tabs: back to what opened it, or Hari ini when a link opened it cold. */
const closeModal = () => (router.canGoBack() ? router.back() : goToTab("index"));

/**
 * Aktifkan and Impor cover the tab bar, which both platforms reserve for a modal task: Close at the leading edge,
 * labelled "Tutup", in place of back (Material's full-screen dialog has the same close). On Android the leading slot
 * puts its icon where the back arrow sits, with the full 48dp target.
 */
export function useModalOptions(): NativeStackNavigationOptions {
  const { t } = useMobile();
  return useMemo<NativeStackNavigationOptions>(
    () => ({
      presentation: "modal",
      headerBackVisible: false,
      headerLeft: () => <HeaderIconButton icon="close" slot="leading" label={t("Tutup", "Close")} onPress={closeModal} />,
    }),
    [t],
  );
}
