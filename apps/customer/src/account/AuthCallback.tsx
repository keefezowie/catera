import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import * as Crypto from "expo-crypto";
import { authClient, ensureActor, exchangeEmailLink, isOffline, readPending, resendLink, saveNewPassword, useMobile, type EmailLink } from "@catera/mobile-core";
import { AuthHeading, AuthOutcome, AuthScreen, Button, CheckEmail, ExpiredLink, FormError, NewPasswordForm } from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { redirectTo } from "./emailAuth";
import { canRetry } from "./failure";
import { useAuthRun, useFormPose } from "./useAuthRun";
import { leaveFor } from "../nav";
import { Lengkapi, lengkapiNeeded, type LengkapiInfo } from "./Lengkapi";

type Phase = "checking" | "recovery" | "expired" | "sent" | "reset" | "verified";
/** What this phone remembers about the link it asked for; empty when it asked for none. */
type Intent = { purpose: "signup" | "recovery" | ""; email: string; next: string };

/**
 * catera://auth/callback: finishes email verification (then says so), or sets a new password after recovery (the
 * person stays signed in, then is told so). A link with no code or with an error goes straight to the expired screen
 * without asking the server (audit C-3). A code with no pending email request on this phone is tried once as a Google
 * sign-in that arrived as a deep link; if Supabase refuses it, the expired screen shows.
 */
export function AuthCallback() {
  const { runtime, actor, refresh, signedIn, t, locale } = useMobile();
  const [lengkapi, setLengkapi] = useState<LengkapiInfo | null>(null);
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
  // A good link whose account set-up did not finish: Coba lagi re-runs the set-up, not the spent code.
  const exchanged = useRef<EmailLink | null>(null);
  // A Google code whose session is in but whose profile set-up did not finish: Coba lagi re-runs only the set-up.
  const providerName = useRef<string | null>(null);
  const run = useAuthRun();
  const form = useFormPose(run.code, run.failures);
  const action = { ...run, retryable: canRetry(run.code, locale) };

  // The account behind a verified sign-up link, then the signed-in actor.
  const finish = async (link: EmailLink) => {
    const ensured = await authClient(runtime)
      .rpc("catera_v1_command", {
        action: "profile.ensure",
        payload: { name: link.name || "Pelanggan" },
        request_id: Crypto.randomUUID(),
      })
      .then(
        (r) => r,
        (error: unknown) => ({ error }),
      );
    if (ensured.error) throw new Error(isOffline(ensured.error) ? "OFFLINE" : "AUTH_UNAVAILABLE");
    await refresh();
    setName(link.name);
    setPhase("verified");
  };

  // The profile behind a Google code, then the signed-in actor, Lengkapi akun when needed, and Beranda.
  const finishProvider = async (given: string) => {
    let signed;
    try {
      signed = await ensureActor(authClient(runtime), given || "Pelanggan", Crypto.randomUUID());
    } catch (e) {
      throw new Error(isOffline(e) ? "OFFLINE" : "AUTH_UNAVAILABLE");
    }
    providerName.current = null;
    await signedIn(signed);
    leaving.current = true;
    const need = await lengkapiNeeded(runtime, signed);
    if (need) setLengkapi(need);
    else setLeft(true);
  };

  // Only a link the server or this phone rejects is "expired". Offline keeps the link for Coba lagi; a failure after a
  // good exchange keeps the session and retries the set-up (spec 7).
  const check = async () => {
    if (exchanged.current) return finish(exchanged.current);
    if (providerName.current !== null) return finishProvider(providerName.current);
    const stored = await readPending(runtime);
    // No email link was asked for on this phone: the code can be a Google sign-in whose redirect reached the app as a
    // deep link (Android reported the Custom Tab closed first, or the app was killed while it was open).
    if (!stored && code && !linkError) {
      const client = authClient(runtime);
      const { data, error } = await client.auth
        .exchangeCodeForSession(code)
        .catch((e: unknown) => ({ data: { user: null, session: null }, error: e }));
      if (error && isOffline(error)) throw new Error("OFFLINE");
      if (error || !data.session) {
        setPhase("expired");
        return;
      }
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      providerName.current = String(meta.full_name || meta.name || "");
      return finishProvider(providerName.current);
    }
    if (stored) {
      next.current = nativeReturnPath(stored.next);
      setIntent({ purpose: stored.purpose, email: stored.email, next: next.current });
    }
    let link: EmailLink;
    try {
      link = await exchangeEmailLink(runtime, stored, { code, linkError });
    } catch (e) {
      if ((e as Error).message === "OFFLINE") throw e;
      setPhase("expired");
      return;
    }
    if (link.purpose === "recovery") {
      recoveryUser.current = link.userId;
      setPhase("recovery");
      return;
    }
    exchanged.current = link;
    await finish(link);
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run.run(check);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, for the link that opened the screen
  }, []);

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
      await resendLink(runtime, { ...intent, purpose: intent.purpose || "recovery" }, redirectTo());
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
    // A first sign-in by link: Lengkapi akun before the destination, when the account still needs it.
    const need = await lengkapiNeeded(runtime, actor);
    if (need) setLengkapi(need);
    else setLeft(true);
  };
  useEffect(() => {
    if (outcome) navigation.setOptions({ headerBackVisible: false, headerLeft: () => null, gestureEnabled: false });
  }, [outcome, navigation]);
  usePreventRemove(outcome && !left, () => void proceed());
  // Declared after the guard, so it has lifted by the time we leave.
  useEffect(() => {
    if (left) leaveFor(next.current);
  }, [left]);

  if (lengkapi) return <Lengkapi info={lengkapi} onDone={() => setLeft(true)} />;
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
        primary={{ label: t("Ke Beranda", "Go to Home"), onPress: () => void proceed() }}
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
              ? t("Kalau emailnya bisa dipakai, kami kirim tautan verifikasi ke", "If this email can be used, we'll send a verification link to")
              : t("Kalau emailnya terdaftar, kami kirim tautan pemulihan ke", "If this email has an account, we'll send a recovery link to")
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
    <AuthScreen revealKey={run.failures}>
      <AuthHeading
        title={t("Verifikasi akun", "Verify account")}
        subtitle={t("Memeriksa tautan…", "Checking your link…")}
        pose={!run.message ? "membaca" : run.code === "OFFLINE" ? "mencari" : "melambai"}
      />
      {run.message ? (
        <FormError message={run.message} failureKey={run.failures} testID="identity-error" retry={() => void run.run(check)} />
      ) : null}
    </AuthScreen>
  );
}
