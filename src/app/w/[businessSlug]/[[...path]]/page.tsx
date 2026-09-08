import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSnapshot } from "@/lib/data";
import { demoEnabled } from "@/lib/demo-db";
import { Shell } from "@/components/shell";
import { Operations } from "@/components/operations";
import { Customers, Packages, Menus } from "@/components/records";
import { Settings } from "@/components/settings";
import { Portal } from "@/components/portal";
import { DeliveryDetail } from "@/components/delivery-detail";
export const dynamic = "force-dynamic";
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ businessSlug: string; path?: string[] }>;
}) {
  const { businessSlug, path = [] } = await params;
  const s = await getSnapshot(businessSlug);
  if (!path.length)
    redirect(
      "/w/" +
        businessSlug +
        (s.role === "subscriber" ? "/home" : "/admin/today"),
    );
  let content: React.ReactNode;
  if (s.role === "subscriber") {
    if (
      !["home", "schedule", "package", "profile", "deliveries"].includes(
        path[0],
      )
    )
      notFound();
    content = (
      <Portal
        s={s}
        view={path[0]}
        id={path[0] === "deliveries" ? path[1] : undefined}
      />
    );
  } else {
    if (path[0] !== "admin") redirect("/w/" + businessSlug + "/admin/today");
    const view = path[1] || "today";
    if (["today", "schedule", "production", "delivery"].includes(view))
      content = <Operations s={s} view={view} />;
    else if (view === "customers") content = <Customers s={s} id={path[2]} />;
    else if (view === "packages") content = <Packages s={s} />;
    else if (view === "menus") content = <Menus s={s} />;
    else if (view === "settings") content = <Settings s={s} />;
    else if (view === "deliveries") {
      const d = s.deliveries.find((x) => x.id === path[2]);
      if (!d) notFound();
      content = (
        <div className="standalone-detail">
          <Link
            className="back-link"
            href={
              "/w/" + businessSlug + "/admin/schedule?date=" + d.service_date
            }
          >
            ← {s.business.name}
          </Link>
          <DeliveryDetail s={s} d={d} />
        </div>
      );
    } else notFound();
  }
  return (
    <Shell snapshot={s} demo={demoEnabled()}>
      {content}
    </Shell>
  );
}
