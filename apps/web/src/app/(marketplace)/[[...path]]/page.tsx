import { cache } from "react";
import { redirect, permanentRedirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { demoEnabled } from "@catera/backend";
import { catalog } from "@/lib/catalog-cache";
import type { Offer } from "@catera/domain";
import { pageSession, supabase } from "@/lib/auth";
import { adminMfaState } from "@/lib/admin-mfa";
import { AdminVerification } from "@/components/admin-verification";
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
// Metadata and page share one catalog read per render.
const pageCatalog = cache(() => catalog());
// The only routes whose components read `offers` (Messages also opens inside /seller/support); the rest ship without them.
const readsCatalog = (path: string[]) =>
  [
    "",
    "search",
    "locations",
    "categories",
    "packages",
    "caterers",
    "compare",
    "saved",
    "checkout",
    "messages",
  ].includes(path[0] || "") ||
  (path[0] === "seller" && path[1] === "support");
export async function generateMetadata({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const english = (await cookies()).get("catera_locale")?.value === "en";
  const named =
    path[1] && (path[0] === "packages" || path[0] === "caterers")
      ? await pageCatalog().catch((): Offer[] => [])
      : [];
  return {
    title:
      (path[0] === "packages"
        ? named.find((o) => o.slug === path[1] || o.id === path[1])?.name
        : named.find((o) => o.catererSlug === path[1])?.caterer) ||
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
              packages: "Package details",
              caterers: "Caterer profile",
              compare: "Compare packages",
              checkout: "Checkout",
              payment: "Payment",
              messages: "Messages",
              account: "Account",
              addresses: "Addresses",
              subscriptions: "Subscriptions",
              deliveries: "Deliveries",
              notifications: "Notifications",
              support: "Support",
              renew: "Renew your subscription",
              claim: "Connect your subscription",
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
              packages: "Detail paket",
              caterers: "Profil katering",
              compare: "Bandingkan paket",
              checkout: "Selesaikan pesanan",
              payment: "Pembayaran",
              messages: "Pesan",
              account: "Akun",
              addresses: "Alamat",
              subscriptions: "Langganan",
              deliveries: "Pengantaran",
              notifications: "Notifikasi",
              support: "Bantuan",
              renew: "Perpanjang langganan",
              claim: "Sambungkan langganan",
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
  const catalogRead = readsCatalog(path)
    ? pageCatalog().then(
        (items): { offers: Offer[]; issue: string | null } => ({ offers: items, issue: null }),
        () => ({ offers: [], issue: "NOT_CONFIGURED" }),
      )
    : { offers: [], issue: null };
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
  // These pages show one record. Without its id they asked the API for "undefined"; send people to the list instead.
  if (!path[1]) {
    if (path[0] === "deliveries") redirect("/calendar");
    if (path[0] === "payment" || path[0] === "renew") redirect("/subscriptions");
    if (path[0] === "packages" || path[0] === "caterers") redirect("/#packages");
    if (path[0] === "claim") notFound();
  }
  if (path[0] === "admin" && s.actor?.role !== "platform_admin") notFound();
  // The database answers admin reads only for a TOTP-verified session, so Admin opens after that step.
  if (path[0] === "admin" && !demoEnabled()) {
    const mfa = await adminMfaState(await supabase());
    if (!mfa.verified) return <AdminVerification enrolled={mfa.enrolled} />;
  }
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
