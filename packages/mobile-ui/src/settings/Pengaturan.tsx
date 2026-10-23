import { useState, type ReactNode } from "react";
import { Linking } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useMobile, usePushSwitch } from "@catera/mobile-core";
import { Screen } from "../components";
import { useThemePreference } from "../theme";
import { useToast } from "../Toast";
import { SettingsRow, SettingsSection, SettingsSwitchRow } from "./SettingsRows";
import { themeChoiceLabels } from "./ThemeChoice";

/** One line, saying what did not go through (the notification switch is already back where it truly is). */
function useFailed(id: string, en: string) {
  const { t } = useMobile();
  const toast = useToast();
  return () => toast.show({ message: t(id, en), tone: "error" });
}

/**
 * Notifikasi di HP ini: the phone's permission and this account's registration, read whenever the screen or the
 * app comes back (`usePushSwitch`). A phone that blocks Catera shows off with the way to the phone's settings. A build
 * that cannot receive push (Expo Go) shows no section at all: a switch that can never move is a dead control.
 */
function NotificationSection({ supporting, channelName }: { supporting: string; channelName: string }) {
  const { t } = useMobile();
  const push = usePushSwitch(channelName);
  const failed = useFailed("Pengaturan notifikasi belum tersimpan. Coba lagi.", "Your notification setting didn't save. Try again.");
  const { state } = push;
  if (state === "unavailable") return null;
  return (
    <SettingsSection title={t("Notifikasi", "Notifications")}>
      <SettingsSwitchRow
        label={t("Notifikasi di HP ini", "Notifications on this phone")}
        supporting={supporting}
        value={state === "on"}
        loading={state === "loading"}
        loadingLabel={t("Memuat notifikasi", "Loading notifications")}
        notice={state === "denied" ? t("Izinkan notifikasi di Pengaturan HP", "Allow notifications in your phone's Settings") : undefined}
        action={
          state === "denied" ? { label: t("Buka Pengaturan", "Open Settings"), onPress: () => void Linking.openSettings() } : undefined
        }
        onValueChange={(next) => void (next ? push.turnOn() : push.turnOff()).catch(failed)}
      />
    </SettingsSection>
  );
}

/**
 * Pengaturan (spec 4), one screen for both apps: Notifikasi, then the app's language and theme, then what this build
 * is, then `extraRows` (Data akun), then Keluar. Signed out it keeps the language, the theme and Tentang; the
 * notification switch and Keluar belong to an account. Language and theme open their choice sheets
 * (`/pengaturan/bahasa`, `/pengaturan/tampilan`), which apply a choice at once. The apps differ only in the
 * notification line, the channel name and what `onSignedOut` does.
 */
export function Pengaturan({
  supporting,
  channelName,
  onSignedOut,
  extraRows,
  openWebPage = (url) => Linking.openURL(url),
}: {
  /** The voice of the app's strings; "kamu" in both apps. The choice sheets carry the voiced note. */
  voice: "kamu";
  /** The line under the notification switch: what this app notifies about. */
  supporting: string;
  /** The Android notification channel's name. */
  channelName: string;
  /** Runs once the session has ended; the app sends its navigation to where a signed-out person belongs. */
  onSignedOut(): void;
  /** Rows after Tentang and before Keluar. */
  extraRows?: ReactNode;
  /** How a web page opens; the customer app passes its in-app browser, the default is the phone's browser. */
  openWebPage?: (url: string) => Promise<unknown>;
}) {
  const { actor, ready, t, locale, logout, runtime } = useMobile();
  const { preference } = useThemePreference();
  const failed = useFailed("Belum bisa keluar. Coba lagi.", "Couldn't sign you out. Try again.");
  const pageFailed = useFailed("Halaman belum bisa dibuka. Coba lagi.", "Couldn't open the page. Try again.");
  const [leaving, setLeaving] = useState(false);
  const version = Constants.expoConfig?.version;
  const account = ready && actor ? actor : null;

  async function signOut() {
    if (leaving) return;
    setLeaving(true);
    try {
      // logout() first lets go of this phone's push token (bounded, best effort), then ends the session.
      await logout();
      onSignedOut();
    } catch {
      failed();
      setLeaving(false);
    }
  }

  return (
    <Screen nativeTitle={t("Pengaturan", "Settings")}>
      {account ? <NotificationSection key={account.id} supporting={supporting} channelName={channelName} /> : null}
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
        <SettingsRow
          label={t("Syarat dan privasi", "Terms and privacy")}
          onPress={() => void openWebPage(`${runtime.apiBase}/syarat-dan-privasi`).catch(pageFailed)}
        />
      </SettingsSection>
      {extraRows}
      {account ? (
        <SettingsSection>
          <SettingsRow label={t("Keluar", "Sign out")} tone="danger" busy={leaving} onPress={() => void signOut()} />
        </SettingsSection>
      ) : null}
    </Screen>
  );
}
