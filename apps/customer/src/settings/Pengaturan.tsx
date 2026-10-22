import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMobile } from "@catera/mobile-core";
import { Pengaturan as SharedPengaturan } from "@catera/mobile-ui";
import { DataAkunEntry } from "../account/DataAkun";
import { goToTab } from "../nav";

/** The customer app's Pengaturan: the shared screen with its notification line and its way back to sign-in. */
export function Pengaturan() {
  const { t } = useMobile();
  return (
    <SharedPengaturan
      voice="kamu"
      // Data akun: the name, HP number, email, password and the request to delete the account.
      extraRows={<DataAkunEntry />}
      // The terms page opens inside the app, the way the payment page does.
      openWebPage={(url) => WebBrowser.openBrowserAsync(url)}
      supporting={t("Makanan berangkat, menu besok, pembayaran", "Meals on the way, tomorrow's menu, payments")}
      channelName={t("Pengantaran & bantuan", "Deliveries & support")}
      // Every tab back at its root: Akun reopens on its sign-in prompt, not on this signed-out Pengaturan.
      onSignedOut={() => goToTab("index", { everyTab: true })}
    />
  );
}
