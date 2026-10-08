import { useState } from "react";
import { Share } from "react-native";
import { errorLabel } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Screen, Text } from "@catera/mobile-ui";

/** Tim: invite a helper who sees Hari ini and Menu, never money or customers. */
export function TimScreen() {
  const { actor, t, locale, command } = useMobile();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function invite() {
    setBusy(true);
    setError("");
    try {
      const r = await command<{ code: string }>("staff.invite", { catererId: actor?.catererId });
      setCode(r.code);
      await Share.share({
        message: t(
          `Halo! Pasang aplikasi Catera Dapur, masuk dengan nomor WhatsApp Anda, lalu masukkan kode undangan ini: ${r.code}`,
          `Hi! Install the Catera Dapur app, sign in with your WhatsApp number, then enter this invite code: ${r.code}`,
        ),
      });
    } catch (e) {
      setError(errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card tone="sage">
        <Text variant="heading">{t("Pembantu dapur", "Kitchen helper")}</Text>
        <Text>
          {t(
            "Pembantu bisa melihat daftar masak, rute antar dan menu. Uang dan data pelanggan tetap hanya untuk Anda.",
            "Helpers see the cooking list, delivery route and menu. Money and customer details stay with you.",
          )}
        </Text>
      </Card>
      <Button label={t("Undang pembantu", "Invite a helper")} disabled={busy} onPress={() => void invite()} />
      {code ? (
        <Card>
          <Text variant="caption">{t("Kode undangan terakhir", "Latest invite code")}</Text>
          <Text variant="heading">{code}</Text>
          <Text variant="caption">{t("Satu kode untuk satu orang.", "One code per person.")}</Text>
        </Card>
      ) : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
    </Screen>
  );
}
