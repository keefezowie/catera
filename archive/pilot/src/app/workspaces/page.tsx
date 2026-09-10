import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getWorkspaces } from "@/lib/data";
import { logout } from "@/app/actions";
import { ArrowUpRight } from "lucide-react";
export default async function Workspaces() {
  const workspaces = await getWorkspaces(),
    t = await getTranslations();
  return (
    <main className="workspace-page">
      <div className="brand-logo" />
      <h1>{t("chooseWorkspace")}</h1>
      {!workspaces.length && <p>{t("noWorkspace")}</p>}
      <div className="workspace-list">
        {workspaces.map((w) => (
          <Link
            key={w.id}
            href={
              "/w/" +
              w.slug +
              (w.role === "subscriber" ? "/home" : "/admin/today")
            }
          >
            <div>
              <h2>{w.name}</h2>
              <p>{t(w.role)}</p>
            </div>
            <ArrowUpRight />
          </Link>
        ))}
      </div>
      <form action={logout}>
        <button className="button secondary">{t("logout")}</button>
      </form>
    </main>
  );
}
