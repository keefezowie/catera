import { useEffect, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { Link } from "expo-router";
import { useMobile } from "@catera/mobile-core";
import { Button, Field, fontFor, FormError, MoodHeader, Screen, Segmented, Text, useColors, useMoodColors } from "@catera/mobile-ui";
import { goToTab } from "../nav";
import { e164Indonesia } from "../onboarding";
import { useFormRun } from "../useFormRun";

/** Sign in with the WhatsApp number (SMS code) or email; demo roles only in development. */
export function Masuk() {
  const { runtime, actor, t, locale, signedIn, refresh } = useMobile();
  const c = useColors();
  const mood = useMoodColors();
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
  const { busy, failure, run } = useFormRun(
    locale,
    t("Belum bisa masuk. Periksa nomor atau kodenya, lalu coba lagi.", "Could not sign in. Check the number or the code and try again."),
  );

  const finish = async (actor: Parameters<typeof signedIn>[0]) => {
    await signedIn(actor);
    goToTab("index");
  };

  return (
    <Screen
      header={
        <MoodHeader testID="masuk-header" title="Catera Dapur">
          <Text style={{ color: mood.headerMeta }}>
            {t("Masuk untuk melihat daftar masak dan antar hari ini.", "Sign in to see today's cooking and delivery lists.")}
          </Text>
        </MoodHeader>
      }
    >
      <Segmented
        value={method}
        onChange={setMethod}
        options={[
          { value: "phone", label: t("Nomor WhatsApp", "WhatsApp number") },
          { value: "email", label: "Email" },
        ]}
      />
      {method === "phone" ? (
        <View style={{ gap: 14 }}>
          <Field
            label={t("Nomor WhatsApp", "WhatsApp number")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!sent}
          />
          {sent ? (
            <Field
              label={t("Kode dari SMS", "Code from SMS")}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
          ) : null}
          <Button
            label={sent ? t("Masuk", "Sign in") : t("Kirim kode", "Send code")}
            busy={busy}
            disabled={(sent ? code.trim().length < 6 : phone.replace(/\D/g, "").length < 9)}
            onPress={() =>
              run(async () => {
                if (!sent) {
                  await runtime.sendPhoneOtp(e164Indonesia(phone));
                  setSent(true);
                } else
                  await finish(
                    await runtime.verifyPhoneOtp(e164Indonesia(phone), code.trim(), "", Crypto.randomUUID()),
                  );
              })
            }
          />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Field
            label={t("Kata sandi", "Password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Button
            label={t("Masuk", "Sign in")}
            busy={busy}
            disabled={!email || !password}
            onPress={() =>
              run(async () => finish(await runtime.signInPassword(email, password, Crypto.randomUUID())))
            }
          />
        </View>
      )}
      {failure ? <FormError message={failure.message} failureKey={failure.key} /> : null}
      {/* forest: action (the Daftar link) */}
      <Link href="/daftar" style={{ color: c.forest, fontFamily: fontFor("700"), paddingVertical: 12 }}>
        {t("Belum punya akun? Daftar dapur baru", "New here? Register your kitchen")}
      </Link>
      {__DEV__ ? (
        <View style={{ gap: 8 }}>
          <Text variant="caption">{t("Demo (data sintetis)", "Demo (synthetic data)")}</Text>
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
    </Screen>
  );
}
