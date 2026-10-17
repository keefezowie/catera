import { useEffect, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { errorLabel, type Actor } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { Button, Field, FormError, Screen, StateArt, Text, useColors } from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { leaveFor } from "../nav";

/** Numbers as typed in Indonesia (0812…, 62812…, +62 812…, 812…) to E.164. */
export function e164Indonesia(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  else if (!digits.startsWith("62")) digits = "62" + digits;
  return "+" + digits;
}

/** Sign in with the phone number (SMS code) first; email and password on request. */
export function Masuk() {
  const { runtime, t, locale, signedIn, refresh } = useMobile();
  const c = useColors();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = nativeReturnPath(typeof params.next === "string" ? params.next : undefined);
  const [withEmail, setWithEmail] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Which action is waiting, so only its button shows the spinner; the typed number and the code stay on screen.
  const [waiting, setWaiting] = useState<"step" | "demo" | "">("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);

  useEffect(() => setError(""), [withEmail]);

  async function run(step: () => Promise<void>, which: "step" | "demo" = "step") {
    if (busy) return;
    setBusy(true);
    setWaiting(which);
    setError("");
    try {
      await step();
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setError(
        code === "INVALID_OTP"
          ? t("Kode belum cocok. Periksa SMS lalu coba lagi.", "That code doesn't match. Check the SMS and try again.")
          : errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again."),
      );
      setFailures((n) => n + 1);
    } finally {
      setBusy(false);
      setWaiting("");
    }
  }

  const finish = async (actor: Actor) => {
    await signedIn(actor);
    leaveFor(next);
  };

  return (
    <Screen>
      <View style={{ paddingTop: 8, gap: 12 }}>
        {/* The waving mascot greets the person signing in; the sentence under it carries the meaning. */}
        <StateArt pose="melambai" />
        <Text style={{ color: c.muted, textAlign: "center" }}>
          {t(
            "Pakai nomor HP yang Anda berikan ke katering. Kami kirim kode lewat SMS.",
            "Use the phone number you gave your caterer. We'll text you a code.",
          )}
        </Text>
      </View>
      {!withEmail ? (
        <View style={{ gap: 14 }}>
          <Field
            label={t("Nomor HP", "Phone number")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="0812…"
            editable={!sent}
          />
          {sent ? (
            <Field
              label={t("Kode dari SMS", "Code from SMS")}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              maxLength={6}
              autoFocus
            />
          ) : null}
          <Button
            label={sent ? t("Masuk", "Sign in") : t("Kirim kode", "Send code")}
            busy={waiting === "step"}
            disabled={sent ? code.trim().length < 6 : phone.replace(/\D/g, "").length < 9}
            onPress={() =>
              run(async () => {
                if (!sent) {
                  await runtime.sendPhoneOtp(e164Indonesia(phone));
                  setSent(true);
                } else {
                  // The code stays on screen while it is checked; a code that does not match comes back to it.
                  await finish(await runtime.verifyPhoneOtp(e164Indonesia(phone), code.trim(), "Pelanggan", Crypto.randomUUID()));
                }
              })
            }
          />
          {sent ? (
            <Button
              variant="text"
              label={t("Ganti nomor", "Change number")}
              onPress={() => {
                setSent(false);
                setCode("");
              }}
            />
          ) : null}
          <Button variant="text" label={t("Masuk dengan email", "Sign in with email")} onPress={() => setWithEmail(true)} />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            maxLength={254}
          />
          <Field
            label={t("Kata sandi", "Password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            maxLength={256}
          />
          <Button
            label={t("Masuk", "Sign in")}
            busy={waiting === "step"}
            disabled={!email || !password}
            onPress={() => run(async () => finish(await runtime.signInPassword(email, password, Crypto.randomUUID(), "Pelanggan")))}
          />
          <Button
            variant="text"
            label={t("Lupa kata sandi?", "Forgot password?")}
            onPress={() => router.push({ pathname: "/recover", params: { next } } as never)}
          />
          <Button variant="text" label={t("Masuk dengan nomor HP", "Sign in with phone")} onPress={() => setWithEmail(false)} />
        </View>
      )}
      {error ? <FormError message={error} failureKey={failures} testID="masuk-error" /> : null}
      <Button
        variant="text"
        label={t("Daftar dengan email", "Sign up with email")}
        onPress={() => router.push({ pathname: "/register", params: { next } } as never)}
      />
      {__DEV__ ? (
        <View style={{ gap: 8 }}>
          <Text variant="caption">{t("Demo (data sintetis)", "Demo (synthetic data)")}</Text>
          <Button
            variant="secondary"
            label={t("Masuk sebagai pelanggan demo", "Sign in as demo customer")}
            busy={waiting === "demo"}
            disabled={busy && waiting !== "demo"}
            onPress={() =>
              run(async () => {
                await runtime.demoLogin("customer");
                await refresh();
                leaveFor(next);
              }, "demo")
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}
