import { useEffect, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { Link, router } from "expo-router";
import { errorLabel } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Field, fontFor, Screen, Segmented, Text } from "@catera/mobile-ui";
import { e164Indonesia } from "../onboarding";

/** Sign in with the WhatsApp number (SMS code) or email; demo roles only in development. */
export function Masuk() {
  const { runtime, actor, t, locale, signedIn, refresh } = useMobile();
  // A session that comes back (signal returns, token refreshes) goes straight to the kitchen.
  useEffect(() => {
    if (actor) router.replace("/");
  }, [actor]);
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(step: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await step();
    } catch (e) {
      setError(
        errorLabel((e as Error).message, locale) ||
          t("Belum berhasil. Coba lagi.", "That didn't work. Try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  const finish = async (actor: Parameters<typeof signedIn>[0]) => {
    await signedIn(actor);
    router.replace("/");
  };

  return (
    <Screen>
      <View style={{ gap: 6, paddingTop: 24 }}>
        <Text variant="title">Catera Dapur</Text>
        <Text style={{ color: "#60675F" }}>
          {t("Masuk untuk melihat daftar masak dan antar hari ini.", "Sign in to see today's cooking and delivery lists.")}
        </Text>
      </View>
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
            disabled={busy || (sent ? code.trim().length < 6 : phone.replace(/\D/g, "").length < 9)}
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
            disabled={busy || !email || !password}
            onPress={() =>
              run(async () => finish(await runtime.signInPassword(email, password, Crypto.randomUUID())))
            }
          />
        </View>
      )}
      {error ? <Text style={{ color: "#A33024" }}>{error}</Text> : null}
      <Link href="/daftar" style={{ color: "#163D2E", fontFamily: fontFor("700"), paddingVertical: 12 }}>
        {t("Belum punya akun? Daftar dapur baru", "New here? Register your kitchen")}
      </Link>
      {__DEV__ ? (
        <View style={{ gap: 8 }}>
          <Text variant="caption">{t("Demo (data sintetis)", "Demo (synthetic data)")}</Text>
          {(["owner", "staff"] as const).map((role) => (
            <Button
              key={role}
              variant="secondary"
              label={role === "owner" ? t("Masuk sebagai pemilik", "Sign in as owner") : t("Masuk sebagai pembantu", "Sign in as helper")}
              onPress={() =>
                run(async () => {
                  await runtime.demoLogin(role);
                  await refresh();
                  router.replace("/");
                })
              }
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
