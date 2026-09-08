import { getTranslations } from "next-intl/server";
import { demoEnabled } from "@/lib/demo-db";
import { demoLogin, setLocale } from "@/app/actions";
import { AuthForm } from "@/components/auth-form";
export default async function Login() {
  const t = await getTranslations(),
    demo = demoEnabled();
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
            {t(demo ? "demoDescription" : "signInDescription")}
          </p>
          {demo ? (
            <div className="stack demo-options">
              <span className="demo-label">{t("demo")}</span>
              {(["owner", "admin", "subscriber"] as const).map((role) => (
                <form key={role} action={demoLogin}>
                  <input type="hidden" name="role" value={role} />
                  <button
                    className={
                      "button full " +
                      (role === "owner" ? "primary" : "secondary")
                    }
                  >
                    {t("demo" + role[0].toUpperCase() + role.slice(1))}
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <AuthForm />
          )}
        </div>
      </section>
    </main>
  );
}
