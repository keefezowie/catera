import { useState, type ReactNode } from "react";
import { Linking, View } from "react-native";
import { errorLabel } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, Field, MoodHeader, Screen, Text, useBusy } from "@catera/mobile-ui";
import { tabsForRole } from "./roles";

/** Customer accounts belong in the Catera app, unless they hold a helper invite code. */
export function RoleGate({ children }: { children: ReactNode }) {
  const { actor, t, locale, logout, command, refresh } = useMobile();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    if (leaving) return;
    setLeaving(true);
    try {
      // Signed out, the gate renders nothing of its own; a failure lets Keluar be tried again.
      await logout();
    } catch {
      setLeaving(false);
    }
  }

  const [busy, join] = useBusy(async () => {
    setError("");
    try {
      await command("invite.accept", { code: code.trim() });
      await refresh();
    } catch (e) {
      const c = (e as { code?: string }).code || (e as Error).message;
      setError(
        c === "NOT_FOUND"
          ? t("Kode tidak ditemukan atau sudah dipakai.", "Code not found or already used.")
          : errorLabel(c, locale) || t("Belum bisa bergabung. Coba lagi.", "Could not join. Try again."),
      );
    }
  });

  if (actor && !tabsForRole(actor.role).length)
    return (
      <Screen header={<MoodHeader testID="rolegate-header" title={t("Buka aplikasi Catera", "Open the Catera app")} />}>
        <View style={{ gap: 12 }}>
          <Text>
            {t(
              "Ini akun pelanggan. Catera Dapur khusus untuk katering dan staf dapurnya.",
              "This is a customer account. Catera Dapur is for caterers and their kitchen staff.",
            )}
          </Text>
          <Button
            label={t("Buka Catera", "Open Catera")}
            onPress={() => void Linking.openURL("catera://")}
          />
          <Card tone="sage">
            <Text variant="heading">{t("Staf dapur?", "Kitchen staff?")}</Text>
            <Field
              label={t("Kode undangan", "Invite code")}
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              error={error || undefined}
            />
            <Button
              variant="secondary"
              label={t("Gabung ke dapur", "Join the kitchen")}
              busy={busy}
              disabled={!code.trim()}
              onPress={() => void join()}
            />
          </Card>
          {/* Disabled while logout() lets go of this phone's push token (up to 3 s), so a second tap sends nothing. */}
          <Button variant="text" label={t("Keluar", "Sign out")} busy={leaving} onPress={() => void signOut()} />
        </View>
      </Screen>
    );
  return <>{children}</>;
}
