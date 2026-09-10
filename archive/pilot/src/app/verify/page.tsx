import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/auth-form";
import Link from "next/link";
export default async function Verify() {
  const t = await getTranslations();
  return (
    <main className="center-page">
      <div className="auth-form">
        <div className="brand-logo" />
        <h1>{t("verifyTitle")}</h1>
        <p>{t("verifyDescription")}</p>
        <AuthForm verify />
        <Link href="/login">{t("back")}</Link>
      </div>
    </main>
  );
}
