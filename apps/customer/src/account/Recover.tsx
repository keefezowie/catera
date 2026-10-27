import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { authFields, AuthHeading, AuthScreen, Button, CheckEmail, Field, FormError, useFieldCheck } from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { authClient, authError, REDIRECT_TO, savePending, validEmail } from "./emailAuth";
import { useAuthRun } from "./useAuthRun";

/** Lupa kata sandi: a recovery link by email, opened on this phone to choose a new password. */
export function Recover() {
  const { runtime, t } = useMobile();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = nativeReturnPath(typeof params.next === "string" ? params.next : undefined);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const [edited, setEdited] = useState(true);
  const [fieldFailed, setFieldFailed] = useState(false);
  const action = useAuthRun();
  const checks = useFieldCheck({
    email: {
      value: email,
      check: (v) =>
        !v.trim()
          ? t("Isi emailmu dulu.", "Enter your email first.")
          : validEmail(v)
            ? ""
            : t("Format email belum benar. Contoh: nama@gmail.com", "That email doesn't look right. Example: name@gmail.com"),
    },
  });
  useEffect(() => {
    if (action.failures) setEdited(false);
  }, [action.failures]);

  const send = () =>
    action.run(async () => {
      const again = sent;
      if (again) setResent(false);
      await savePending(runtime, "recovery", next, email.trim());
      const { error } = await authClient(runtime).auth.resetPasswordForEmail(email.trim(), { redirectTo: REDIRECT_TO });
      // Unknown addresses get the same answer, so the form does not reveal who is registered.
      if (error?.code !== "user_not_found") authError(error);
      setSent(true);
      if (again) setResent(true);
    });

  const press = () => {
    let ok = false;
    checks.submit(() => {
      ok = true;
      void send();
    });
    setFieldFailed(!ok);
    if (!ok) setEdited(false);
  };

  const failed = action.message ? (
    <FormError
      message={action.message}
      failureKey={action.failures}
      testID="identity-error"
      retry={action.code === "OFFLINE" ? () => void send() : undefined}
    />
  ) : null;
  const back = (
    <Button
      variant="text"
      label={t("Kembali ke Masuk", "Back to sign in")}
      style={{ alignSelf: "flex-start" }}
      onPress={() => router.replace({ pathname: "/login", params: { next } } as never)}
    />
  );
  const pose = edited ? "melambai" : action.code === "OFFLINE" ? "mencari" : action.code || fieldFailed ? "bingung" : "melambai";

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
            pose={pose}
          />
          <View style={{ gap: 14 }}>
            <Field
              label="Email"
              {...authFields.email}
              {...checks.fieldProps("email")}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setEdited(true);
              }}
              editable={!action.busy}
              returnKeyType="go"
              onSubmitEditing={press}
            />
            {failed}
            <Button label={action.label(t("Kirim tautan pemulihan", "Send recovery link"))} busy={action.busy} disabled={action.wait > 0} onPress={press} />
            {back}
          </View>
        </>
      )}
    </AuthScreen>
  );
}
