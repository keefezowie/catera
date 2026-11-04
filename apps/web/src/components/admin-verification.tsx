"use client";
import { useState } from "react";
import { api, useApp } from "./context";
import { Button, TextInput } from "./form-controls";
import { ActionForm, Field } from "./ui";

/**
 * Catera Admin opens only after a TOTP check (security audit 2026-11-04, M3): the database refuses admin reads and
 * actions to a password-only session, so this step comes first. A first visit sets up the authenticator app; later
 * visits ask for the current six-digit code. A verified code upgrades the session cookie, and the page reloads into
 * Admin.
 */
export function AdminVerification({ enrolled }: { enrolled: boolean }) {
  const { t } = useApp();
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const codeField = (
    <Field label={t("Kode dari aplikasi autentikator", "Code from your authenticator app")}>
      <TextInput
        name="code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        autoComplete="one-time-code"
        required
      />
    </Field>
  );
  const verify = async (form: FormData) => {
    await api.request("auth/mfa-verify", {
      code: String(form.get("code") || "").trim(),
      ...(setup ? { factorId: setup.factorId } : {}),
    });
    location.assign("/admin");
  };
  return (
    <div className="login-layout">
      <section className="login-form">
        <h1>{t("Verifikasi dua langkah", "Two-step verification")}</h1>
        {enrolled ? (
          <>
            <p>
              {t(
                "Catera Admin memegang pembayaran dan pencairan. Masukkan kode 6 angka dari aplikasi autentikator kamu.",
                "Catera Admin handles payments and payouts. Enter the 6-digit code from your authenticator app.",
              )}
            </p>
            <ActionForm submit={t("Verifikasi", "Verify")} onSubmit={verify}>
              {codeField}
            </ActionForm>
          </>
        ) : setup ? (
          <>
            <p>
              {t(
                "Pindai kode QR ini dengan aplikasi autentikator (misalnya Google Authenticator atau 1Password), lalu masukkan kode 6 angka yang muncul.",
                "Scan this QR code with an authenticator app (for example Google Authenticator or 1Password), then enter the 6-digit code it shows.",
              )}
            </p>
            <img
              className="admin-mfa-qr"
              src={setup.qr}
              width={200}
              height={200}
              alt={t("Kode QR untuk aplikasi autentikator", "QR code for your authenticator app")}
            />
            <details>
              <summary>{t("Tidak bisa memindai? Masukkan kunci ini", "Can't scan? Enter this key instead")}</summary>
              <code className="admin-mfa-secret">{setup.secret}</code>
            </details>
            <ActionForm submit={t("Aktifkan dan masuk", "Turn on and continue")} onSubmit={verify}>
              {codeField}
            </ActionForm>
          </>
        ) : (
          <>
            <p>
              {t(
                "Catera Admin memegang pembayaran dan pencairan, jadi setiap admin memakai aplikasi autentikator selain kata sandi. Siapkan sekali, lalu masukkan kodenya setiap kali masuk.",
                "Catera Admin handles payments and payouts, so every admin uses an authenticator app as well as a password. Set it up once, then enter its code each time you sign in.",
              )}
            </p>
            <ActionForm
              submit={t("Siapkan aplikasi autentikator", "Set up authenticator app")}
              onSubmit={async () => {
                setSetup(await api.request("auth/mfa-enroll", {}));
              }}
            >
              <span className="sr-only">{t("Mulai penyiapan", "Start setup")}</span>
            </ActionForm>
          </>
        )}
        <p className="small muted">
          {t(
            "Kehilangan aplikasi autentikator? Minta operator Catera menghapus faktornya di dasbor Supabase, lalu siapkan lagi.",
            "Lost your authenticator app? Ask a Catera operator to remove the factor in the Supabase dashboard, then set it up again.",
          )}
        </p>
        <Button
          type="button"
          variant="text"
          onClick={async () => {
            await api.request("auth/logout", {});
            location.assign("/login");
          }}
        >
          {t("Keluar", "Sign out")}
        </Button>
      </section>
    </div>
  );
}
