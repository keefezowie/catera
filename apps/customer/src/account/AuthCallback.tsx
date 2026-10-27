import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import * as Crypto from "expo-crypto";
import { authClient, exchangeEmailLink, readPending, resendLink, saveNewPassword, useMobile } from "@catera/mobile-core";
import { AuthHeading, AuthOutcome, AuthScreen, Button, CheckEmail, ExpiredLink, FormError, NewPasswordForm } from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { REDIRECT_TO } from "./emailAuth";
import { canRetry } from "./failure";
import { useAuthRun, useFormPose } from "./useAuthRun";
import { leaveFor } from "../nav";

type Phase = "checking" | "recovery" | "expired" | "sent" | "reset" | "verified";
/** What this phone remembers about the link it asked for; empty when it asked for none. */
type Intent = { purpose: "signup" | "recovery" | ""; email: string; next: string };

/**
 * catera://auth/callback: finishes email verification (then says so), or sets a new password after recovery (the
 * person stays signed in, then is told so). A link with no code, an error, or no pending request on this phone goes
 * straight to the expired screen without asking the server (audit C-3).
 */
export function AuthCallback() {
  const { runtime, refresh, t, locale } = useMobile();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const code = typeof params.code === "string" ? params.code : "";
  const linkError = typeof params.error === "string" ? params.error : "";
  const [phase, setPhase] = useState<Phase>("checking");
  const [intent, setIntent] = useState<Intent>({ purpose: "", email: "", next: "/" });
  const [name, setName] = useState("");
  const [resent, setResent] = useState(false);
  const [left, setLeft] = useState(false);
  const next = useRef("/");
  const recoveryUser = useRef("");
  const started = useRef(false);
  const leaving = useRef(false);
  const run = useAuthRun();
  const form = useFormPose(run.code, run.failures);
  const action = { ...run, retryable: canRetry(run.code, locale) };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const stored = await readPending(runtime);
      if (stored) {
        next.current = nativeReturnPath(stored.next);
        setIntent({ purpose: stored.purpose, email: stored.email, next: next.current });
      }
      const link = await exchangeEmailLink(runtime, stored, { code, linkError });
      if (link.purpose === "recovery") {
        recoveryUser.current = link.userId;
        setPhase("recovery");
        return;
      }
      const ensured = await authClient(runtime).rpc("catera_v1_command", {
        action: "profile.ensure",
        payload: { name: link.name || "Pelanggan" },
        request_id: Crypto.randomUUID(),
      });
      if (ensured.error) throw ensured.error;
      await refresh();
      setName(link.name);
      setPhase("verified");
    })().catch(() => setPhase("expired"));
  }, [code, linkError, refresh, runtime]);

  const savePassword = async (password: string) => {
    await saveNewPassword(runtime, recoveryUser.current, password);
    recoveryUser.current = "";
    // The session from the link stays: the person is signed in with the new password (owner pick 3A).
    await refresh();
    setPhase("reset");
  };

  const resend = () =>
    run.run(async () => {
      const again = phase === "sent";
      if (again) setResent(false);
      await resendLink(runtime, { ...intent, purpose: intent.purpose || "recovery" }, REDIRECT_TO);
      setPhase("sent");
      if (again) setResent(true);
    });

  const toSignIn = () => router.replace({ pathname: "/login", params: { next: intent.next } } as never);
  const enterEmail = () =>
    router.replace({ pathname: intent.purpose === "signup" ? "/register" : "/recover", params: { next: intent.next } } as never);

  // Back, swipe and the hardware key from an outcome go where the primary button goes, never back into the form.
  const outcome = phase === "reset" || phase === "verified";
  const proceed = async () => {
    if (leaving.current) return;
    leaving.current = true;
    setLeft(true);
  };
  useEffect(() => {
    if (outcome) navigation.setOptions({ headerBackVisible: false, headerLeft: () => null, gestureEnabled: false });
  }, [outcome, navigation]);
  usePreventRemove(outcome && !left, () => void proceed());
  // Declared after the guard, so it has lifted by the time we leave.
  useEffect(() => {
    if (left) leaveFor(next.current);
  }, [left]);

  if (phase === "reset")
    return (
      <AuthOutcome
        play
        title={t("Kata sandi diganti", "Password changed")}
        body={t("Kamu sudah masuk dengan kata sandi baru.", "You're signed in with your new password.")}
        primary={{ label: t("Lanjut", "Continue"), onPress: () => void proceed() }}
      />
    );
  if (phase === "verified")
    return (
      <AuthOutcome
        play
        title={t("Email terverifikasi", "Email verified")}
        body={name ? t(`Akunmu sudah siap, ${name}.`, `Your account is ready, ${name}.`) : t("Akunmu sudah siap.", "Your account is ready.")}
        primary={{ label: t("Mulai", "Get started"), onPress: () => void proceed() }}
      />
    );
  if (phase === "recovery") return <NewPasswordForm action={action} form={form} onSave={savePassword} onBack={toSignIn} />;

  const failed = run.message ? (
    <FormError message={run.message} failureKey={run.failures} testID="identity-error" retry={action.retryable ? () => void resend() : undefined} />
  ) : null;
  if (phase === "expired")
    return (
      <ExpiredLink email={intent.email} busy={run.busy} error={failed} pose={run.code === "OFFLINE" ? "mencari" : "bingung"} onResend={() => void resend()} onEnterEmail={enterEmail} onBack={toSignIn} />
    );
  if (phase === "sent")
    return (
      <AuthScreen revealKey={run.failures}>
        <CheckEmail
          email={intent.email}
          intro={
            intent.purpose === "signup"
              ? t("Kalau email ini bisa didaftarkan, tautan verifikasi sudah kami kirim ke", "If this email can be registered, we've sent a verification link to")
              : t("Kalau email ini terdaftar, tautan pemulihan sudah kami kirim ke", "If this email has an account, we've sent a recovery link to")
          }
          resent={resent}
          resendBusy={run.busy}
          error={failed}
          onResend={() => void resend()}
          onChangeEmail={enterEmail}
        />
        <Button variant="text" label={t("Kembali ke Masuk", "Back to sign in")} style={{ alignSelf: "flex-start" }} onPress={toSignIn} />
      </AuthScreen>
    );
  return (
    <AuthScreen>
      <AuthHeading title={t("Verifikasi akun", "Verify account")} subtitle={t("Memeriksa tautan…", "Checking your link…")} pose="membaca" />
    </AuthScreen>
  );
}
