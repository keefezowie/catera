import { useEffect, useState } from "react";
import { BackHandler, View } from "react-native";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { authClient, authError, clearPending, redirectFor, resendLink, savePending, useMobile } from "@catera/mobile-core";
import {
  authFields,
  AuthScreen,
  AuthSwitch,
  Button,
  CheckEmail,
  Field,
  FormError,
  PasswordField,
  PasswordRule,
  StepHeader,
  useFieldCheck,
} from "@catera/mobile-ui";
import { goToTab } from "../nav";
import { holdKitchen } from "./pending";
import { StepFooter, StepTitle, Terms } from "./parts";
import { emailCheck, kitchenRegisteredText, newPasswordCheck } from "./checks";
import { useKitchenSteps } from "./kitchenSteps";
import { useAuthRun } from "./useAuthRun";

const TOTAL = 4;

/** Leaves the first step: back where the person came from, or Masuk when the screen opened alone. */
export const leaveAuth = () => (router.canGoBack?.() ? router.back() : router.replace("/masuk" as never));

/**
 * Daftar, one topic per step (spec "Dapur app"): the business name, the kitchen area, the kitchen's WhatsApp, then the
 * account. Each step is checked on Lanjut; back (the header's, or Android's) goes to the step before. Daftar signs up
 * with the kitchen in the account's metadata; once the email link (or a later Masuk) signs in, `settlePending` makes it.
 * An email that already has an account (a customer, usually) keeps what was typed and signs in with the password just
 * given; RoleGate then asks them to confirm the kitchen. A wrong password says so and sends them to Masuk.
 */
export function Daftar() {
  const { runtime, t, signedIn } = useMobile();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const run = useAuthRun();
  const next = () => {
    const checks = [...steps.checks, four][step - 1];
    checks.submit(() => (step < TOTAL ? setStep(step + 1) : void signUp()));
  };
  const steps = useKitchenSteps({ onSubmit: next });

  const four = useFieldCheck({
    email: { value: email, check: emailCheck(t) },
    // Worded by the PasswordRule line under the field, so its message is not passed to the Field.
    password: { value: password, check: newPasswordCheck },
  });
  const emailField = four.fieldProps("email");
  const { error: _ruleOnly, ...passwordField } = four.fieldProps("password");

  const back = () => (step > 1 ? setStep(step - 1) : leaveAuth());
  useEffect(() => {
    if (step === 1 || sent) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setStep((s) => s - 1);
      return true;
    });
    return () => sub.remove();
  }, [step, sent]);

  const signUp = () =>
    run.run(async () => {
      const address = email.trim();
      await savePending(runtime, "signup", "/", address);
      try {
        const client = authClient(runtime);
        const kitchen = steps.kitchen();
        const { data, error } = await client.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: redirectFor("catera-dapur"), data: { name: kitchen.name, pendingKitchen: kitchen } },
        });
        // Email confirmation must be on: a session here means the project skips verification.
        if (data.session) {
          await client.auth.signOut({ scope: "local" });
          throw new Error("NOT_CONFIGURED");
        }
        // Supabase hides a registered address behind a user with no identities; say so instead of a link that never comes.
        if (["user_already_exists", "email_exists"].includes(error?.code || "") || data.user?.identities?.length === 0) {
          await holdKitchen(runtime, kitchen);
          const actor = await runtime.signInPassword(address, password, Crypto.randomUUID()).catch(() => null);
          if (!actor) throw new Error("EMAIL_REGISTERED");
          await clearPending(runtime);
          await signedIn(actor);
          goToTab("index");
          return;
        }
        authError(error);
      } catch (e) {
        // No link went out, so a later expired-link screen must not offer to resend to this address.
        await clearPending(runtime);
        throw e;
      }
      setPassword("");
      setSent(true);
    });

  const resend = () =>
    run.run(async () => {
      setResent(false);
      await resendLink(runtime, { purpose: "signup", next: "/", email: email.trim() }, redirectFor("catera-dapur"));
      setResent(true);
    });

  const registered = run.code === "EMAIL_REGISTERED";
  const message = registered ? kitchenRegisteredText(t) : run.message;
  const failed = message ? (
    <FormError
      message={message}
      failureKey={run.failures}
      retry={run.retryable && !registered ? () => void (sent ? resend() : signUp()) : undefined}
      action={registered ? { label: t("Masuk dengan email ini", "Sign in with this email"), onPress: () => router.replace({ pathname: "/masuk", params: { email: email.trim() } } as never) } : undefined}
    />
  ) : null;

  if (sent)
    return (
      <AuthScreen revealKey={run.failures}>
        <CheckEmail
          email={email.trim()}
          intro={t("Kalau emailnya bisa dipakai, kami kirim tautan verifikasi ke", "If this email can be used, we'll send a verification link to")}
          resent={resent}
          resendBusy={run.busy}
          error={failed}
          onResend={() => void resend()}
          onChangeEmail={() => {
            setResent(false);
            setSent(false);
          }}
        />
        <Button variant="text" label={t("Kembali ke halaman masuk", "Back to sign in")} style={{ alignSelf: "flex-start" }} onPress={() => router.replace("/masuk" as never)} />
      </AuthScreen>
    );

  const last = step === TOTAL;
  return (
    <AuthScreen
      revealKey={run.failures}
      footer={
        <StepFooter
          links={
            step === 1 ? (
              <AuthSwitch prompt={t("Sudah punya dapur?", "Already have a kitchen?")} action={t("Masuk", "Sign in")} onPress={() => router.replace("/masuk" as never)} />
            ) : last ? (
              <Terms lead={t("Dengan mendaftar, kamu setuju dengan", "By signing up, you agree to the")} />
            ) : null
          }
        >
          <Button
            label={last ? run.label(t("Daftar", "Sign up")) : t("Lanjut", "Continue")}
            busy={last && run.busy}
            disabled={last && run.wait > 0}
            onPress={next}
          />
        </StepFooter>
      }
    >
      <StepHeader step={step} total={TOTAL} onBack={back} />
      {last ? null : steps.body(step)}
      {last ? (
        <>
          <StepTitle
            title={t("Terakhir, buat akunmu", "Last, create your account")}
            subtitle={t("Kamu masuk ke Catera Dapur dengan email dan kata sandi ini.", "You sign in to Catera Dapur with this email and password.")}
          />
          <Field
            {...authFields.email}
            {...emailField}
            label="Email"
            hint={t("Kami kirim tautan verifikasi ke email ini.", "We'll send a verification link to this email.")}
            value={email}
            onChangeText={setEmail}
            editable={!run.busy}
            invalid={registered}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordField.inputRef.current?.focus()}
          />
          <View style={{ gap: 6 }}>
            <PasswordField
              {...authFields.newPassword}
              {...passwordField}
              label={t("Kata sandi", "Password")}
              value={password}
              onChangeText={setPassword}
              editable={!run.busy}
              invalid={run.code === "PASSWORD_REJECTED" || !!four.messages.password}
              returnKeyType="go"
              onSubmitEditing={next}
              showA11y={t("Tampilkan kata sandi", "Show password")}
              hideA11y={t("Sembunyikan kata sandi", "Hide password")}
            />
            <PasswordRule value={password} failed={!!four.messages.password} />
          </View>
          {failed}
        </>
      ) : null}
    </AuthScreen>
  );
}
