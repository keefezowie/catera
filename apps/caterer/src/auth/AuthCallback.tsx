import { useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { exchangeEmailLink, readPending, redirectFor, resendLink, saveNewPassword, useMobile } from "@catera/mobile-core";
import { AuthHeading, AuthOutcome, AuthScreen, Button, CheckEmail, ExpiredLink, FormError, NewPasswordForm } from "@catera/mobile-ui";
import { goToTab } from "../nav";
import { formPose, useAuthRun } from "./useAuthRun";

type Phase = "checking" | "recovery" | "expired" | "sent" | "reset";

/**
 * catera-dapur://auth/callback: sets a new password after recovery (the person stays signed in, then is told so).
 * Dapur has no email sign-up, so any other intent, a link with no code or an error, or no pending request on this
 * phone goes straight to the expired screen without asking the server.
 */
export function AuthCallback() {
  const { runtime, refresh, t } = useMobile();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const code = typeof params.code === "string" ? params.code : "";
  const linkError = typeof params.error === "string" ? params.error : "";
  const [phase, setPhase] = useState<Phase>("checking");
  // Only a recovery request is Dapur's to resend; anything else on file is not shown as an address.
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);
  const [left, setLeft] = useState(false);
  const recoveryUser = useRef("");
  const started = useRef(false);
  const leaving = useRef(false);
  const run = useAuthRun();

  // Only a link the server or this phone rejects is "expired"; offline keeps the link for Coba lagi (spec 7).
  const check = async () => {
    const stored = await readPending(runtime);
    if (stored?.purpose === "recovery") setEmail(stored.email);
    try {
      const link = await exchangeEmailLink(runtime, stored, { code, linkError }, ["recovery"]);
      recoveryUser.current = link.userId;
      setPhase("recovery");
    } catch (e) {
      if ((e as Error).message === "OFFLINE") throw e;
      setPhase("expired");
    }
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
      await resendLink(runtime, { purpose: "recovery", next: "/", email }, redirectFor("catera-dapur"));
      setPhase("sent");
      if (again) setResent(true);
    });

  const toSignIn = () => router.replace("/masuk" as never);
  const enterEmail = () => router.replace("/pulihkan" as never);

  // Back, swipe and the hardware key from the outcome go where Lanjut goes, never back into the form.
  const outcome = phase === "reset";
  const proceed = async () => {
    if (leaving.current) return;
    leaving.current = true;
    setLeft(true);
    // The prevention lifts on the next render; leave after it, or the router would be stopped by our own guard.
    await new Promise((r) => setTimeout(r, 0));
    goToTab("index");
  };
  useEffect(() => {
    if (outcome) navigation.setOptions({ headerBackVisible: false, headerLeft: () => null, gestureEnabled: false });
  }, [outcome, navigation]);
  usePreventRemove(outcome && !left, () => void proceed());
  useEffect(() => {
    if (!outcome) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      void proceed();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proceed only reads refs and setters
  }, [outcome]);

  if (phase === "reset")
    return (
      <AuthOutcome
        play
        title={t("Kata sandi diganti", "Password changed")}
        body={t("Kamu sudah masuk dengan kata sandi baru.", "You're signed in with your new password.")}
        primary={{ label: t("Lanjut", "Continue"), onPress: () => void proceed() }}
      />
    );
  if (phase === "recovery") return <NewPasswordForm brand="Catera Dapur" action={run} form={formPose} onSave={savePassword} onBack={toSignIn} />;

  const failed = run.message ? (
    <FormError message={run.message} failureKey={run.failures} testID="identity-error" retry={run.retryable ? () => void resend() : undefined} />
  ) : null;
  if (phase === "expired")
    return (
      <ExpiredLink
        brand="Catera Dapur"
        email={email}
        busy={run.busy}
        error={failed}
        onResend={() => void resend()}
        onEnterEmail={enterEmail}
        onBack={toSignIn}
      />
    );
  if (phase === "sent")
    return (
      <AuthScreen revealKey={run.failures}>
        <CheckEmail
          email={email}
          intro={t("Kalau email ini terdaftar, tautan pemulihan sudah kami kirim ke", "If this email has an account, we've sent a recovery link to")}
          art={null}
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
      <AuthHeading brand="Catera Dapur" title={t("Pemulihan akun", "Account recovery")} subtitle={t("Memeriksa tautan…", "Checking your link…")} />
      {run.message ? <FormError message={run.message} failureKey={run.failures} testID="identity-error" retry={() => void run.run(check)} /> : null}
    </AuthScreen>
  );
}
