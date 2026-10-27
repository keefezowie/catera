import { useEffect, useState, type ReactNode } from "react";
import { Linking, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StateArt } from "../brand/StateArt";
import { Button, Text } from "../components";
import { themedStyles, useColors } from "../theme";
import { fontFor } from "../type";
import { useT } from "../useT";
import { ResendButton, useResendTimer } from "./CodeInput";

/** How long "Terkirim" shows after a resend before the countdown takes over. */
export const SENT_SHOWN_MS = 3000;

/** Opens the phone's mail app: the Android app chooser (or `mailto:`), `message://` on iOS. A phone with no mail app stays put. */
export async function openMailApp(os = process.env.EXPO_OS): Promise<void> {
  try {
    if (os === "android") {
      try {
        // Loaded here, so a screen that never opens the mail app (or a test) does not need the native module.
        const IntentLauncher = require("expo-intent-launcher") as typeof import("expo-intent-launcher");
        await IntentLauncher.startActivityAsync("android.intent.action.MAIN", {
          category: "android.intent.category.APP_EMAIL",
          flags: 268435456,
        });
      } catch {
        await Linking.openURL("mailto:");
      }
    } else if (os === "ios") {
      await Linking.openURL("message://");
    } else {
      await Linking.openURL("mailto:");
    }
  } catch {
    // Best effort.
  }
}

/**
 * "Cek emailmu", shared by Daftar and Lupa kata sandi once the link is sent: the art, the title, the address that was
 * typed in bold (so a typo shows) with Ubah email right under it, Buka aplikasi email, and a resend that waits 60
 * seconds between sends. After a resend the button says "Terkirim" for 3 seconds. `intro` keeps each page's own
 * wording, which never says whether the address has an account. `art` defaults to the reading mascot; `null` shows none.
 */
export function CheckEmail({
  email,
  intro,
  resent,
  resendBusy,
  error,
  art,
  os = process.env.EXPO_OS,
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
  /** Undefined draws the reading mascot; `null` draws no art (Dapur). */
  art?: ReactNode;
  /** The platform; defaults to the running one (a test passes it, because `process.env.EXPO_OS` is compiled in). */
  os?: string;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const timer = useResendTimer(60, true);
  const { restart } = timer;
  const [justSent, setJustSent] = useState(false);
  // The wait starts again only once a resend went through; a failed one leaves Kirim ulang ready.
  useEffect(() => {
    if (!resent) return;
    restart();
    setJustSent(true);
    const timeout = setTimeout(() => setJustSent(false), SENT_SHOWN_MS);
    return () => clearTimeout(timeout);
  }, [resent, restart]);
  return (
    <View testID="check-email" style={{ gap: 14 }}>
      <View style={{ gap: 8, paddingTop: 8 }}>
        {art === undefined ? <StateArt pose="membaca" style={{ alignSelf: "flex-start" }} /> : art}
        <Text variant="display" accessibilityRole="header">
          {t("Cek emailmu", "Check your email")}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        <Text>
          {intro} <Text style={{ fontFamily: fontFor("700"), color: c.charcoal }}>{email}</Text>.
        </Text>
        <Button variant="text" label={t("Ubah email", "Change email")} style={{ alignSelf: "flex-start" }} onPress={onChangeEmail} />
      </View>
      <Text style={{ color: c.muted }}>
        {t(
          "Buka tautannya di HP ini. Tidak ada? Cek folder spam atau promosi.",
          "Open it on this phone. Nothing there? Check spam or promotions.",
        )}
      </Text>
      {resent ? (
        <Text variant="caption" accessibilityLiveRegion="polite">
          {t("Terkirim lagi. Cek emailmu.", "Sent again. Check your email.")}
        </Text>
      ) : null}
      {error}
      <Button label={t("Buka aplikasi email", "Open email app")} onPress={() => void openMailApp(os)} />
      {justSent ? (
        <View testID="resend-sent" style={styles.sent}>
          <Ionicons name="checkmark" size={20} color={c.forest} accessible={false} importantForAccessibility="no" />
          {/* forest: accent, the check and word of a confirmation */}
          <Text style={{ color: c.forest, fontFamily: fontFor("700") }}>{t("Terkirim", "Sent")}</Text>
        </View>
      ) : (
        <ResendButton
          left={timer.left}
          ready={t("Kirim ulang tautan", "Resend link")}
          waiting={(time) => t(`Kirim ulang dalam ${time}`, `Resend in ${time}`)}
          busy={resendBusy}
          onPress={onResend}
        />
      )}
    </View>
  );
}

const useStyles = themedStyles(() => ({
  sent: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48, alignSelf: "flex-start" },
}));
