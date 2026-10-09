import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { Button, Field, Screen, Text, useColors } from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { authClient, authError, REDIRECT_TO, savePending, validEmail } from "./emailAuth";
import { useAction } from "./useAction";

/** Lupa kata sandi: a recovery link by email, opened on this phone to choose a new password. */
export function Recover() {
  const { runtime, t } = useMobile();
  const c = useColors();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = nativeReturnPath(typeof params.next === "string" ? params.next : undefined);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const action = useAction();

  const send = () =>
    action.run(async () => {
      await savePending(runtime, "recovery", next);
      const { error } = await authClient(runtime).auth.resetPasswordForEmail(email.trim(), { redirectTo: REDIRECT_TO });
      // Unknown addresses get the same answer, so the form does not reveal who is registered.
      if (error?.code !== "user_not_found") authError(error);
      setSent(true);
    });

  return (
    <Screen>
      <View style={{ gap: 14, paddingTop: 8 }}>
        <Text>
          {t(
            "Kami kirim tautan ke email Anda. Buka tautan itu di HP ini untuk membuat kata sandi baru.",
            "We will email a link. Open it on this phone to choose a new password.",
          )}
        </Text>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={254}
        />
        {sent ? (
          <Text>
            {t(
              "Jika akun itu terdaftar, email pemulihan telah dikirim. Periksa juga folder spam.",
              "If the account exists, a recovery email has been sent. Check your spam folder too.",
            )}
          </Text>
        ) : null}
        {action.error ? (
          <Text selectable style={{ color: c.danger }} testID="identity-error">
            {action.error}
          </Text>
        ) : null}
        <Button
          label={sent ? t("Kirim ulang tautan", "Resend link") : t("Kirim tautan pemulihan", "Send recovery link")}
          disabled={action.busy || !validEmail(email)}
          onPress={() => void send()}
        />
        <Button
          variant="text"
          label={t("Kembali ke Masuk", "Back to sign in")}
          onPress={() => router.replace({ pathname: "/login", params: { next } } as never)}
        />
      </View>
    </Screen>
  );
}
