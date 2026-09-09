import { getLocale, getTranslations } from "next-intl/server";
import { demoEnabled } from "@/lib/demo-db";
import { demoLogin, setLocale } from "@/app/actions";
import { AuthForm } from "@/components/auth-form";
import { hostedDemoEnabled } from "@/lib/hosted-demo-config";
import { DemoSubmitButton } from "@/components/demo-submit-button";
export default async function Login({ searchParams }: {
  searchParams: Promise<{ demoError?: string }>;
}) {
  const t = await getTranslations();
  const locale = await getLocale();
  const localDemo = demoEnabled();
  const hosted = hostedDemoEnabled();
  const demo = localDemo || hosted;
  const misconfigured = !localDemo &&
    process.env.CATERA_HOSTED_DEMO_MODE === "true" && !hosted;
  const { demoError } = await searchParams;
  const description = locale === "en"
    ? "Choose a role to explore Catera. No email or password needed. This is a shared demo: changes are visible to other visitors. Use sample data only."
    : "Pilih peran untuk mencoba Catera. Tanpa email atau kata sandi. Demo ini dipakai bersama: perubahan terlihat oleh pengunjung lain. Gunakan data contoh saja.";
  const failure = locale === "en"
    ? "The demo could not be opened. Please try again in a moment."
    : "Demo belum bisa dibuka. Silakan coba lagi sebentar.";
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand-logo large" role="img" aria-label="Catera" />
        <div>
          <h1>{t("welcome")}</h1>
          <p>{t("welcomeDescription")}</p>
        </div>
        <span className="tagline">{t("foodRepeat")}</span>
      </section>
      <section className="auth-content">
        <form action={setLocale} className="auth-language">
          <button name="locale" value="id">
            ID
          </button>
          <span>/</span>
          <button name="locale" value="en">
            EN
          </button>
        </form>
        <div className="auth-form">
          <h2>{t("signIn")}</h2>
          <p className="muted">
            {hosted ? description : t(demo ? "demoDescription" : "signInDescription")}
          </p>
          {demoError && demo && <p role="alert">{failure}</p>}
          {demo ? (
            <div className="stack demo-options">
              <span className="demo-label">{t("demo")}</span>
              {(["owner", "admin", "subscriber"] as const).map((role) => (
                <form key={role} action={demoLogin}>
                  <input type="hidden" name="role" value={role} />
                  <DemoSubmitButton
                    primary={role === "owner"}
                    label={t("demo" + role[0].toUpperCase() + role.slice(1))}
                    pendingLabel={locale === "en" ? "Opening demo…" : "Membuka demo…"}
                  />
                </form>
              ))}
            </div>
          ) : misconfigured ? (
            <p role="alert">{failure}</p>
          ) : (
            <AuthForm />
          )}
        </div>
      </section>
    </main>
  );
}
