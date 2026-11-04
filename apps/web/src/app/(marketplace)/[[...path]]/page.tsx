import { redirect, permanentRedirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { catalog } from "@/lib/catalog-cache";
import type { Offer } from "@catera/domain";
import { pageSession } from "@/lib/auth";
import { resolveWorkspace, workspaceCookieName } from "@/lib/workspace";
import { Application } from "@/components/application";
export const dynamic = "force-dynamic";
const routes = [
  "",
  "discover",
  "search",
  "locations",
  "categories",
  "packages",
  "caterers",
  "compare",
  "saved",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "home",
  "calendar",
  "subscriptions",
  "deliveries",
  "messages",
  "account",
  "addresses",
  "notifications",
  "support",
  "checkout",
  "renew",
  "claim",
  "payment",
  "seller",
  "admin",
  "brand",
];
export async function generateMetadata({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const english = (await cookies()).get("catera_locale")?.value === "en";
  return {
    title:
      (
        (english
          ? {
              discover: "Explore catering",
              home: "Home",
              saved: "Saved packages",
              calendar: "Meal calendar",
              seller: "Caterer workspace",
              admin: "Catera Admin",
              login: "Sign in",
              register: "Create an account",
              "forgot-password": "Recover your account",
              "reset-password": "Set a new password",
            }
          : {
              discover: "Jelajah katering",
              home: "Beranda",
              saved: "Paket tersimpan",
              calendar: "Jadwal makan",
              seller: "Dapur",
              admin: "Catera Admin",
              login: "Masuk",
              register: "Buat akun",
              "forgot-password": "Pulihkan akun",
              "reset-password": "Buat kata sandi baru",
            }) as Record<string, string>
      )[path[0]] ||
      (english
        ? "Catering subscriptions"
        : "Paket katering berlangganan"),
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path = [] } = await params;
  if (!routes.includes(path[0] || "")) notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      query.append(key, item);
  }
  if (path[0] === "discover")
    permanentRedirect(
      "/" + (query.size ? "?" + query.toString() : "") + "#packages",
    );
  // The catalog read does not depend on the session, so it starts now instead of after the session and redirect checks.
  const catalogRead = catalog().then(
    (items): { offers: Offer[]; issue: string | null } => ({ offers: items, issue: null }),
    () => ({ offers: [], issue: "NOT_CONFIGURED" }),
  );
  const [s, jar] = await Promise.all([pageSession(), cookies()]);
  const workspace = resolveWorkspace(
    s.actor,
    jar.get(workspaceCookieName)?.value,
  );
  if (path.length === 0 && workspace === "caterer") redirect("/seller");
  // /claim is open without a session: the link's holder sees the package first and
  // signs in with the SMS code there (spec §5.1).
  if (
    [
      "checkout",
      "saved",
      "renew",
      "payment",
      "home",
      "calendar",
      "subscriptions",
      "deliveries",
      "messages",
      "account",
      "addresses",
      "notifications",
      "support",
      "seller",
      "admin",
    ].includes(path[0]) &&
    !s.actor
  )
    redirect(
      "/login?next=" +
        encodeURIComponent(
          "/" + path.join("/") + (query.size ? "?" + query.toString() : ""),
        ),
    );
  if (path[0] === "admin" && s.actor?.role !== "platform_admin") notFound();
  if (
    path[0] === "seller" &&
    !["owner", "staff"].includes(s.actor?.role || "") &&
    path[1] !== "onboarding"
  )
    notFound();
  if (
    path[0] === "seller" &&
    path[1] !== "onboarding" &&
    workspace !== "caterer"
  )
    redirect("/");
  if (path[0] === "seller" && path[1] === "capacity")
    redirect("/seller/packages");
  const { offers, issue } = await catalogRead;
  return <Application path={path} offers={offers} issue={issue} />;
}
