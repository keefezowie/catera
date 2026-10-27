import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { nativeLayout } from "@catera/design-tokens";
import type { Actor } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import {
  authFields,
  AuthHeading,
  AuthScreen,
  AuthSwitch,
  Button,
  CodeInput,
  countdownText,
  Field,
  FormError,
  MethodTabs,
  PasswordField,
  ResendButton,
  Text,
  useFieldCheck,
  useResendTimer,
} from "@catera/mobile-ui";
import { goToTab } from "../nav";
import { e164Indonesia } from "../onboarding";
import { useFormRun } from "../useFormRun";
import { emailCheck, FIELD_CODES, passwordCheck, phoneCheck, rateText, serverFallback, wrongCode } from "./checks";

/** How long the boxes show the forest ring before the screen leaves (spec 4). */
const VERIFIED_MS = 400;
type Waiting = "" | "step" | "resend" | "owner" | "staff";

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
  const [verified, setVerified] = useState(false);
  const [misses, setMisses] = useState(0);
  // Which button is waiting, so only it shows the spinner (D-6); the typed values stay on screen.
  const [waiting, setWaiting] = useState<Waiting>("");
  const { busy, failure, run, clear } = useFormRun(locale, serverFallback(t));
  const resend = useResendTimer(60);
  const rate = useResendTimer(60);
  const codeRef = useRef<{ focus(): void }>(null);
  // The last attempt, so "Coba lagi" after an offline failure repeats it.
  const last = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  const go = (which: Waiting, step: () => Promise<unknown>) =>
    run(async () => {
      setWaiting(which);
      try {
        await step();
      } finally {
        if (mounted.current) setWaiting("");
      }
    });

  const phoneForm = useFieldCheck({ phone: { value: phone, check: phoneCheck(t) } });
  const emailForm = useFieldCheck({
    email: { value: email, check: emailCheck(t) },
    password: { value: password, check: passwordCheck(t) },
  });
  const passwordField = emailForm.fieldProps("password");

  // A failure belongs to the method it came from.
  useEffect(clear, [method]);
  const failCode = failure?.code;
  useEffect(() => {
    if (!failure) return;
    if (failure.code === "AUTH_RATE_LIMITED") rate.restart();
    if (failure.code === "INVALID_CREDENTIALS") {
      setPassword("");
      emailForm.reset();
      passwordField.inputRef.current?.focus();
    }
    if (failure.code === "INVALID_OTP") {
      setMisses((n) => n + 1);
      codeRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per failure
  }, [failure?.key]);

  const finish = async (next: Actor) => {
    await signedIn(next);
    goToTab("index");
  };

  const phoneStep = method === "phone";
  const outlined = !!failCode && FIELD_CODES.includes(failCode);
  const wrongOtp = failCode === "INVALID_OTP";
  const limited = failCode === "AUTH_RATE_LIMITED" && rate.left > 0;
  const wait = countdownText(rate.left);

  const sendCode = () => {
    last.current = sendCode;
    phoneForm.submit(
      () =>
        void go("step", async () => {
          await runtime.sendPhoneOtp(e164Indonesia(phone));
          setSent(true);
          setMisses(0);
          resend.restart();
        }),
    );
  };
  // The code is checked by itself on its sixth digit (or on Masuk). One that does not match empties the boxes for the next try.
  const verify = (entered: string) => {
    last.current = () => void verify(entered);
    return go("step", async () => {
      let next: Actor;
      try {
        next = await runtime.verifyPhoneOtp(e164Indonesia(phone), entered.trim(), "", Crypto.randomUUID());
      } catch (e) {
        setCode("");
        throw e;
      }
      setVerified(true);
      await new Promise((r) => setTimeout(r, VERIFIED_MS));
      await finish(next);
    });
  };
  const signIn = () => {
    last.current = signIn;
    emailForm.submit(() => void go("step", async () => finish(await runtime.signInPassword(email, password, Crypto.randomUUID()))));
  };
  const submit = phoneStep ? (sent ? () => void verify(code) : sendCode) : signIn;

  const message = limited ? rateText(t, wait) : failure?.message;
  const retry = failCode === "OFFLINE" && last.current ? () => last.current?.() : undefined;
  const primaryLabel = limited
    ? t(`Coba lagi dalam ${wait}`, `Try again in ${wait}`)
    : phoneStep && !sent
      ? t("Kirim kode", "Send code")
      : t("Masuk", "Sign in");

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
        <View testID="masuk-fields" style={{ gap: nativeLayout.space.lg }}>
          <Field
            {...authFields.phone}
            {...phoneForm.fieldProps("phone")}
            label={t("Nomor WhatsApp", "WhatsApp number")}
            value={phone}
            onChangeText={setPhone}
            editable={!sent}
            returnKeyType="go"
            onSubmitEditing={sendCode}
          />
          {sent ? (
            <CodeInput
              label={t("Kode dari SMS", "Code from SMS")}
              value={code}
              onChangeText={setCode}
              onFilled={(entered) => void verify(entered)}
              editable={!busy}
              inputRef={codeRef as never}
              sentTo={e164Indonesia(phone)}
              error={wrongOtp ? wrongCode(t, misses) : undefined}
              errorKey={failure?.key}
              verified={verified}
            />
          ) : null}
          {sent ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: nativeLayout.groupGap }}>
              <ResendButton
                left={resend.left}
                ready={t("Kirim ulang kode", "Resend code")}
                waiting={(time) => t(`Kirim ulang dalam ${time}`, `Resend in ${time}`)}
                busy={waiting === "resend"}
                onPress={() => {
                  last.current = null;
                  void go("resend", async () => {
                    await runtime.sendPhoneOtp(e164Indonesia(phone));
                    setCode("");
                    setMisses(0);
                    resend.restart();
                  });
                }}
              />
              <Button
                variant="text"
                label={t("Ganti nomor", "Change number")}
                style={{ alignSelf: "flex-start" }}
                onPress={() => {
                  setSent(false);
                  setCode("");
                  setMisses(0);
                  setVerified(false);
                  clear();
                }}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <View testID="masuk-fields" style={{ gap: nativeLayout.space.lg }}>
          <Field
            {...authFields.email}
            {...emailForm.fieldProps("email")}
            label="Email"
            value={email}
            onChangeText={setEmail}
            invalid={outlined}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordField.inputRef.current?.focus()}
          />
          <PasswordField
            {...authFields.currentPassword}
            {...passwordField}
            label={t("Kata sandi", "Password")}
            value={password}
            onChangeText={setPassword}
            invalid={outlined}
            returnKeyType="go"
            onSubmitEditing={signIn}
            showA11y={t("Tampilkan kata sandi", "Show password")}
            hideA11y={t("Sembunyikan kata sandi", "Hide password")}
          />
        </View>
      )}
      {message && !wrongOtp ? <FormError message={message} failureKey={failure?.key} retry={retry} /> : null}
      <Button label={primaryLabel} busy={waiting === "step"} disabled={limited || (phoneStep && sent && code.length < 6)} onPress={submit} />
      <AuthSwitch
        prompt={t("Belum punya akun?", "No account yet?")}
        action={t("Daftar", "Sign up")}
        onPress={() => router.push("/daftar" as never)}
      />
      {__DEV__ ? (
        <View style={{ gap: nativeLayout.groupGap }}>
          <Text variant="meta">{t("Demo (data contoh)", "Demo (sample data)")}</Text>
          {(["owner", "staff"] as const).map((role) => (
            <Button
              key={role}
              variant="secondary"
              busy={waiting === role}
              disabled={busy && waiting !== role}
              label={role === "owner" ? t("Masuk sebagai pemilik", "Sign in as owner") : t("Masuk sebagai staf dapur", "Sign in as kitchen staff")}
              onPress={() => {
                last.current = null;
                void go(role, async () => {
                  await runtime.demoLogin(role);
                  await refresh();
                  goToTab("index");
                });
              }}
            />
          ))}
        </View>
      ) : null}
    </AuthScreen>
  );
}
