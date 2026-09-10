"use client";
import { useTranslations } from "next-intl";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations();
  return (
    <main className="center-page">
      <div>
        <h1>{t("loadError")}</h1>
        <p>{t("noWorkspace")}</p>
        <button className="button primary" onClick={reset}>
          {t("retry")}
        </button>{" "}
        <Link href="/workspaces">{t("workspace")}</Link>
      </div>
    </main>
  );
}
