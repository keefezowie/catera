import { useEffect, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { AuthHeading, AuthScreen, AuthSwitch, Button, Field, FormError, MethodTabs, PasswordField, Text } from "@catera/mobile-ui";
import { goToTab } from "../nav";
import { e164Indonesia } from "../onboarding";
import { useFormRun } from "../useFormRun";

/** Sign in with the WhatsApp number (SMS code) or email; demo roles only in development. */
export function Masuk() {
  const { runtime, actor, t, locale, signedIn, refresh } = useMobile();
  // A session that comes back (signal returns, token refreshes) goes straight to the kitchen.
  useEffect(() => {
    if (actor) goToTab("index");
  }, [actor]);
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, failure, run, clear } = useFormRun(
    locale,
    t("Belum bisa masuk. Periksa nomor atau kodenya, lalu coba lagi.", "Could not sign in. Check the number or the code and try again."),
  );
  // A failure belongs to the method it came from.
  useEffect(clear, [method]);

  const finish = async (actor: Parameters<typeof signedIn>[0]) => {
    await signedIn(actor);
    goToTab("index");
  };

  const phoneStep = method === "phone";
  const failed = !!failure;

  return (
    <AuthScreen revealKey={failure?.key}>
      {/* Dapur has no mascot: its name sits where the customer's mark does, and Masuk is the screen's one heading. */}
      <AuthHeading
        brand="Catera Dapur"
        title={t("Masuk", "Sign in")}
        subtitle={
          phoneStep
            ? t("Kami kirim kode lewat SMS ke nomor WhatsApp kamu.", "We text a code to your WhatsApp number.")
            : t("Masuk dengan email dan kata sandi kamu.", "Sign in with your email and password.")
        }
      />
      <MethodTabs
        value={method}
        onChange={setMethod}
        options={[
          { value: "phone", label: t("Nomor HP", "Phone") },
          { value: "email", label: "Email" },
        ]}
      />
      {phoneStep ? (
        <View style={{ gap: 14 }}>
          <Field
            label={t("Nomor WhatsApp", "WhatsApp number")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!sent}
            invalid={failed && !sent}
          />
          {sent ? (
            <Field
              label={t("Kode dari SMS", "Code from SMS")}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              invalid={failed}
            />
          ) : null}
          {sent ? (
            <Button
              variant="text"
              label={t("Ganti nomor", "Change number")}
              style={{ alignSelf: "flex-start" }}
              onPress={() => {
                setSent(false);
                setCode("");
              }}
            />
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" invalid={failed} />
          <PasswordField
            label={t("Kata sandi", "Password")}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            invalid={failed}
            showWord={t("Tampilkan", "Show")}
            hideWord={t("Sembunyikan", "Hide")}
            showA11y={t("Tampilkan kata sandi", "Show password")}
            hideA11y={t("Sembunyikan kata sandi", "Hide password")}
          />
        </View>
      )}
      {failure ? <FormError message={failure.message} failureKey={failure.key} /> : null}
      {phoneStep ? (
        <Button
          label={sent ? t("Masuk", "Sign in") : t("Kirim kode", "Send code")}
          busy={busy}
          disabled={sent ? code.trim().length < 6 : phone.replace(/\D/g, "").length < 9}
          onPress={() =>
            run(async () => {
              if (!sent) {
                await runtime.sendPhoneOtp(e164Indonesia(phone));
                setSent(true);
              } else
                await finish(await runtime.verifyPhoneOtp(e164Indonesia(phone), code.trim(), "", Crypto.randomUUID()));
            })
          }
        />
      ) : (
        <Button
          label={t("Masuk", "Sign in")}
          busy={busy}
          disabled={!email || !password}
          onPress={() => run(async () => finish(await runtime.signInPassword(email, password, Crypto.randomUUID())))}
        />
      )}
      <AuthSwitch
        prompt={t("Belum punya akun?", "No account yet?")}
        action={t("Daftar", "Sign up")}
        onPress={() => router.push("/daftar" as never)}
      />
      {__DEV__ ? (
        <View style={{ gap: 8 }}>
          <Text variant="caption">{t("Demo (data contoh)", "Demo (sample data)")}</Text>
          {(["owner", "staff"] as const).map((role) => (
            <Button
              key={role}
              variant="secondary"
              disabled={busy}
              label={role === "owner" ? t("Masuk sebagai pemilik", "Sign in as owner") : t("Masuk sebagai staf dapur", "Sign in as kitchen staff")}
              onPress={() =>
                run(async () => {
                  await runtime.demoLogin(role);
                  await refresh();
                  goToTab("index");
                })
              }
            />
          ))}
        </View>
      ) : null}
    </AuthScreen>
  );
}
