import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import {
  authFields,
  AuthHeading,
  AuthScreen,
  AuthSwitch,
  Button,
  CheckEmail,
  Field,
  FormError,
  PasswordField,
  PasswordRule,
  useFieldCheck,
} from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { authClient, authError, REDIRECT_TO, savePending, validEmail } from "./emailAuth";
import { useAuthRun } from "./useAuthRun";

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
  // The mascot is confused after a failure and waves again on the next edit.
  const [edited, setEdited] = useState(true);
  const [fieldFailed, setFieldFailed] = useState(false);
  const action = useAuthRun();
  const checks = useFieldCheck({
    name: {
      value: name,
      check: (v) =>
        v.replace(/[^\p{L}]/gu, "").length >= 2 ? "" : t("Tulis namamu, minimal 2 huruf.", "Enter your name, at least 2 letters."),
    },
    email: {
      value: email,
      check: (v) =>
        !v.trim()
          ? t("Isi emailmu dulu.", "Enter your email first.")
          : validEmail(v)
            ? ""
            : t("Format email belum benar. Contoh: nama@gmail.com", "That email doesn't look right. Example: name@gmail.com"),
    },
    // Worded by the PasswordRule line under the field, so its message is not passed to the Field.
    password: { value: password, check: (v) => (v.length >= 8 ? "" : "short") },
  });
  const nameProps = checks.fieldProps("name");
  const emailProps = checks.fieldProps("email");
  const { error: _ruleOnly, ...passwordProps } = checks.fieldProps("password");

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setEdited(true);
  };
  useEffect(() => {
    if (action.failures) setEdited(false);
  }, [action.failures]);

  const signUp = () =>
    action.run(async () => {
      await savePending(runtime, "signup", next, email.trim());
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
      // A registered address would otherwise look like a sent link. Supabase hides it by returning a user with no
      // identities; tell the person plainly so they sign in or recover instead of waiting for an email.
      if (["user_already_exists", "email_exists"].includes(error?.code || "") || data.user?.identities?.length === 0)
        throw new Error("EMAIL_REGISTERED");
      authError(error);
      setPassword("");
      setSent(true);
    });

  const press = () => {
    let ok = false;
    checks.submit(() => {
      ok = true;
      void signUp();
    });
    setFieldFailed(!ok);
    if (!ok) setEdited(false);
  };

  const resend = () =>
    action.run(async () => {
      setResent(false);
      await savePending(runtime, "signup", next, email.trim());
      const { error } = await authClient(runtime).auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: REDIRECT_TO },
      });
      if (!["user_not_found", "email_exists", "email_not_confirmed"].includes(error?.code || "")) authError(error);
      setResent(true);
    });

  const registered = action.code === "EMAIL_REGISTERED";
  const failed = action.message ? (
    <FormError
      message={action.message}
      failureKey={action.failures}
      testID="identity-error"
      retry={action.code === "OFFLINE" ? () => void (sent ? resend() : signUp()) : undefined}
      action={
        registered
          ? {
              label: t("Masuk dengan email ini", "Sign in with this email"),
              onPress: () => router.replace({ pathname: "/login", params: { next, email: email.trim() } } as never),
            }
          : undefined
      }
    />
  ) : null;
  const pose = edited ? "melambai" : action.code === "OFFLINE" ? "mencari" : action.code || fieldFailed ? "bingung" : "melambai";

  return (
    <AuthScreen revealKey={action.failures}>
      {sent ? (
        <CheckEmail
          email={email.trim()}
          intro={t(
            "Kalau email ini bisa didaftarkan, tautan verifikasi sudah kami kirim ke",
            "If this email can be registered, we've sent a verification link to",
          )}
          resent={resent}
          resendBusy={action.busy}
          error={failed}
          onResend={() => void resend()}
          onChangeEmail={() => {
            setResent(false);
            setSent(false);
          }}
        />
      ) : (
        <>
          <AuthHeading
            title={t("Daftar", "Sign up")}
            subtitle={t("Kami kirim tautan verifikasi ke emailmu.", "We'll send a verification link to your email.")}
            pose={pose}
          />
          <View style={{ gap: 14 }}>
            <Field
              label={t("Nama", "Name")}
              {...authFields.name}
              {...nameProps}
              value={name}
              onChangeText={edit(setName)}
              editable={!action.busy}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailProps.inputRef.current?.focus()}
            />
            <Field
              label="Email"
              {...authFields.email}
              {...emailProps}
              value={email}
              onChangeText={edit(setEmail)}
              editable={!action.busy}
              invalid={action.code === "EMAIL_NOT_CONFIRMED" || registered}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordProps.inputRef.current?.focus()}
            />
            <View style={{ gap: 6 }}>
              <PasswordField
                label={t("Kata sandi", "Password")}
                showA11y={t("Tampilkan kata sandi", "Show password")}
                hideA11y={t("Sembunyikan kata sandi", "Hide password")}
                {...authFields.newPassword}
                {...passwordProps}
                value={password}
                onChangeText={edit(setPassword)}
                editable={!action.busy}
                invalid={action.code === "PASSWORD_REJECTED"}
                returnKeyType="go"
                onSubmitEditing={press}
              />
              <PasswordRule value={password} failed={!!checks.messages.password} />
            </View>
            {failed}
            <Button label={action.label(t("Daftar & verifikasi email", "Sign up & verify email"))} busy={action.busy} disabled={action.wait > 0} onPress={press} />
          </View>
        </>
      )}
      <AuthSwitch
        prompt={t("Sudah punya akun?", "Already registered?")}
        action={t("Masuk", "Sign in")}
        onPress={() => router.replace({ pathname: "/login", params: { next } } as never)}
      />
    </AuthScreen>
  );
}
