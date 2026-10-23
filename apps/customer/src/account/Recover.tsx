import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { AuthHeading, AuthScreen, Button, Field, FormError } from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { authClient, authError, REDIRECT_TO, savePending, validEmail } from "./emailAuth";
import { useAction } from "./useAction";
import { CheckEmail } from "./CheckEmail";

/** Lupa kata sandi: a recovery link by email, opened on this phone to choose a new password. */
export function Recover() {
  const { runtime, t } = useMobile();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = nativeReturnPath(typeof params.next === "string" ? params.next : undefined);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const action = useAction();

  const send = () =>
    action.run(async () => {
      const again = sent;
      if (again) setResent(false);
      await savePending(runtime, "recovery", next);
      const { error } = await authClient(runtime).auth.resetPasswordForEmail(email.trim(), { redirectTo: REDIRECT_TO });
      // Unknown addresses get the same answer, so the form does not reveal who is registered.
      if (error?.code !== "user_not_found") authError(error);
      setSent(true);
      if (again) setResent(true);
    });

  const failed = action.error ? <FormError message={action.error} failureKey={action.failures} testID="identity-error" /> : null;
  const back = (
    <Button
      variant="text"
      label={t("Kembali ke Masuk", "Back to sign in")}
      style={{ alignSelf: "flex-start" }}
      onPress={() => router.replace({ pathname: "/login", params: { next } } as never)}
    />
  );

  return (
    <AuthScreen revealKey={action.failures}>
      {sent ? (
        <>
          <CheckEmail
            email={email.trim()}
            intro={t("Kalau email ini terdaftar, tautan pemulihan sudah kami kirim ke", "If this email has an account, we've sent a recovery link to")}
            resent={resent}
            resendBusy={action.busy}
            error={failed}
            onResend={() => void send()}
            onChangeEmail={() => {
              setResent(false);
              setSent(false);
            }}
          />
          {back}
        </>
      ) : (
        <>
          <AuthHeading
            title={t("Pemulihan akun", "Account recovery")}
            subtitle={t(
              "Kami kirim tautan ke emailmu. Buka tautannya di HP ini untuk membuat kata sandi baru.",
              "We'll email you a link. Open it on this phone to set a new password.",
            )}
          />
          <View style={{ gap: 14 }}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={254}
              invalid={!!action.error}
            />
            {failed}
            <Button
              label={t("Kirim tautan pemulihan", "Send recovery link")}
              busy={action.busy}
              disabled={!validEmail(email)}
              onPress={() => void send()}
            />
            {back}
          </View>
        </>
      )}
    </AuthScreen>
  );
}
