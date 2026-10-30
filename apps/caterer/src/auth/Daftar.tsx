import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, View } from "react-native";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { nativeLayout } from "@catera/design-tokens";
import { areaOptions } from "@catera/domain";
import { authClient, authError, clearPending, redirectFor, resendLink, savePending, useMobile } from "@catera/mobile-core";
import {
  authFields,
  AuthHeading,
  AuthScreen,
  AuthSwitch,
  Button,
  CheckEmail,
  Field,
  FieldMessage,
  FormError,
  PasswordField,
  PasswordRule,
  StepHeader,
  useFieldCheck,
} from "@catera/mobile-ui";
import { e164Indonesia } from "../onboarding";
import type { PendingKitchen } from "./pending";
import { AREA_CHIP, AreaChip, StepFooter, StepTitle, Terms, WhatsAppCheck } from "./parts";
import { areaCheck, emailCheck, nameCheck, newPasswordCheck, registeredText, waCheck } from "./checks";
import { useAuthRun } from "./useAuthRun";

const TOTAL = 4;

/** Leaves the first step: back where the person came from, or Masuk when the screen opened alone. */
export const leaveAuth = () => (router.canGoBack?.() ? router.back() : router.replace("/masuk" as never));

/**
 * Daftar, one topic per step (spec "Dapur app"): the business name, the kitchen area, the kitchen's WhatsApp, then the
 * account. Each step is checked on Lanjut; back (the header's, or Android's) goes to the step before. Daftar signs up
 * with the kitchen in the account's metadata; once the email link (or a later Masuk) signs in, `settlePending` makes it.
 */
export function Daftar() {
  const { runtime, t } = useMobile();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const slugSuffix = useRef(Crypto.randomUUID().replace(/-/g, "").slice(0, 4));
  const firstChip = useRef<View>(null);
  const run = useAuthRun();

  const one = useFieldCheck({ name: { value: name, check: nameCheck(t) } });
  const two = useFieldCheck({ area: { value: area, check: areaCheck(t) } });
  const three = useFieldCheck({ phone: { value: phone, check: waCheck(t) } });
  const four = useFieldCheck({
    email: { value: email, check: emailCheck(t) },
    // Worded by the PasswordRule line under the field, so its message is not passed to the Field.
    password: { value: password, check: newPasswordCheck },
  });
  const nameField = one.fieldProps("name");
  const areaField = two.fieldProps("area");
  const phoneField = three.fieldProps("phone");
  const emailField = four.fieldProps("email");
  const { error: _ruleOnly, ...passwordField } = four.fieldProps("password");
  // The area has no text input: focus for it means the first chip.
  (areaField.inputRef as { current: unknown }).current = {
    focus: () => {
      const node = firstChip.current;
      if (node) AccessibilityInfo.sendAccessibilityEvent(node, "focus");
    },
  };

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
        const kitchen: PendingKitchen = { name: name.trim(), area, whatsapp: e164Indonesia(phone) ?? undefined, slugSuffix: slugSuffix.current };
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
        if (["user_already_exists", "email_exists"].includes(error?.code || "") || data.user?.identities?.length === 0) throw new Error("EMAIL_REGISTERED");
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

  const next = () => {
    const checks = [one, two, three, four][step - 1];
    checks.submit(() => (step < TOTAL ? setStep(step + 1) : void signUp()));
  };

  const registered = run.code === "EMAIL_REGISTERED";
  const message = registered ? registeredText(t) : run.message;
  const failed = message ? (
    <FormError
      message={message}
      failureKey={run.failures}
      retry={run.retryable && !registered ? () => void (sent ? resend() : signUp()) : undefined}
      action={registered ? { label: t("Masuk dengan email ini", "Sign in with this email"), onPress: () => router.replace("/masuk" as never) } : undefined}
    />
  ) : null;

  if (sent)
    return (
      <AuthScreen revealKey={run.failures}>
        <CheckEmail
          email={email.trim()}
          intro={t("Kalau email ini bisa didaftarkan, tautan verifikasi sudah kami kirim ke", "If this email can be registered, we've sent a verification link to")}
          resent={resent}
          resendBusy={run.busy}
          error={failed}
          onResend={() => void resend()}
          onChangeEmail={() => {
            setResent(false);
            setSent(false);
          }}
        />
        <Button variant="text" label={t("Kembali ke Masuk", "Back to sign in")} style={{ alignSelf: "flex-start" }} onPress={() => router.replace("/masuk" as never)} />
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
      {step === 1 ? (
        <>
          <AuthHeading
            title={t("Apa nama usaha kateringmu?", "What's your catering business called?")}
            subtitle={t("Nama ini yang dilihat pelanggan di Catera. Bisa diubah nanti.", "Customers see this name on Catera. You can change it later.")}
          />
          <Field
            {...authFields.name}
            {...nameField}
            label={t("Nama usaha katering", "Catering business name")}
            value={name}
            onChangeText={setName}
            returnKeyType="next"
            onSubmitEditing={next}
          />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <StepTitle
            title={t("Di mana dapurmu?", "Where is your kitchen?")}
            subtitle={t(`Pelanggan di area ini akan melihat paket ${name.trim()}.`, `Customers in this area will see ${name.trim()}'s packages.`)}
          />
          <View style={{ gap: nativeLayout.groupGap }}>
            {/* 40 chips reach their 48 target by 4 of slop above and below, so the wrapped rows sit 8 apart. */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: nativeLayout.groupGap, rowGap: 48 - AREA_CHIP }}>
              {areaOptions.map((a, i) => (
                <View key={a} ref={i === 0 ? firstChip : undefined} collapsable={false}>
                  <AreaChip label={a} selected={area === a} onPress={() => setArea(a)} />
                </View>
              ))}
            </View>
            {areaField.error ? <FieldMessage text={areaField.error} testID="area-error" /> : null}
          </View>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <StepTitle
            title={t("Nomor WhatsApp dapur", "Kitchen WhatsApp number")}
            subtitle={t(
              "Pelanggan dan kurir menghubungimu lewat nomor ini. Kami tidak mengirim kode ke sini.",
              "Customers and couriers reach you on this number. We don't send codes to it.",
            )}
          />
          <View style={{ gap: nativeLayout.groupGap }}>
            <Field
              {...authFields.phone}
              {...phoneField}
              label={t("Nomor WhatsApp", "WhatsApp number")}
              hint={t("Contoh: 0812 3456 7890", "Example: 0812 3456 7890")}
              value={phone}
              onChangeText={setPhone}
              returnKeyType="go"
              onSubmitEditing={next}
            />
            <WhatsAppCheck phone={phone} ready={!waCheck(t)(phone)} />
          </View>
        </>
      ) : null}
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
