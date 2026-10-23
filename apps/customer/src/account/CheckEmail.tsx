import { useEffect, type ReactNode } from "react";
import { Linking, View } from "react-native";
import { useMobile } from "@catera/mobile-core";
import { Button, fontFor, StateArt, Text, useColors } from "@catera/mobile-ui";
import { ResendButton, useResendTimer } from "./CodeInput";

/**
 * "Cek emailmu", shared by Daftar and Lupa kata sandi once the link is sent: the reading mascot, the title, the address
 * that was typed in bold (so a typo shows), Buka aplikasi email, and a resend that waits 60 seconds between sends.
 * `intro` keeps each page's own wording, which never says whether the address has an account.
 */
export function CheckEmail({
  email,
  intro,
  resent,
  resendBusy,
  error,
  onResend,
  onChangeEmail,
}: {
  email: string;
  /** The sentence before the address, e.g. "Kalau email ini terdaftar, tautan pemulihan sudah kami kirim ke". */
  intro: string;
  /** A resend went through, so the page says so once. */
  resent: boolean;
  resendBusy: boolean;
  error?: ReactNode;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  const { t } = useMobile();
  const c = useColors();
  const timer = useResendTimer(60, true);
  const { restart } = timer;
  // The wait starts again only once a resend went through; a failed one leaves Kirim ulang ready.
  useEffect(() => {
    if (resent) restart();
  }, [resent, restart]);
  return (
    <View testID="check-email" style={{ gap: 14 }}>
      <View style={{ gap: 8, paddingTop: 8 }}>
        <StateArt pose="membaca" style={{ alignSelf: "flex-start" }} />
        <Text variant="display" accessibilityRole="header">
          {t("Cek emailmu", "Check your email")}
        </Text>
      </View>
      <Text>
        {intro} <Text style={{ fontFamily: fontFor("700"), color: c.charcoal }}>{email}</Text>.
      </Text>
      <Text style={{ color: c.muted }}>{t("Buka tautannya di HP ini. Cek juga folder spam.", "Open it on this phone. Check your spam folder too.")}</Text>
      {resent ? <Text variant="caption">{t("Terkirim lagi. Cek emailmu.", "Sent again. Check your email.")}</Text> : null}
      {error}
      <Button
        label={t("Buka aplikasi email", "Open email app")}
        // Best effort: a phone with no mail app keeps the page as it is.
        onPress={() => void Linking.openURL("mailto:").catch(() => undefined)}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16 }}>
        <ResendButton
          left={timer.left}
          ready={t("Kirim ulang tautan", "Resend link")}
          waiting={(time) => t(`Kirim ulang dalam ${time}`, `Resend in ${time}`)}
          busy={resendBusy}
          onPress={onResend}
        />
        <Button variant="text" label={t("Ubah email", "Change email")} style={{ alignSelf: "flex-start" }} onPress={onChangeEmail} />
      </View>
    </View>
  );
}
