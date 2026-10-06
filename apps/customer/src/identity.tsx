import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { nativeReturnPath } from "./auth";
import { supabase, useNative } from "./context";
import { Btn, Field, Run, Screen, Txt } from "./ui";

const pendingKey = "catera.auth.pending";
const redirectTo = "catera://auth/callback";
function authError(error: { status?: number; code?: string } | null) {
  if (!error) return;
  throw new Error(
    error.status === 429
      ? "AUTH_RATE_LIMITED"
      : error.code === "email_not_confirmed"
        ? "EMAIL_NOT_CONFIRMED"
        : ["weak_password", "same_password"].includes(error.code || "")
          ? "PASSWORD_REJECTED"
          : "AUTH_UNAVAILABLE",
  );
}
function client() {
  if (!supabase) throw new Error("NOT_CONFIGURED");
  return supabase;
}
async function pending(purpose: "signup" | "recovery", next: string) {
  await SecureStore.setItemAsync(
    pendingKey,
    JSON.stringify({ purpose, next: nativeReturnPath(next), at: Date.now() }),
  );
}
export function RegistrationScreen() {
  const { next: returnTo } = useLocalSearchParams<{ next?: string }>();
  const { t } = useNative();
  const next = nativeReturnPath(returnTo);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [sent, setSent] = useState(false);
  return (
    <Screen
      title={
        sent
          ? t("Periksa email Anda", "Check your email")
          : t("Buat akun", "Create account")
      }
    >
      {sent ? (
        <>
          <Txt>
            {t(
              "Jika alamat dapat didaftarkan, tautan verifikasi telah dikirim. Buka tautan di perangkat ini, lalu kembali ke Catera. Periksa folder spam juga.",
              "If this address can be registered, a verification link has been sent. Open it on this device to return to Catera. Check your spam folder too.",
            )}
          </Txt>
          <Run
            secondary
            label={t("Kirim ulang verifikasi", "Resend verification")}
            successMessage={t(
              "Permintaan terkirim. Periksa email Anda.",
              "Request sent. Check your email.",
            )}
            action={async () => {
              await pending("signup", next);
              const { error } = await client().auth.resend({
                type: "signup",
                email: email.trim(),
                options: { emailRedirectTo: redirectTo },
              });
              if (
                ![
                  "user_not_found",
                  "email_exists",
                  "email_not_confirmed",
                ].includes(error?.code || "")
              )
                authError(error);
            }}
          />
          <Btn
            secondary
            label={t("Ubah email", "Change email")}
            onPress={() => setSent(false)}
          />
        </>
      ) : (
        <>
          <Field
            label={t("Nama", "Name")}
            value={name}
            onChangeText={setName}
            autoComplete="name"
            maxLength={100}
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={254}
          />
          <Field
            label={t("Kata sandi", "Password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={256}
          />
          <Txt kind="small">
            {t(
              "Gunakan minimal 8 karakter. Verifikasi email sebelum masuk.",
              "Use at least 8 characters. Verify your email before signing in.",
            )}
          </Txt>
          <Run
            label={t("Daftar & verifikasi email", "Sign up & verify email")}
            disabled={
              !name.trim() ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
              password.length < 8
            }
            successMessage=""
            action={async () => {
              await pending("signup", next);
              const { data, error } = await client().auth.signUp({
                email: email.trim(),
                password,
                options: {
                  data: { name: name.trim() },
                  emailRedirectTo: redirectTo,
                },
              });
              if (data.session) {
                await client().auth.signOut({ scope: "local" });
                throw new Error("NOT_CONFIGURED");
              }
              if (
                !["user_already_exists", "email_exists"].includes(
                  error?.code || "",
                )
              )
                authError(error);
              setPassword("");
              setSent(true);
            }}
          />
        </>
      )}
      <Btn
        secondary
        label={t("Sudah punya akun? Masuk", "Already registered? Sign in")}
        onPress={() => router.replace({ pathname: "/login", params: { next } })}
      />
    </Screen>
  );
}
export function RecoveryScreen() {
  const { next: returnTo } = useLocalSearchParams<{ next?: string }>();
  const { t } = useNative();
  const [email, setEmail] = useState(""),
    [sent, setSent] = useState(false);
  return (
    <Screen title={t("Pulihkan kata sandi", "Recover password")}>
      <Txt>
        {t(
          "Kami akan mengirim tautan ke email Anda. Buka tautan pada perangkat ini untuk mengatur kata sandi baru.",
          "We will email a link. Open it on this device to choose a new password.",
        )}
      </Txt>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={254}
      />
      {sent && (
        <Txt>
          {t(
            "Jika akun tersebut terdaftar, email pemulihan telah dikirim. Periksa folder spam.",
            "If the account exists, a recovery email has been sent. Check your spam folder.",
          )}
        </Txt>
      )}
      <Run
        label={
          sent
            ? t("Kirim ulang tautan", "Resend link")
            : t("Kirim tautan pemulihan", "Send recovery link")
        }
        disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
        successMessage=""
        action={async () => {
          await pending("recovery", nativeReturnPath(returnTo));
          const { error } = await client().auth.resetPasswordForEmail(
            email.trim(),
            { redirectTo },
          );
          if (error?.code !== "user_not_found") authError(error);
          setSent(true);
        }}
      />
      <Btn
        secondary
        label={t("Kembali masuk", "Back to sign in")}
        onPress={() =>
          router.replace({
            pathname: "/login",
            params: { next: nativeReturnPath(returnTo) },
          })
        }
      />
    </Screen>
  );
}
export function AuthCallbackScreen() {
  const { code, error: linkError } = useLocalSearchParams<{
    code?: string;
    error?: string;
  }>();
  const { t, refresh } = useNative();
  const [phase, setPhase] = useState<"checking" | "recovery" | "error">(
    "checking",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const next = useRef("/");
  const recoveryUser = useRef("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      // PKCE binds this one-time code to the device that requested the email.
      const raw = await SecureStore.getItemAsync(pendingKey);
      const intent = raw ? JSON.parse(raw) : null;
      if (
        !code ||
        linkError ||
        !intent ||
        Date.now() - intent.at > 60 * 60 * 1000
      )
        throw new Error("RECOVERY_EXPIRED");
      const { data, error } = await client().auth.exchangeCodeForSession(code);
      if (error || !data.user || !data.session)
        throw new Error("RECOVERY_EXPIRED");
      await SecureStore.deleteItemAsync(pendingKey);
      await SecureStore.deleteItemAsync("catera.demo.token");
      next.current = nativeReturnPath(intent.next);
      if (
        intent.purpose === "recovery" &&
        (data as typeof data & { redirectType?: string }).redirectType ===
          "recovery"
      ) {
        recoveryUser.current = data.user.id;
        setPhase("recovery");
        return;
      }
      if (intent.purpose === "recovery") throw new Error("RECOVERY_EXPIRED");
      const ensured = await client().rpc("catera_v1_command", {
        action: "profile.ensure",
        payload: {
          name: String(data.user.user_metadata?.name || "Pelanggan").slice(
            0,
            100,
          ),
        },
        request_id: Crypto.randomUUID(),
      });
      if (ensured.error) throw ensured.error;
      await refresh();
      router.replace(next.current as never);
    })().catch(() => setPhase("error"));
  }, [code, linkError, refresh]);
  return (
    <Screen
      title={
        phase === "recovery"
          ? t("Kata sandi baru", "New password")
          : t("Verifikasi akun", "Verify account")
      }
    >
      {phase === "checking" && (
        <Txt>{t("Memeriksa tautan…", "Checking your link…")}</Txt>
      )}
      {phase === "error" && (
        <>
          <Txt>
            {t(
              "Tautan tidak berlaku, sudah dipakai, atau dibuka di perangkat lain. Minta tautan baru dari perangkat ini.",
              "The link expired, was used, or was opened on another device. Request a new link from this device.",
            )}
          </Txt>
          <Btn
            label={t("Pulihkan kata sandi", "Recover password")}
            onPress={() => router.replace("/recover" as never)}
          />
          <Btn
            secondary
            label={t("Masuk / Daftar", "Sign in / Sign up")}
            onPress={() => router.replace("/login")}
          />
        </>
      )}
      {phase === "recovery" && (
        <>
          <Field
            label={t("Kata sandi baru", "New password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={256}
          />
          <Field
            label={t("Ulangi kata sandi", "Confirm password")}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={256}
          />
          <Txt kind="small">
            {t(
              "Minimal 8 karakter. Kedua isian harus sama.",
              "At least 8 characters. Both fields must match.",
            )}
          </Txt>
          <Run
            label={t("Simpan kata sandi & masuk", "Save password & sign in")}
            disabled={password.length < 8 || password !== confirm}
            successMessage=""
            action={async () => {
              const { data, error } = await client().auth.getUser();
              if (
                error ||
                !recoveryUser.current ||
                data.user?.id !== recoveryUser.current
              )
                throw new Error("RECOVERY_EXPIRED");
              authError((await client().auth.updateUser({ password })).error);
              recoveryUser.current = "";
              setPassword("");
              setConfirm("");
              authError(
                (await client().auth.signOut({ scope: "local" })).error,
              );
              router.replace({
                pathname: "/login",
                params: { next: next.current },
              });
            }}
          />
        </>
      )}
    </Screen>
  );
}
