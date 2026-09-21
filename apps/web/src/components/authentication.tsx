"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, useApp } from "./context";
import { Button, TextInput } from "./form-controls";
import { ActionForm, Field } from "./ui";
import { signedInPath, safeReturnPath } from "@/lib/navigation";
import type { Actor } from "@catera/domain";
import {
  EmailRegistration,
  RecoveryForm,
  PasswordField,
  useCooldown,
} from "./registration";
export function Login({
  mode = "login",
}: {
  mode?: "login" | "register" | "forgot-password" | "reset-password";
}) {
  const { demo, t } = useApp();
  const q = useSearchParams();
  const [phone, setPhone] = useState(""),
    [sent, setSent] = useState(false),
    [method, setMethod] = useState<"email" | "phone">("email");
  const registering = mode === "register";
  const recovery = mode === "forgot-password" || mode === "reset-password";
  const [remaining, cooldown] = useCooldown();
  const next = safeReturnPath(q.get("next")) || "/home";
  return (
    <div className="login-layout">
      <section className="login-story">
        <img src="/assets/welcome.png" alt="Maskot Catera menyambut Anda" />
        <h1>
          {t("Hari yang baik,", "A good day,")}
          <br />
          {t("dimulai dari makan.", "starts with a good meal.")}
        </h1>
        <p>
          {t(
            "Satu tempat untuk makanan favorit dan jadwal yang lebih teratur.",
            "One place for your favorite meals and a more effortless routine.",
          )}
        </p>
      </section>
      <section className="login-form">
        <h2>
          {registering
            ? t("Buat akun Catera", "Create your Catera account")
            : recovery
              ? t("Pulihkan akun", "Recover your account")
              : t("Selamat datang di Catera", "Welcome to Catera")}
        </h2>
        {q.get("error") && (
          <p role="alert" className="notice">
            {t(
              "Tautan tidak valid atau kedaluwarsa. Minta tautan baru di bawah.",
              "This link is invalid or expired. Request a new link below.",
            )}
          </p>
        )}
        {q.get("reset") === "success" && (
          <p role="status" className="notice">
            {t(
              "Kata sandi diperbarui. Silakan masuk kembali.",
              "Password updated. Please sign in again.",
            )}
          </p>
        )}
        <p>
          {t(
            "Makanan enak untuk hari-harimu yang sibuk.",
            "Good meals for your busy everyday.",
          )}
        </p>
        {recovery ? (
          <RecoveryForm reset={mode === "reset-password"} next={next} />
        ) : demo ? (
          <>
            <div className="notice">
              {t(
                "Pilih peran untuk menjelajahi demo. Semua akun menggunakan data sintetis.",
                "Choose a role to explore. All accounts use synthetic data.",
              )}
            </div>
            <div className="demo-roles">
              {[
                [
                  "customer",
                  "Jelajah sebagai pelanggan",
                  "Explore as customer",
                ],
                ["owner", "Masuk sebagai pemilik", "Sign in as owner"],
                ["staff", "Masuk sebagai staf", "Sign in as staff"],
                [
                  "platform_admin",
                  "Masuk ke Catera Admin",
                  "Open Catera Admin",
                ],
              ].map(([role, id, en]) => (
                <ActionForm
                  key={role}
                  submit={t(id, en)}
                  onSubmit={async () => {
                    await api.request("auth/demo", { role });
                    location.assign(
                      role === "owner" || role === "staff"
                        ? "/seller"
                        : role === "platform_admin"
                          ? "/admin"
                          : next,
                    );
                  }}
                >
                  <span className="sr-only">{role}</span>
                </ActionForm>
              ))}
            </div>
          </>
        ) : (
          <>
            <div
              className="auth-methods"
              aria-label={t("Metode masuk", "Sign-in method")}
            >
              <Button
                type="button"
                aria-pressed={method === "email"}
                onClick={() => setMethod("email")}
              >
                {t("Email & kata sandi", "Email & password")}
              </Button>
              <Button
                type="button"
                aria-pressed={method === "phone"}
                onClick={() => setMethod("phone")}
              >
                {t("Kode ponsel", "Phone code")}
              </Button>
            </div>
            {method === "email" && registering ? (
              <EmailRegistration next={next} />
            ) : method === "email" ? (
              <ActionForm
                key="email-login"
                submit={t("Masuk", "Sign in")}
                onSubmit={async (form) => {
                  const result = await api.request<{ actor: Actor }>(
                    "auth/password",
                    {
                      email: form.get("email"),
                      password: form.get("password"),
                    },
                  );
                  location.assign(signedInPath(result.actor, q.get("next")));
                }}
              >
                <Field label={t("Email", "Email")}>
                  <TextInput
                    type="email"
                    name="email"
                    autoComplete="username"
                    placeholder={t("nama@contoh.com", "name@example.com")}
                    required
                    maxLength={254}
                  />
                </Field>
                <PasswordField />
                <Link
                  href={"/forgot-password?next=" + encodeURIComponent(next)}
                >
                  {t("Lupa kata sandi?", "Forgot password?")}
                </Link>
              </ActionForm>
            ) : (
              <ActionForm
                key="phone-login"
                disabled={!sent && remaining > 0}
                submit={
                  sent
                    ? t("Verifikasi & masuk", "Verify & sign in")
                    : remaining
                      ? t(
                          `Kirim ulang (${remaining} dtk)`,
                          `Resend (${remaining}s)`,
                        )
                      : t("Kirim kode OTP", "Send OTP code")
                }
                onSubmit={async (f) => {
                  if (!sent) {
                    await api.request("auth/send", {
                      phone,
                      intent: registering ? "register" : "login",
                    });
                    setSent(true);
                    cooldown();
                  } else {
                    await api.request("auth/verify", {
                      phone,
                      token: f.get("token"),
                      name: registering ? f.get("name") : undefined,
                    });
                    const result = await api.request<{ actor: Actor }>("me");
                    location.assign(signedInPath(result.actor, q.get("next")));
                  }
                }}
              >
                <Field label={t("Nomor WhatsApp / ponsel", "Mobile number")}>
                  <TextInput
                    type="tel"
                    name="phone"
                    placeholder="+6281234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoComplete="tel"
                    disabled={sent}
                  />
                </Field>
                {sent && (
                  <>
                    <Field label={t("Kode OTP", "Verification code")}>
                      <TextInput
                        name="token"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        autoComplete="one-time-code"
                        required
                      />
                    </Field>
                    {registering && (
                      <Field label={t("Nama", "Name")}>
                        <TextInput
                          name="name"
                          autoComplete="name"
                          required
                          maxLength={100}
                        />
                      </Field>
                    )}
                    <Button
                      type="button"
                      className="text-button"
                      onClick={() => setSent(false)}
                    >
                      {t("Ubah nomor / kirim ulang", "Change number / resend")}
                    </Button>
                  </>
                )}
              </ActionForm>
            )}
          </>
        )}
        {!recovery && (
          <p>
            <Link
              href={
                (registering ? "/login" : "/register") +
                "?next=" +
                encodeURIComponent(next)
              }
            >
              {registering
                ? t(
                    "Sudah punya akun? Masuk",
                    "Already have an account? Sign in",
                  )
                : t("Belum punya akun? Daftar", "New here? Create an account")}
            </Link>
          </p>
        )}
        <p className="small muted">
          {t(
            "Dengan masuk, Anda dapat mengelola paket, jadwal, dan percakapan di satu tempat.",
            "Sign in to manage packages, schedules, and conversations in one place.",
          )}
        </p>
      </section>
    </div>
  );
}
