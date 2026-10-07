import { useState, type ReactNode } from "react";
import { Linking, View } from "react-native";
import { errorLabel } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, Field, Screen, Text } from "@catera/mobile-ui";
import { tabsForRole } from "./roles";

/** Customer accounts belong in the Catera app, unless they hold a helper invite code. */
export function RoleGate({ children }: { children: ReactNode }) {
  const { actor, t, locale, logout, command, refresh } = useMobile();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    setBusy(true);
    setError("");
    try {
      await command("invite.accept", { code: code.trim() });
      await refresh();
    } catch (e) {
      const c = (e as { code?: string }).code || (e as Error).message;
      setError(
        c === "NOT_FOUND"
          ? t("Kode tidak ditemukan atau sudah dipakai.", "Code not found or already used.")
          : errorLabel(c, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  if (actor && !tabsForRole(actor.role).length)
    return (
      <Screen>
        <View style={{ gap: 12, paddingTop: 48 }}>
          <Text variant="title">{t("Buka aplikasi Catera", "Open the Catera app")}</Text>
          <Text>
            {t(
              "Akun ini adalah akun pelanggan. Catera Dapur hanya untuk katerer dan pembantunya.",
              "This is a customer account. Catera Dapur is for caterers and their helpers.",
            )}
          </Text>
          <Button
            label={t("Buka Catera", "Open Catera")}
            onPress={() => void Linking.openURL("catera://")}
          />
          <Card tone="sage">
            <Text variant="heading">{t("Pembantu dapur?", "Kitchen helper?")}</Text>
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
              disabled={busy || !code.trim()}
              onPress={() => void join()}
            />
          </Card>
          <Button variant="text" label={t("Keluar", "Sign out")} onPress={() => void logout()} />
        </View>
      </Screen>
    );
  return <>{children}</>;
}
