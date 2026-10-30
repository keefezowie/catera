import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import {
  authFields,
  AuthHeading,
  AuthScreen,
  AuthSwitch,
  Button,
  countdownText,
  Field,
  FormError,
  PasswordField,
  Text,
  useFieldCheck,
  useResendTimer,
} from "@catera/mobile-ui";
import { goToTab } from "../nav";
import { useFormRun } from "../useFormRun";
import { StepFooter } from "./parts";
import { canRetry, emailCheck, FIELD_CODES, passwordCheck, rateText, serverFallback } from "./checks";

type Waiting = "" | "step" | "owner" | "staff";

/**
 * Masuk with email and password (spec "Dapur app"), with the ways to Daftar and to Gabung pinned above the button.
 * Demo roles only in development. A first sign-in after Daftar or Gabung finishes its setup in RoleGate.
 */
export function Masuk() {
  const { runtime, actor, t, locale, signedIn, refresh } = useMobile();
  // A session that comes back (signal returns, token refreshes) goes straight to the kitchen.
  useEffect(() => {
    if (actor) goToTab("index");
  }, [actor]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Wrong passwords in a row: the second one offers the way back in.
  const [badLogins, setBadLogins] = useState(0);
  // Which button is waiting, so only it shows the spinner (D-6); the typed values stay on screen.
  const [waiting, setWaiting] = useState<Waiting>("");
  const { busy, failure, run } = useFormRun(locale, serverFallback(t));
  const rate = useResendTimer(60);
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

  const form = useFieldCheck({
    email: { value: email, check: emailCheck(t) },
    password: { value: password, check: passwordCheck(t) },
  });
  const passwordField = form.fieldProps("password");

  const failCode = failure?.code;
  useEffect(() => {
    if (!failure) return;
    if (failure.code === "AUTH_RATE_LIMITED") rate.restart();
    setBadLogins((n) => (failure.code === "INVALID_CREDENTIALS" ? n + 1 : 0));
    if (failure.code === "INVALID_CREDENTIALS") {
      setPassword("");
      form.reset();
      passwordField.inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per failure
  }, [failure?.key]);

  const forgot = () => router.push("/pulihkan" as never);
  const outlined = !!failCode && FIELD_CODES.includes(failCode);
  const limited = failCode === "AUTH_RATE_LIMITED" && rate.left > 0;
  const wait = countdownText(rate.left);

  const signIn = () => {
    last.current = signIn;
    form.submit(
      () =>
        void go("step", async () => {
          await signedIn(await runtime.signInPassword(email, password, Crypto.randomUUID()));
          goToTab("index");
        }),
    );
  };

  const message = failCode === "AUTH_RATE_LIMITED" ? (limited ? rateText(t, wait) : "") : failure?.message;
  const retry = canRetry(t, failure) && last.current ? () => last.current?.() : undefined;

  return (
    <AuthScreen
      revealKey={failure?.key}
      footer={
        <StepFooter
          links={
            <>
              <AuthSwitch prompt={t("Belum punya dapur?", "No kitchen yet?")} action={t("Daftar", "Sign up")} onPress={() => router.push("/daftar" as never)} />
              <AuthSwitch
                prompt={t("Diundang sebagai staf?", "Invited as staff?")}
                action={t("Gabung ke dapur", "Join a kitchen")}
                onPress={() => router.push("/gabung" as never)}
              />
            </>
          }
        >
          <Button
            label={limited ? t(`Coba lagi dalam ${wait}`, `Try again in ${wait}`) : t("Masuk", "Sign in")}
            busy={waiting === "step"}
            disabled={limited}
            onPress={signIn}
          />
        </StepFooter>
      }
    >
      <AuthHeading title={t("Masuk", "Sign in")} subtitle={t("Masuk dengan email dan kata sandi dapurmu.", "Sign in with your kitchen's email and password.")} />
      <View testID="masuk-fields" style={{ gap: nativeLayout.space.lg }}>
        <Field
          {...authFields.email}
          {...form.fieldProps("email")}
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
        <Button variant="text" label={t("Lupa kata sandi?", "Forgot password?")} style={{ alignSelf: "flex-start", marginTop: -8 }} onPress={forgot} />
      </View>
      {message ? (
        <FormError
          message={message}
          failureKey={failure?.key}
          retry={retry}
          action={failCode === "INVALID_CREDENTIALS" && badLogins >= 2 ? { label: t("Lupa kata sandi?", "Forgot password?"), onPress: forgot } : undefined}
        />
      ) : null}
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
                const demo = () =>
                  void go(role, async () => {
                    await runtime.demoLogin(role);
                    await refresh();
                    goToTab("index");
                  });
                last.current = demo;
                demo();
              }}
            />
          ))}
        </View>
      ) : null}
    </AuthScreen>
  );
}
