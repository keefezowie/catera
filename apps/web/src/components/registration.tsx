"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, useApp } from "./context";
import { ActionForm, Field } from "./ui";
import { Button, TextInput } from "./form-controls";

export function PasswordField({ creating = false }: { creating?: boolean }) {
  const { t } = useApp();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Field
        label={
          creating
            ? t("Kata sandi baru", "New password")
            : t("Kata sandi", "Password")
        }
      >
        <TextInput
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={creating ? "new-password" : "current-password"}
          minLength={creating ? 8 : 1}
          maxLength={256}
          required
        />
      </Field>
      <Button
        type="button"
        className="text-button"
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible
          ? t("Sembunyikan kata sandi", "Hide password")
          : t("Tampilkan kata sandi", "Show password")}
      </Button>
      {creating && (
        <p className="small muted">
          {t("Gunakan minimal 8 karakter.", "Use at least 8 characters.")}
        </p>
      )}
    </>
  );
}

export function useCooldown() {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(
      () => setRemaining((n) => Math.max(0, n - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [remaining]);
  return [remaining, () => setRemaining(60)] as const;
}

export function EmailRegistration({ next }: { next: string }) {
  const { t } = useApp();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resendOnly, setResendOnly] = useState(false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [remaining, cooldown] = useCooldown();
  useEffect(() => {
    if (sent) statusRef.current?.focus();
  }, [sent]);
  if (sent)
    return (
      <section aria-label={t("Verifikasi email", "Verify email")}>
        <p ref={statusRef} tabIndex={-1} role="status" className="notice">
          {t(
            "Periksa email Anda. Jika alamat ini dapat didaftarkan, tautan verifikasi akan dikirim ke",
            "Check your email. If this address can be registered, a verification link will be sent to",
          )}{" "}
          <strong>{email}</strong>.
        </p>
        <p>
          {t(
            "Periksa juga folder spam. Jika sudah punya akun, silakan masuk atau pulihkan kata sandi.",
            "Check your spam folder too. If you already have an account, sign in or recover your password.",
          )}
        </p>
        <ActionForm
          submit={
            remaining
              ? t(`Kirim ulang (${remaining} dtk)`, `Resend (${remaining}s)`)
              : t("Kirim ulang email", "Resend email")
          }
          disabled={remaining > 0}
          onSubmit={async () => {
            await api.request("auth/resend", { email, next });
            cooldown();
          }}
        >
          <span className="sr-only">
            {t("Kirim ulang verifikasi", "Resend verification")}
          </span>
        </ActionForm>
        <div className="auth-followups">
          <Button
            type="button"
            className="text-button"
            onClick={() => setSent(false)}
          >
            {t("Ubah email", "Change email")}
          </Button>
          <Link href="/forgot-password">
            {t("Pulihkan kata sandi", "Recover password")}
          </Link>
        </div>
      </section>
    );
  return (
    <>
      <ActionForm
        key={String(resendOnly)}
        submit={
          resendOnly
            ? t("Kirim ulang verifikasi", "Resend verification")
            : t("Buat akun", "Create account")
        }
        disabled={resendOnly && remaining > 0}
        onSubmit={async (form) => {
          await api.request(resendOnly ? "auth/resend" : "auth/register", {
            name: form.get("name"),
            email,
            password: form.get("password"),
            next,
          });
          setSent(true);
          cooldown();
        }}
      >
        {!resendOnly && (
          <Field label={t("Nama", "Name")}>
            <TextInput
              name="name"
              autoComplete="name"
              required
              maxLength={100}
            />
          </Field>
        )}
        <Field label="Email">
          <TextInput
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        {!resendOnly && <PasswordField creating />}
      </ActionForm>
      <Button
        type="button"
        className="text-button"
        onClick={() => setResendOnly(!resendOnly)}
      >
        {resendOnly
          ? t("Buat akun baru", "Create a new account")
          : t(
              "Sudah mendaftar? Kirim ulang verifikasi",
              "Already registered? Resend verification",
            )}
      </Button>
    </>
  );
}

export function RecoveryForm({
  reset,
  next,
}: {
  reset: boolean;
  next: string;
}) {
  const { t } = useApp();
  const [sent, setSent] = useState(false);
  const [remaining, cooldown] = useCooldown();
  return (
    <>
      {sent && (
        <p role="status" className="notice">
          {t(
            "Jika email tersebut terdaftar, kami akan mengirim tautan pemulihan. Periksa kotak masuk dan folder spam.",
            "If that email is registered, we will send a recovery link. Check your inbox and spam folder.",
          )}
        </p>
      )}
      <ActionForm
        submit={
          reset
            ? t("Simpan kata sandi", "Save password")
            : remaining
              ? t(`Kirim ulang (${remaining} dtk)`, `Resend (${remaining}s)`)
              : t("Kirim tautan pemulihan", "Send recovery link")
        }
        disabled={!reset && remaining > 0}
        onSubmit={async (form) => {
          if (reset) {
            await api.request("auth/reset-password", {
              password: form.get("password"),
            });
            location.assign("/login?reset=success");
          } else {
            await api.request("auth/recover", { email: form.get("email") });
            setSent(true);
            cooldown();
          }
        }}
      >
        {reset ? (
          <PasswordField creating />
        ) : (
          <Field label="Email">
            <TextInput
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </Field>
        )}
      </ActionForm>
      {reset && (
        <Link href="/forgot-password">
          {t("Minta tautan pemulihan baru", "Request a new recovery link")}
        </Link>
      )}
      <p>
        <Link href={"/login?next=" + encodeURIComponent(next)}>
          {t("Kembali ke halaman masuk", "Back to sign in")}
        </Link>
      </p>
    </>
  );
}
