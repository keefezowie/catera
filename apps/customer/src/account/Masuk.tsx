import { use, useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { NavigationContext } from "expo-router/react-navigation";
import { type Actor } from "@catera/domain";
import { isAppleSignInAvailable, resendLink as resendEmailLink, useMobile } from "@catera/mobile-core";
import {
  authFields,
  AuthHeading,
  AuthScreen,
  AuthSwitch,
  Button,
  CheckEmail,
  Field,
  FormError,
  PasswordField,
  ProviderButton,
  Text,
  useColors,
  useFieldCheck,
} from "@catera/mobile-ui";
import { nativeReturnPath } from "../auth";
import { leaveFor } from "../nav";
import { useFlowOptions } from "../stack";
import { clearPending, redirectTo } from "./emailAuth";
import { authFailure, canRetry } from "./failure";
import { LegalLine } from "./LegalLine";
import { Lengkapi, lengkapiNeeded, type LengkapiInfo } from "./Lengkapi";
import { emailCheck, useFormPose, useRateWait } from "./useAuthRun";

type Which = "apple" | "google" | "email" | "resend" | "demo";
type Kind = "apple" | "google" | "email" | "link" | "demo";

/** Apple, Google or email from one screen: the providers first, email and password on request. */
export function Masuk() {
  const { runtime, t, locale, signedIn, refresh } = useMobile();
  const c = useColors();
  const params = useLocalSearchParams<{ next?: string; email?: string; method?: string }>();
  const next = nativeReturnPath(typeof params.next === "string" ? params.next : undefined);
  // Daftar's "Masuk dengan email ini" arrives with the address, and the claim's email button with method=email.
  const prefill = typeof params.email === "string" ? params.email : "";
  const [emailStep, setEmailStep] = useState(!!prefill || params.method === "email");
  const apple = useAppleAvailable();
  const [email, setEmail] = useState(prefill);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Which action is waiting, so only its button shows the spinner.
  const [waiting, setWaiting] = useState<Which | "">("");
  // The failing step's code; the sentence is worded at render, so a countdown stays live.
  const [fail, setFail] = useState("");
  const [failures, setFailures] = useState(0);
  const [badLogins, setBadLogins] = useState(0);
  // "Cek emailmu" in place of the form, after an unverified address asked for a new link.
  const [mail, setMail] = useState(false);
  const [resent, setResent] = useState(false);
  const [lengkapi, setLengkapi] = useState<LengkapiInfo | null>(null);
  const lock = useRef(false);
  // The last step by name, re-run through the latest render's handlers so a retry reads what is typed now.
  const lastKind = useRef<Kind | null>(null);
  const latest = useRef<Record<Kind, () => unknown>>(null as never);
  const refocusPassword = useRef(false);
  const rate = useRateWait();
  const form = useFormPose(fail, failures);

  // The email step has one nav row, as drawn: its own back to the providers in the page, and no header Close above it.
  // Read from context, not useNavigation(), so Masuk also renders outside a navigator (tests, previews).
  const navigation = use(NavigationContext);
  const flow = useFlowOptions();
  useEffect(() => {
    if (!navigation || !emailStep) return;
    navigation.setOptions({ headerLeft: () => null });
    return () => navigation.setOptions({ headerLeft: flow("modal").headerLeft });
  }, [navigation, emailStep, flow]);
  // Android's back on the email step returns to the providers before it ever closes Masuk.
  useEffect(() => {
    if (!emailStep || mail || lengkapi) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setEmailStep(false);
      return true;
    });
    return () => sub.remove();
  }, [emailStep, mail, lengkapi]);

  const emailChecks = useFieldCheck({
    email: { value: email, check: emailCheck(t) },
    // Only empty is wrong: an old 6-character password must still sign in.
    password: { value: password, check: (v) => (v ? "" : t("Isi kata sandimu dulu.", "Enter your password first.")) },
  });
  const emailProps = emailChecks.fieldProps("email");
  const passwordProps = emailChecks.fieldProps("password");

  // Moving between the providers and the email step clears a failure, but never ends the rate wait early.
  useEffect(() => {
    setFail((f) => (f === "AUTH_RATE_LIMITED" ? f : ""));
    form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset is a stable setState pair
  }, [emailStep]);
  // After a wrong password the cleared field takes focus once it is editable again.
  useEffect(() => {
    if (!busy && refocusPassword.current) {
      refocusPassword.current = false;
      passwordProps.inputRef.current?.focus();
    }
  }, [busy, passwordProps.inputRef]);

  async function run(step: () => Promise<void>, kind: Kind, which: Which) {
    if (lock.current) return;
    lock.current = true;
    lastKind.current = kind;
    setBusy(true);
    setWaiting(which);
    setFail("");
    try {
      await step();
      setBadLogins(0);
    } catch (e) {
      const failed = (e as { code?: string }).code || (e as Error).message;
      // Closing the Google page or the Apple sheet is the person's choice, not a failure.
      if (failed === "CANCELLED") return;
      setFail(failed);
      setFailures((n) => n + 1);
      setBadLogins((n) => (failed === "INVALID_CREDENTIALS" ? n + 1 : 0));
      if (failed === "AUTH_RATE_LIMITED") rate.restart();
      if (failed === "INVALID_CREDENTIALS") {
        setPassword("");
        // The emptied password is the app's doing, not a skipped field: no "Isi kata sandimu dulu." beside the FormError.
        emailChecks.reset();
        refocusPassword.current = true;
      }
    } finally {
      lock.current = false;
      setBusy(false);
      setWaiting("");
    }
  }

  // Signed in by any route: Lengkapi akun first when the account still needs it, then where the person was going.
  const finish = async (actor: Actor, provider = false) => {
    // A provider sign-in replaced Supabase's PKCE verifier, so a sign-up link still pending here can no longer be
    // exchanged: forget it, and that link lands on the plain expired screen instead of a half-finished one.
    if (provider) await clearPending(runtime).catch(() => undefined);
    await signedIn(actor);
    const need = await lengkapiNeeded(runtime, actor);
    if (need) setLengkapi(need);
    else leaveFor(next);
  };

  const signInApple = () => run(async () => finish(await runtime.signInWithApple(Crypto.randomUUID()), true), "apple", "apple");
  const signInGoogle = () =>
    run(async () => finish(await runtime.signInWithGoogle(redirectTo(), Crypto.randomUUID()), true), "google", "google");
  const signInEmail = () =>
    run(async () => finish(await runtime.signInPassword(email, password, Crypto.randomUUID(), "Pelanggan")), "email", "email");
  const demoLogin = () =>
    run(
      async () => {
        await runtime.demoLogin("customer");
        await refresh();
        leaveFor(next);
      },
      "demo",
      "demo",
    );
  // Unverified: a new sign-up link right here, then "Cek emailmu" for that address.
  const resendLink = () =>
    run(
      async () => {
        const again = mail;
        if (again) setResent(false);
        await resendEmailLink(runtime, { purpose: "signup", next, email: email.trim() }, redirectTo());
        setMail(true);
        if (again) setResent(true);
      },
      "link",
      "resend",
    );
  latest.current = { apple: signInApple, google: signInGoogle, email: signInEmail, link: resendLink, demo: demoLogin };

  const limited = fail === "AUTH_RATE_LIMITED";
  const wait = limited ? rate.left : 0;
  const message = limited ? rate.message(wait) : fail ? authFailure({ code: fail }, locale, t) : "";
  const retryKind = lastKind.current;
  const formError = message ? (
    <FormError
      message={message}
      failureKey={failures}
      testID="masuk-error"
      retry={canRetry(fail, locale) && retryKind ? () => void latest.current[retryKind]() : undefined}
      action={
        fail === "EMAIL_NOT_CONFIRMED"
          ? { label: t("Kirim ulang tautan", "Resend link"), onPress: () => void resendLink() }
          : fail === "INVALID_CREDENTIALS" && badLogins >= 2
            ? { label: t("Lupa kata sandi?", "Forgot password?"), onPress: () => router.push({ pathname: "/recover", params: { next } } as never) }
            : undefined
      }
    />
  ) : null;
  const label = (normal: string) => rate.label(normal, wait);

  if (lengkapi) return <Lengkapi info={lengkapi} onDone={() => leaveFor(next)} />;

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

  if (!emailStep)
    return (
      <AuthScreen revealKey={failures} footer={<LegalLine />}>
        <AuthHeading
          title={t("Masuk ke Catera", "Sign in to Catera")}
          subtitle={t(
            "Masuk atau daftar dengan satu akun untuk langganan, jadwal, dan pembayaranmu.",
            "One account for your subscriptions, deliveries and payments. No account yet? We'll make one.",
          )}
          pose={form.pose}
        />
        <SignInProviders
          apple={apple}
          waiting={waiting}
          busy={busy}
          disabled={wait > 0}
          onApple={() => void signInApple()}
          onGoogle={() => void signInGoogle()}
          onEmail={() => setEmailStep(true)}
        />
        {formError}
        {__DEV__ ? (
          <View style={{ gap: 8 }}>
            <Text variant="caption">{t("Demo (data contoh)", "Demo (sample data)")}</Text>
            <Button
              variant="secondary"
              label={t("Masuk sebagai pelanggan demo", "Sign in as demo customer")}
              busy={waiting === "demo"}
              disabled={busy && waiting !== "demo"}
              onPress={() => void demoLogin()}
            />
          </View>
        ) : null}
      </AuthScreen>
    );

  return (
    <AuthScreen
      revealKey={failures}
      footer={
        <View style={{ gap: 12 }}>
          <AuthSwitch
            prompt={t("Belum punya akun?", "No account yet?")}
            action={t("Daftar dengan email", "Sign up with email")}
            onPress={() => router.push({ pathname: "/register", params: { next } } as never)}
          />
          <Button
            label={label(t("Masuk", "Sign in"))}
            busy={waiting === "email"}
            disabled={wait > 0}
            onPress={() => form.press(emailChecks, () => void signInEmail())}
          />
        </View>
      }
    >
      <Pressable
        testID="masuk-back"
        accessibilityRole="button"
        accessibilityLabel={t("Kembali ke pilihan masuk", "Back to sign-in options")}
        onPress={() => setEmailStep(false)}
        android_ripple={{ color: c.line, borderless: true, radius: 24 }}
        style={{ width: 48, height: 48, justifyContent: "center", marginLeft: -12, alignItems: "center" }}
      >
        <Ionicons name={process.env.EXPO_OS === "ios" ? "chevron-back" : "arrow-back"} size={24} color={c.charcoal} />
      </Pressable>
      <AuthHeading
        title={t("Masuk dengan email", "Sign in with email")}
        subtitle={t("Pakai email dan kata sandi akun Catera-mu.", "Use the email and password of your Catera account.")}
        pose={form.pose}
      />
      <View style={{ gap: 14 }}>
        <Field
          label="Email"
          {...authFields.email}
          {...emailProps}
          value={email}
          onChangeText={form.edit(setEmail)}
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
          onSubmitEditing={() => form.press(emailChecks, () => void signInEmail())}
          value={password}
          onChangeText={form.edit(setPassword)}
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
      {formError}
    </AuthScreen>
  );
}

/** Whether Sign in with Apple is offered on this device: iOS only, and only when the device says so. */
export function useAppleAvailable() {
  const [apple, setApple] = useState(false);
  useEffect(() => {
    let live = true;
    void isAppleSignInAvailable().then((ok) => live && setApple(ok), () => undefined);
    return () => {
      live = false;
    };
  }, []);
  return apple;
}

/** Apple (only where the device offers it), Google and email, each a 52 pill; only the pressed one waits. */
export function SignInProviders({
  apple,
  waiting,
  busy,
  disabled,
  onApple,
  onGoogle,
  onEmail,
}: {
  apple: boolean;
  waiting: string;
  busy: boolean;
  disabled?: boolean;
  onApple: () => void;
  onGoogle: () => void;
  onEmail: () => void;
}) {
  const { t } = useMobile();
  return (
    <View style={{ gap: 12, marginTop: 16 }}>
      {apple ? (
        <ProviderButton
          provider="apple"
          label={t("Lanjut dengan Apple", "Continue with Apple")}
          busy={waiting === "apple"}
          disabled={disabled || (busy && waiting !== "apple")}
          onPress={onApple}
        />
      ) : null}
      <ProviderButton
        provider="google"
        label={t("Lanjut dengan Google", "Continue with Google")}
        busy={waiting === "google"}
        disabled={disabled || (busy && waiting !== "google")}
        onPress={onGoogle}
      />
      <ProviderButton
        provider="email"
        label={t("Lanjut dengan email", "Continue with email")}
        disabled={busy}
        onPress={onEmail}
      />
    </View>
  );
}
