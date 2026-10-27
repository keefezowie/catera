import type { ReactNode } from "react";
import { View } from "react-native";
import { AuthHeading, AuthScreen } from "../AuthLayout";
import { Button, Text } from "../components";
import { useColors } from "../theme";
import type { MascotPose } from "../brand/MascotArt";
import { useT } from "../useT";

/**
 * An email link that no longer works (spec 7). Nothing the person did was wrong, so no danger colour: the mascot is
 * bingung, one title, what happened, and a one-tap new link (or "Masukkan email" when this phone has no address
 * on file). `brand` swaps the mascot for a wordmark (Dapur). `error` is a FormError for a failed resend.
 */
export function ExpiredLink({
  email,
  busy,
  error,
  brand,
  pose = "bingung",
  onResend,
  onEnterEmail,
  onBack,
}: {
  email: string;
  busy?: boolean;
  error?: ReactNode;
  brand?: string;
  /** `mencari` when a resend failed offline. */
  pose?: MascotPose;
  onResend(): void;
  onEnterEmail(): void;
  onBack(): void;
}) {
  const t = useT();
  const c = useColors();
  return (
    <AuthScreen>
      <AuthHeading title={t("Tautannya sudah tidak berlaku", "This link no longer works")} brand={brand} pose={pose} />
      <View style={{ gap: 14 }}>
        <Text style={{ color: c.muted }}>
          {email
            ? t(
                `Tautan hanya berlaku 1 jam, sekali pakai, dan di HP yang memintanya. Kami bisa kirim yang baru ke ${email}.`,
                `Links last 1 hour, work once, and only on the phone that asked for them. We can send a new one to ${email}.`,
              )
            : t(
                "Tautan hanya berlaku 1 jam, sekali pakai, dan di HP yang memintanya.",
                "Links last 1 hour, work once, and only on the phone that asked for them.",
              )}
        </Text>
        {error}
        {email ? (
          <Button label={t("Kirim tautan baru", "Send a new link")} busy={busy} onPress={onResend} />
        ) : (
          <Button label={t("Masukkan email", "Enter email")} onPress={onEnterEmail} />
        )}
        <Button variant="text" label={t("Kembali ke Masuk", "Back to sign in")} style={{ alignSelf: "flex-start" }} onPress={onBack} />
      </View>
    </AuthScreen>
  );
}
