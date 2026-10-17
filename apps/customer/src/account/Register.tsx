import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { Button, Field, FormError, Screen, Text } from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { authClient, authError, REDIRECT_TO, savePending, validEmail } from "./emailAuth";
import { useAction } from "./useAction";

/** Daftar dengan email: name, email and password, then a verification link opened on this phone. */
export function Register() {
  const { runtime, t } = useMobile();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = nativeReturnPath(typeof params.next === "string" ? params.next : undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const action = useAction();

  const signUp = () =>
    action.run(async () => {
      await savePending(runtime, "signup", next);
      const client = authClient(runtime);
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() }, emailRedirectTo: REDIRECT_TO },
      });
      // Email confirmation must be on: a session here means the project skips verification.
      if (data.session) {
        await client.auth.signOut({ scope: "local" });
        throw new Error("NOT_CONFIGURED");
      }
      // An existing address gets the same answer, so the form does not reveal who is registered.
      if (!["user_already_exists", "email_exists"].includes(error?.code || "")) authError(error);
      setPassword("");
      setSent(true);
    });

  const resend = () =>
    action.run(async () => {
      setResent(false);
      await savePending(runtime, "signup", next);
      const { error } = await authClient(runtime).auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: REDIRECT_TO },
      });
      if (!["user_not_found", "email_exists", "email_not_confirmed"].includes(error?.code || "")) authError(error);
      setResent(true);
    });

  return (
    <Screen>
      {sent ? (
        <View style={{ gap: 12, paddingTop: 8 }}>
          <Text variant="title">{t("Cek emailmu", "Check your email")}</Text>
          <Text>
            {t(
              "Kalau email ini bisa didaftarkan, kami sudah mengirim tautan verifikasi. Buka tautannya di HP ini untuk kembali ke Catera. Cek juga folder spam.",
              "If this email can be registered, we've sent a verification link. Open it on this phone to come back to Catera. Check your spam folder too.",
            )}
          </Text>
          {resent ? (
            <Text variant="caption">{t("Permintaan sudah dikirim. Cek emailmu.", "Request sent. Check your email.")}</Text>
          ) : null}
          <Button
            variant="secondary"
            label={t("Kirim ulang verifikasi", "Resend verification")}
            busy={action.busy}
            onPress={() => void resend()}
          />
          <Button variant="text" label={t("Ubah email", "Change email")} onPress={() => setSent(false)} />
        </View>
      ) : (
        <View style={{ gap: 14, paddingTop: 8 }}>
          <Text>{t("Kami kirim tautan verifikasi ke emailmu.", "We'll send a verification link to your email.")}</Text>
          <Field label={t("Nama", "Name")} value={name} onChangeText={setName} autoComplete="name" maxLength={100} />
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
          <Field
            label={t("Kata sandi", "Password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={256}
            hint={t(
              "Minimal 8 karakter. Verifikasi email sebelum masuk.",
              "At least 8 characters. Verify your email before signing in.",
            )}
          />
          <Button
            label={t("Daftar & verifikasi email", "Sign up & verify email")}
            busy={action.busy}
            disabled={!name.trim() || !validEmail(email) || password.length < 8}
            onPress={() => void signUp()}
          />
        </View>
      )}
      {action.error ? <FormError message={action.error} failureKey={action.failures} testID="identity-error" /> : null}
      <Button
        variant="text"
        label={t("Sudah punya akun? Masuk", "Already registered? Sign in")}
        onPress={() => router.replace({ pathname: "/login", params: { next } } as never)}
      />
    </Screen>
  );
}
