import Link from "next/link";
import { getTranslations } from "next-intl/server";
export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main className="center-page">
      <div>
        <h1>{t("notFound")}</h1>
        <Link className="button primary" href="/workspaces">
          {t("workspace")}
        </Link>
      </div>
    </main>
  );
}
