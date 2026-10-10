import { useState } from "react";
import { Linking } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useMobile, usePushSwitch } from "@catera/mobile-core";
import {
  HeaderIconButton,
  Screen,
  SettingsRow,
  SettingsSection,
  SettingsSwitchRow,
  themeChoiceLabels,
  useMoodColors,
  useThemePreference,
  useToast,
} from "@catera/mobile-ui";

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

/** One line for any change that did not go through; the switch is already back where it truly is. */
function useFailed() {
  const { t } = useMobile();
  const toast = useToast();
  return () => toast.show({ message: t("Belum berhasil. Coba lagi.", "That didn't work. Try again."), tone: "error" });
}

/**
 * Notifikasi di ponsel ini: new orders, reports and payments on this phone. It reads the phone's permission and this
 * account's registration whenever the screen or the app comes back (`usePushSwitch`), so it remembers being on, which
 * the old Usaha button forgot as soon as the screen closed.
 */
function NotificationSection() {
  const { t } = useMobile();
  const push = usePushSwitch("Catera Dapur");
  const failed = useFailed();
  const { state } = push;
  return (
    <SettingsSection title={t("Notifikasi", "Notifications")}>
      <SettingsSwitchRow
        label={t("Notifikasi di ponsel ini", "Notifications on this phone")}
        supporting={t("Pesanan baru, laporan, pembayaran", "New orders, reports, payments")}
        value={state === "on"}
        loading={state === "loading"}
        loadingLabel={t("Memuat notifikasi", "Loading notifications")}
        disabled={state === "unavailable"}
        notice={
          state === "denied"
            ? t("Izinkan notifikasi di Pengaturan ponsel", "Allow notifications in your phone's Settings")
            : state === "unavailable"
              ? t("Tidak tersedia di versi aplikasi ini", "Not available in this version of the app")
              : undefined
        }
        action={
          state === "denied" ? { label: t("Buka Pengaturan", "Open Settings"), onPress: () => void Linking.openSettings() } : undefined
        }
        onValueChange={(next) => void (next ? push.turnOn() : push.turnOff()).catch(failed)}
      />
    </SettingsSection>
  );
}

/**
 * Dapur's Pengaturan (spec 4), the same for an owner and a helper: Notifikasi, the app's language and theme, what this
 * build is, then Keluar. Language and theme open their choice sheets (`/pengaturan/bahasa`, `/pengaturan/tampilan`).
 */
export function Pengaturan() {
  const { actor, ready, t, locale, logout } = useMobile();
  const { preference } = useThemePreference();
  const failed = useFailed();
  const [leaving, setLeaving] = useState(false);
  const version = Constants.expoConfig?.version;
  const account = ready && actor ? actor : null;

  async function signOut() {
    if (leaving) return;
    setLeaving(true);
    try {
      // The root layout answers a signed-out session with Masuk.
      await logout();
    } catch {
      failed();
      setLeaving(false);
    }
  }

  return (
    <Screen nativeTitle={t("Pengaturan", "Settings")}>
      {account ? <NotificationSection key={account.id} /> : null}
      <SettingsSection title={t("Aplikasi", "App")}>
        <SettingsRow
          label={t("Bahasa", "Language")}
          value={locale === "id" ? "Indonesia" : "English"}
          onPress={() => router.push("/pengaturan/bahasa" as never)}
        />
        <SettingsRow
          label={t("Tampilan", "Appearance")}
          value={themeChoiceLabels(t)[preference]}
          onPress={() => router.push("/pengaturan/tampilan" as never)}
        />
      </SettingsSection>
      <SettingsSection title={t("Tentang", "About")}>
        {version ? <SettingsRow label={t("Versi aplikasi", "App version")} value={version} selectable /> : null}
        {/* TODO: open the web terms page once apps/web has one (there is none yet, 2026-10-11). This app has no
            expo-web-browser, so it will open in the phone's browser through Linking. */}
        <SettingsRow label={t("Syarat dan privasi", "Terms and privacy")} value={t("Segera hadir", "Coming soon")} />
      </SettingsSection>
      {account ? (
        <SettingsSection>
          <SettingsRow label={t("Keluar", "Sign out")} tone="danger" busy={leaving} onPress={() => void signOut()} />
        </SettingsSection>
      ) : null}
    </Screen>
  );
}
