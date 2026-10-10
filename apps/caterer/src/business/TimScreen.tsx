import { useState } from "react";
import { Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorLabel } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, SheetHeader, Text, useColors, useToast } from "@catera/mobile-ui";

/**
 * Whether the share sheet's answer proves the invite went out. iOS answers `sharedAction` only for a real share and
 * `dismissedAction` for a dismissal; Android answers `sharedAction` for every share, including one backed out of
 * (react-native `Share.js`), so there it proves nothing and the sheet makes no claim.
 */
export const inviteShared = (action: string, os = process.env.EXPO_OS) => os === "ios" && action === Share.sharedAction;

/**
 * Tim, a sheet over Usaha sized to its content: invite a helper who sees Hari ini and Menu, never money or customers.
 * "Bagikan undangan" makes a new invite code (one code per person) and opens the share sheet with it; the code stays
 * on the sheet. "Undangan dibagikan" says it went out only where the platform can tell (`inviteShared`).
 */
export function TimScreen() {
  const { actor, t, locale, command } = useMobile();
  const c = useColors();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inset = process.env.EXPO_OS === "ios" ? 20 : 24;

  async function invite() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await command<{ code: string }>("staff.invite", { catererId: actor?.catererId });
      setCode(r.code);
      const shared = await Share.share({
        message: t(
          `Halo! Pasang aplikasi Catera Dapur, masuk dengan nomor WhatsApp kamu, lalu masukkan kode undangan ini: ${r.code}`,
          `Hi! Install the Catera Dapur app, sign in with your WhatsApp number, then enter this invite code: ${r.code}`,
        ),
      });
      if (inviteShared(shared.action))
        toast.show({ message: t("Undangan dibagikan", "Invite shared"), tone: "success" });
    } catch (e) {
      setError(errorLabel((e as { code?: string }).code || (e as Error).message, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View testID="tim-sheet" style={{ paddingBottom: insets.bottom + 16 }}>
      <SheetHeader title={t("Undang pembantu dapur", "Invite a kitchen helper")} closeLabel={t("Tutup", "Close")} />
      <View style={{ paddingHorizontal: inset, gap: 16 }}>
        <Text>
          {t(
            "Pembantu bisa melihat daftar masak, rute antar dan menu. Uang dan data pelanggan tetap hanya untuk kamu.",
            "Helpers see the cooking list, delivery route and menu. Money and customer details stay with you.",
          )}
        </Text>
        {code ? (
          <View style={{ gap: 4, padding: 16, borderRadius: 14, borderCurve: "continuous", backgroundColor: c.sage }}>
            <Text variant="caption">{t("Kode undangan", "Invite code")}</Text>
            <Text selectable variant="heading" style={{ fontVariant: ["tabular-nums"] }}>
              {code}
            </Text>
            <Text variant="caption">{t("Satu kode untuk satu orang.", "One code per person.")}</Text>
          </View>
        ) : null}
        {error ? <Text selectable style={{ color: c.danger }}>{error}</Text> : null}
        <Button label={t("Bagikan undangan", "Share invite")} disabled={busy} onPress={() => void invite()} />
      </View>
    </View>
  );
}
