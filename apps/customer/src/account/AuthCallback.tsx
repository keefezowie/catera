import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { useMobile } from "@catera/mobile-core";
import { AuthHeading, AuthOutcome, AuthScreen, CheckEmail, ExpiredLink, FormError, NewPasswordForm } from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { authClient, authError, clearPending, readPending, REDIRECT_TO, savePending } from "./emailAuth";
import { canRetry } from "./failure";
import { useAuthRun } from "./useAuthRun";
import { leaveFor } from "../nav";

/** An email link is good for an hour, on the phone that asked for it. */
const LINK_LIFETIME_MS = 60 * 60 * 1000;

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
      if (!code || linkError || !stored || Date.now() - stored.at > LINK_LIFETIME_MS) throw new Error("RECOVERY_EXPIRED");
      const client = authClient(runtime);
      // PKCE binds this one-time code to the device that requested the email.
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error || !data.user || !data.session) throw new Error("RECOVERY_EXPIRED");
      await SecureStore.deleteItemAsync(runtime.storageKey("demo.token"));
      const redirectType = (data as typeof data & { redirectType?: string | null }).redirectType;
      if (stored.purpose === "recovery") {
        // Only a real recovery link may set a password, whatever the local intent says.
        if (redirectType !== "recovery") throw new Error("RECOVERY_EXPIRED");
        recoveryUser.current = data.user.id;
        setPhase("recovery");
        return;
      }
      await clearPending(runtime);
      const display = String(data.user.user_metadata?.name || "").slice(0, 100);
      const ensured = await client.rpc("catera_v1_command", {
        action: "profile.ensure",
        payload: { name: display || "Pelanggan" },
        request_id: Crypto.randomUUID(),
      });
      if (ensured.error) throw ensured.error;
      await refresh();
      setName(display);
      setPhase("verified");
    })().catch(() => setPhase("expired"));
  }, [code, linkError, refresh, runtime]);

  const savePassword = async (password: string) => {
    const client = authClient(runtime);
    const { data, error } = await client.auth.getUser();
    if (error || !recoveryUser.current || data.user?.id !== recoveryUser.current) throw new Error("RECOVERY_EXPIRED");
    authError((await client.auth.updateUser({ password })).error);
    recoveryUser.current = "";
    // The session from the link stays: the person is signed in with the new password (owner pick 3A).
    await clearPending(runtime);
    await refresh();
    setPhase("reset");
  };

  const resend = () =>
    run.run(async () => {
      const again = phase === "sent";
      if (again) setResent(false);
      await savePending(runtime, intent.purpose as "signup" | "recovery", intent.next, intent.email);
      const client = authClient(runtime);
      if (intent.purpose === "signup") {
        const { error } = await client.auth.resend({ type: "signup", email: intent.email, options: { emailRedirectTo: REDIRECT_TO } });
        if (!["user_not_found", "email_exists", "email_not_confirmed"].includes(error?.code || "")) authError(error);
      } else {
        const { error } = await client.auth.resetPasswordForEmail(intent.email, { redirectTo: REDIRECT_TO });
        if (error?.code !== "user_not_found") authError(error);
      }
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
    // The prevention lifts on the next render; leave after it, or the router would be stopped by our own guard.
    await new Promise((r) => setTimeout(r, 0));
    leaveFor(next.current);
  };
  useEffect(() => {
    if (outcome) navigation.setOptions({ headerBackVisible: false, headerLeft: () => null, gestureEnabled: false });
  }, [outcome, navigation]);
  usePreventRemove(outcome && !left, () => void proceed());

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
  if (phase === "recovery") return <NewPasswordForm action={action} onSave={savePassword} />;

  const failed = run.message ? (
    <FormError message={run.message} failureKey={run.failures} testID="identity-error" retry={action.retryable ? () => void resend() : undefined} />
  ) : null;
  if (phase === "expired")
    return (
      <ExpiredLink email={intent.email} busy={run.busy} error={failed} onResend={() => void resend()} onEnterEmail={enterEmail} onBack={toSignIn} />
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
      </AuthScreen>
    );
  return (
    <AuthScreen>
      <AuthHeading title={t("Verifikasi akun", "Verify account")} subtitle={t("Memeriksa tautan…", "Checking your link…")} pose="membaca" />
    </AuthScreen>
  );
}
