import { redirect, permanentRedirect, notFound } from "next/navigation";
import { rpc } from "@catera/backend";
import type { Offer } from "@catera/domain";
import { session } from "@/lib/auth";
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
  "login",
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
  return {
    title:
      (
        {
          discover: "Jelajah katering",
          home: "Makanan berikutnya",
          calendar: "Jadwal makan",
          seller: "Ruang katerer",
          admin: "Catera Admin",
          login: "Masuk",
        } as Record<string, string>
      )[path[0]] || "Katering untuk hari-hari Anda",
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
  const s = await session();
  if (
    [
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
  let offers: Offer[] = [];
  let issue: string | null = null;
  try {
    offers = (
      await rpc<{ items: Offer[] }>(null, null, "catera_v1_read", {
        resource: "catalog",
        params: { limit: 100 },
      })
    ).items;
  } catch {
    issue = "NOT_CONFIGURED";
  }
  return <Application path={path} offers={offers} issue={issue} />;
}
