import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { HeaderIconButton, Pengaturan as SharedPengaturan, SettingsRow, SettingsSection, useMoodColors } from "@catera/mobile-ui";

/**
 * The gear at the end of a tab root's header row: Usaha's for an owner, Menu's for a helper (staff), who has no Usaha.
 * It reads the mood header's text colour.
 */
export function SettingsGear() {
  const { t } = useMobile();
  const mood = useMoodColors();
  return (
    <HeaderIconButton
      icon="settings"
      label={t("Pengaturan", "Settings")}
      tint={mood.headerText}
      onPress={() => router.push("/pengaturan" as never)}
    />
  );
}

/** Dapur's Pengaturan, the same for an owner and a helper: the shared screen with this app's notification line. */
export function Pengaturan() {
  const { t } = useMobile();
  return (
    <SharedPengaturan
      voice="kamu"
      supporting={t("Pesanan baru, laporan, pembayaran", "New orders, reports, payments")}
      channelName="Catera Dapur"
      // The root layout answers a signed-out session with Masuk.
      onSignedOut={() => undefined}
      extraRows={
        <SettingsSection>
          <SettingsRow label={t("Data akun", "Account data")} onPress={() => router.push("/pengaturan/data-akun" as never)} />
        </SettingsSection>
      }
    />
  );
}
