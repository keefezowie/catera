import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { errorLabel, type Actor } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { AuthHeading, AuthScreen, AuthSwitch, Button, Field, FormError, MethodTabs, PasswordField, Text } from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { leaveFor } from "../nav";
import { CodeInput, ResendButton, useResendTimer } from "./CodeInput";

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
  const params = useLocalSearchParams<{ next?: string }>();
  const next = nativeReturnPath(typeof params.next === "string" ? params.next : undefined);
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Which action is waiting, so only its button shows the spinner; the typed number and the code stay on screen.
  const [waiting, setWaiting] = useState<"step" | "resend" | "demo" | "">("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  // Held from the press to the answer, so a code that fills twice in one frame is still checked once.
  const lock = useRef(false);
  const resend = useResendTimer(60);

  useEffect(() => setError(""), [method]);

  async function run(step: () => Promise<void>, which: "step" | "resend" | "demo" = "step") {
    if (lock.current) return;
    lock.current = true;
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
          : errorLabel(code, locale) || t("Belum bisa masuk. Coba lagi.", "Couldn't sign you in. Try again."),
      );
      setFailures((n) => n + 1);
    } finally {
      lock.current = false;
      setBusy(false);
      setWaiting("");
    }
  }

  const finish = async (actor: Actor) => {
    await signedIn(actor);
    leaveFor(next);
  };

  const phoneCopy = t(
    "Pakai nomor HP yang kamu berikan ke katering. Kami kirim kode lewat SMS.",
    "Use the phone number you gave your caterer. We text you a code.",
  );
  const emailCopy = t("Masuk dengan email dan kata sandi kamu.", "Sign in with your email and password.");
  const phoneStep = method === "phone";
  // The code is checked by itself on its sixth digit (or on Masuk). One that does not match empties the slots for the next try.
  const verify = (entered: string) =>
    run(async () => {
      try {
        await finish(await runtime.verifyPhoneOtp(e164Indonesia(phone), entered, "Pelanggan", Crypto.randomUUID()));
      } catch (e) {
        setCode("");
        throw e;
      }
    });
  const primary = phoneStep ? (
    <Button
      label={sent ? t("Masuk", "Sign in") : t("Kirim kode", "Send code")}
      busy={waiting === "step"}
      disabled={sent ? code.length < 6 : phone.replace(/\D/g, "").length < 9}
      onPress={() =>
        sent
          ? void verify(code)
          : void run(async () => {
              await runtime.sendPhoneOtp(e164Indonesia(phone));
              setSent(true);
              resend.restart();
            })
      }
    />
  ) : (
    <Button
      label={t("Masuk", "Sign in")}
      busy={waiting === "step"}
      disabled={!email || !password}
      onPress={() => run(async () => finish(await runtime.signInPassword(email, password, Crypto.randomUUID(), "Pelanggan")))}
    />
  );

  return (
    <AuthScreen revealKey={failures}>
      <AuthHeading title={t("Masuk", "Sign in")} subtitle={phoneStep ? phoneCopy : emailCopy} />
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
            label={t("Nomor HP", "Phone number")}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="0812…"
            editable={!sent}
            invalid={!!error && !sent}
          />
          {sent ? (
            <CodeInput
              label={t("Kode dari SMS", "Code from SMS")}
              value={code}
              onChangeText={setCode}
              onFilled={(entered) => void verify(entered)}
              invalid={!!error && !code}
            />
          ) : null}
          {sent ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16 }}>
              <ResendButton
                left={resend.left}
                ready={t("Kirim ulang kode", "Resend code")}
                waiting={(time) => t(`Kirim ulang dalam ${time}`, `Resend in ${time}`)}
                busy={waiting === "resend"}
                onPress={() =>
                  void run(async () => {
                    await runtime.sendPhoneOtp(e164Indonesia(phone));
                    setCode("");
                    resend.restart();
                  }, "resend")
                }
              />
              <Button
                variant="text"
                label={t("Ganti nomor", "Change number")}
                style={{ alignSelf: "flex-start" }}
                onPress={() => {
                  setSent(false);
                  setCode("");
                }}
              />
            </View>
          ) : null}
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
            invalid={!!error}
          />
          <PasswordField
            label={t("Kata sandi", "Password")}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            maxLength={256}
            invalid={!!error}
            showWord={t("Tampilkan", "Show")}
            hideWord={t("Sembunyikan", "Hide")}
            showA11y={t("Tampilkan kata sandi", "Show password")}
            hideA11y={t("Sembunyikan kata sandi", "Hide password")}
          />
          <Button
            variant="text"
            label={t("Lupa kata sandi?", "Forgot password?")}
            style={{ alignSelf: "flex-start", marginTop: -8 }}
            onPress={() => router.push({ pathname: "/recover", params: { next } } as never)}
          />
        </View>
      )}
      {error ? <FormError message={error} failureKey={failures} testID="masuk-error" /> : null}
      {primary}
      <AuthSwitch
        prompt={t("Belum punya akun?", "No account yet?")}
        action={t("Daftar", "Sign up")}
        onPress={() => router.push({ pathname: "/register", params: { next } } as never)}
      />
      {__DEV__ ? (
        <View style={{ gap: 8 }}>
          <Text variant="caption">{t("Demo (data contoh)", "Demo (sample data)")}</Text>
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
    </AuthScreen>
  );
}
