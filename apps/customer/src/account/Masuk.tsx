import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { type Actor } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import {
  authFields,
  AuthHeading,
  AuthScreen,
  AuthSwitch,
  Button,
  CheckEmail,
  CodeInput,
  countdownText,
  Field,
  FormError,
  maskPhone,
  MethodTabs,
  PasswordField,
  ResendButton,
  Text,
  useFieldCheck,
  useResendTimer,
} from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { leaveFor } from "../nav";
import { authClient, authError, RATE_WAIT_S, REDIRECT_TO, savePending, validEmail } from "./emailAuth";
import { authFailure, rateText } from "./failure";

/** Numbers as typed in Indonesia (0812…, 62812…, +62 812…, 812…) to E.164. */
export function e164Indonesia(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  else if (!digits.startsWith("62")) digits = "62" + digits;
  return "+" + digits;
}

type Step = { step: () => Promise<void>; which: "step" | "resend" | "demo" };

/** Sign in with the phone number (SMS code) first; email and password on request. */
export function Masuk() {
  const { runtime, t, locale, signedIn, refresh } = useMobile();
  const params = useLocalSearchParams<{ next?: string; email?: string }>();
  const next = nativeReturnPath(typeof params.next === "string" ? params.next : undefined);
  // Daftar's "Masuk dengan email ini" arrives with the address, on the Email tab.
  const prefill = typeof params.email === "string" ? params.email : "";
  const [method, setMethod] = useState<"phone" | "email">(prefill ? "email" : "phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState(prefill);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Which action is waiting, so only its button shows the spinner; the typed number and the code stay on screen.
  const [waiting, setWaiting] = useState<"step" | "resend" | "demo" | "">("");
  // The failing step's code; the sentence is worded at render, so a countdown stays live.
  const [fail, setFail] = useState("");
  const [failures, setFailures] = useState(0);
  const [badLogins, setBadLogins] = useState(0);
  const [wrongCodes, setWrongCodes] = useState(0);
  const [verified, setVerified] = useState(false);
  // The mascot is confused after a failure and waves again on the next edit.
  const [edited, setEdited] = useState(true);
  const [fieldFailed, setFieldFailed] = useState(false);
  // "Cek emailmu" in place of the form, after an unverified address asked for a new link.
  const [mail, setMail] = useState(false);
  const [resent, setResent] = useState(false);
  // Held from the press to the answer, so a code that fills twice in one frame is still checked once.
  const lock = useRef(false);
  const lastStep = useRef<Step | null>(null);
  const refocusPassword = useRef(false);
  const resend = useResendTimer(60);
  const rate = useResendTimer(RATE_WAIT_S);

  const phoneChecks = useFieldCheck({
    phone: {
      value: phone,
      check: (v) => {
        const digits = v.replace(/\D/g, "").length;
        if (!digits) return t("Isi nomor HP-mu dulu.", "Enter your phone number first.");
        return digits < 9 || digits > 15
          ? t("Nomor HP belum lengkap. Contoh: 0812 3456 7890", "That number looks incomplete. Example: 0812 3456 7890")
          : "";
      },
    },
  });
  const emailChecks = useFieldCheck({
    email: {
      value: email,
      check: (v) =>
        !v.trim()
          ? t("Isi emailmu dulu.", "Enter your email first.")
          : validEmail(v)
            ? ""
            : t("Format email belum benar. Contoh: nama@gmail.com", "That email doesn't look right. Example: name@gmail.com"),
    },
    // Only empty is wrong: an old 6-character password must still sign in.
    password: { value: password, check: (v) => (v ? "" : t("Isi kata sandimu dulu.", "Enter your password first.")) },
  });
  const phoneProps = phoneChecks.fieldProps("phone");
  const emailProps = emailChecks.fieldProps("email");
  const passwordProps = emailChecks.fieldProps("password");

  useEffect(() => {
    setFail("");
    setFieldFailed(false);
    setEdited(true);
  }, [method]);
  // After a wrong password the cleared field takes focus once it is editable again.
  useEffect(() => {
    if (!busy && refocusPassword.current) {
      refocusPassword.current = false;
      passwordProps.inputRef.current?.focus();
    }
  }, [busy, passwordProps.inputRef]);

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setEdited(true);
  };

  async function run(step: () => Promise<void>, which: Step["which"] = "step") {
    if (lock.current) return;
    lock.current = true;
    lastStep.current = { step, which };
    setBusy(true);
    setWaiting(which);
    setFail("");
    try {
      await step();
      setBadLogins(0);
    } catch (e) {
      const failed = (e as { code?: string }).code || (e as Error).message;
      setFail(failed);
      setFailures((n) => n + 1);
      setEdited(false);
      setBadLogins((n) => (failed === "INVALID_CREDENTIALS" ? n + 1 : 0));
      if (failed === "INVALID_OTP") setWrongCodes((n) => n + 1);
      if (failed === "AUTH_RATE_LIMITED") rate.restart();
      if (failed === "INVALID_CREDENTIALS") {
        setPassword("");
        refocusPassword.current = true;
      }
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
        const actor = await runtime.verifyPhoneOtp(e164Indonesia(phone), entered, "Pelanggan", Crypto.randomUUID());
        setVerified(true);
        await finish(actor);
      } catch (e) {
        setCode("");
        throw e;
      }
    });
  const sendCode = () =>
    run(async () => {
      await runtime.sendPhoneOtp(e164Indonesia(phone));
      setSent(true);
      resend.restart();
    });
  const signInEmail = () => run(async () => finish(await runtime.signInPassword(email, password, Crypto.randomUUID(), "Pelanggan")));
  // Unverified: a new sign-up link right here, then "Cek emailmu" for that address.
  const resendLink = () =>
    run(async () => {
      const again = mail;
      if (again) setResent(false);
      await savePending(runtime, "signup", next, email.trim());
      const { error } = await authClient(runtime).auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: REDIRECT_TO },
      });
      if (!["user_not_found", "email_exists", "email_not_confirmed"].includes(error?.code || "")) authError(error);
      setMail(true);
      if (again) setResent(true);
    }, "resend");

  // Every field is checked on a press; a wrong one keeps the request unsent and the mascot confused.
  const press = (checks: { submit: (go: () => void) => void }, go: () => void) => {
    let ok = false;
    checks.submit(() => {
      ok = true;
      go();
    });
    setFieldFailed(!ok);
    if (!ok) setEdited(false);
  };

  const limited = fail === "AUTH_RATE_LIMITED";
  const wait = limited ? rate.left : 0;
  // A code that does not match is worded under the boxes; the rest goes in the FormError above the button.
  const message = limited
    ? wait > 0
      ? rateText(t, countdownText(wait))
      : ""
    : fail && fail !== "INVALID_OTP"
      ? authFailure({ code: fail }, locale, t)
      : "";
  const codeError =
    fail === "INVALID_OTP"
      ? t("Kodenya salah. Cek SMS-nya, lalu coba lagi.", "That code is wrong. Check the SMS and try again.") +
        (wrongCodes >= 3 ? " " + t("Belum dapat kodenya? Kirim ulang.", "Didn't get the code? Resend it.") : "")
      : undefined;
  const retry = lastStep.current;
  const formError = message ? (
    <FormError
      message={message}
      failureKey={failures}
      testID="masuk-error"
      retry={fail === "OFFLINE" && retry ? () => void run(retry.step, retry.which) : undefined}
      action={
        fail === "EMAIL_NOT_CONFIRMED"
          ? { label: t("Kirim ulang tautan", "Resend link"), onPress: () => void resendLink() }
          : fail === "INVALID_CREDENTIALS" && badLogins >= 2
            ? { label: t("Lupa kata sandi?", "Forgot password?"), onPress: () => router.push({ pathname: "/recover", params: { next } } as never) }
            : undefined
      }
    />
  ) : null;
  const pose =
    busy && waiting === "step" && phoneStep && sent
      ? "membaca"
      : edited
        ? "melambai"
        : fail === "OFFLINE"
          ? "mencari"
          : fail || fieldFailed
            ? "bingung"
            : "melambai";
  const label = (normal: string) =>
    wait > 0 ? t(`Coba lagi dalam ${countdownText(wait)}`, `Try again in ${countdownText(wait)}`) : normal;

  const primary = phoneStep ? (
    <Button
      label={label(sent ? t("Masuk", "Sign in") : t("Kirim kode", "Send code"))}
      busy={waiting === "step"}
      disabled={wait > 0 || (sent && code.length < 6)}
      onPress={() => (sent ? void verify(code) : press(phoneChecks, () => void sendCode()))}
    />
  ) : (
    <Button
      label={label(t("Masuk", "Sign in"))}
      busy={waiting === "step"}
      disabled={wait > 0}
      onPress={() => press(emailChecks, () => void signInEmail())}
    />
  );

  if (mail)
    return (
      <AuthScreen revealKey={failures}>
        <CheckEmail
          email={email.trim()}
          intro={t("Tautan verifikasi baru sudah kami kirim ke", "We've sent a new verification link to")}
          resent={resent}
          resendBusy={busy}
          error={formError}
          onResend={() => void resendLink()}
          onChangeEmail={() => {
            setResent(false);
            setMail(false);
            setFail("");
          }}
        />
      </AuthScreen>
    );

  return (
    <AuthScreen revealKey={failures}>
      <AuthHeading title={t("Masuk", "Sign in")} subtitle={phoneStep ? phoneCopy : emailCopy} pose={pose} />
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
            {...authFields.phone}
            {...phoneProps}
            value={phone}
            onChangeText={edit(setPhone)}
            placeholder="0812…"
            editable={!sent && !busy}
            returnKeyType="go"
            onSubmitEditing={() => press(phoneChecks, () => void sendCode())}
          />
          {sent ? (
            <CodeInput
              label={t("Kode dari SMS", "Code from SMS")}
              value={code}
              onChangeText={edit(setCode)}
              onFilled={(entered) => void verify(entered)}
              editable={!busy}
              sentTo={maskPhone(e164Indonesia(phone))}
              error={codeError}
              errorKey={failures}
              verified={verified}
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
                  setVerified(false);
                  setFail("");
                }}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Field
            label="Email"
            {...authFields.email}
            {...emailProps}
            value={email}
            onChangeText={edit(setEmail)}
            editable={!busy}
            invalid={fail === "INVALID_CREDENTIALS" || fail === "EMAIL_NOT_CONFIRMED"}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordProps.inputRef.current?.focus()}
          />
          <PasswordField
            label={t("Kata sandi", "Password")}
            {...authFields.currentPassword}
            {...passwordProps}
            returnKeyType="go"
            onSubmitEditing={() => press(emailChecks, () => void signInEmail())}
            value={password}
            onChangeText={edit(setPassword)}
            editable={!busy}
            invalid={fail === "INVALID_CREDENTIALS"}
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
      {formError}
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
