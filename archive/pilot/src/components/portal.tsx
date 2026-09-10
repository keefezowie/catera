"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Clock,
  UtensilsCrossed,
  ArrowLeft,
  CalendarDays,
} from "lucide-react";
import type { Snapshot } from "@/lib/types";
import {
  PageHeading,
  Quota,
  Empty,
  Status,
  useFormat,
  FormDialog,
  AddressFields,
  addressFrom,
} from "./ui";
import { PackageHistory } from "./records";
import { DeliveryDetail } from "./delivery-detail";
export function Portal({
  s,
  view,
  id,
}: {
  s: Snapshot;
  view: string;
  id?: string;
}) {
  const t = useTranslations(),
    fmt = useFormat(),
    base = "/w/" + s.business.slug,
    c = s.customers[0],
    day = new Intl.DateTimeFormat("en-CA", {
      timeZone: s.business.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(s.now));
  const upcoming = s.deliveries
      .filter(
        (d) =>
          !["cancelled", "delivered"].includes(d.status) &&
          d.service_date >= day,
      )
      .sort(
        (a, b) =>
          a.service_date.localeCompare(b.service_date) ||
          (
            s.slots.find((x) => x.id === a.slot_id)?.start_time || ""
          ).localeCompare(
            s.slots.find((x) => x.id === b.slot_id)?.start_time || "",
          ),
      ),
    next = upcoming[0];
  if (!c) return <Empty title={t("noWorkspace")} />;
  if (id) {
    const d = s.deliveries.find((d) => d.id === id);
    return (
      <div className="portal-detail">
        <Link className="back-link" href={base + "/schedule"}>
          <ArrowLeft size={16} />
          {t("schedule")}
        </Link>
        {d ? <DeliveryDetail s={s} d={d} /> : <Empty title={t("notFound")} />}
      </div>
    );
  }
  if (view === "profile")
    return (
      <>
        <PageHeading
          title={t("profile")}
          description={t("profileDescription")}
        />
        <section className="profile-surface">
          <div className="profile-person">
            <div className="large-avatar">{c.name.slice(0, 1)}</div>
            <h2>{c.name}</h2>
            <p>{c.email}</p>
          </div>
          <dl className="settings-values">
            <dt>{t("phone")}</dt>
            <dd>{c.phone || "—"}</dd>
            <dt>{t("address")}</dt>
            <dd>
              {c.address.line}
              <br />
              {c.address.city}
              <p>{c.address.instructions}</p>
            </dd>
          </dl>
          <p className="notice">{t("profileHint")}</p>
          <FormDialog
            slug={s.business.slug}
            action="profile"
            title={t("edit")}
            description={t("profileHint")}
            build={(f) => ({
              version: c.version,
              phone: String(f.get("phone") || ""),
              address: addressFrom(f),
            })}
          >
            <label>
              {t("phone")}
              <input name="phone" defaultValue={c.phone} />
            </label>
            <AddressFields address={c.address} />
          </FormDialog>
        </section>
      </>
    );
  if (view === "package")
    return (
      <>
        <PageHeading
          title={t("package")}
          description={t("myPackageDescription")}
        />
        <section className="quota-block">
          <h2>{t("quota")}</h2>
          <Quota grants={s.grants} />
        </section>
        <PackageHistory s={s} customerId={c.id} />
      </>
    );
  if (view === "schedule")
    return (
      <>
        <PageHeading title={t("schedule")} description={t("upcoming")} />
        <div className="agenda-list">
          {s.deliveries.length ? (
            s.deliveries.map((d) => (
              <Link href={base + "/deliveries/" + d.id} key={d.id}>
                <div className="agenda-date">
                  <strong>{d.service_date.slice(8)}</strong>
                  <span>
                    {fmt.date(d.service_date, true).replace(/^\d+\s*/, "")}
                  </span>
                </div>
                <div>
                  <h3>{d.menu_name || t("selectionNeeded")}</h3>
                  <p>
                    {s.slots.find((x) => x.id === d.slot_id)?.name} ·{" "}
                    {d.address.city}
                  </p>
                  <Status status={d.status} />
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))
          ) : (
            <Empty title={t("noDeliveries")} />
          )}
        </div>
      </>
    );
  return (
    <>
      <PageHeading
        title={t("home") + ", " + c.name.split(" ")[0] + "."}
        description={t("foodRepeat")}
      />
      {next ? (
        <section className="next-delivery">
          <div className="next-delivery-top">
            <h2>{t("nextDelivery")}</h2>
            <span>{fmt.date(next.service_date, true)}</span>
          </div>
          <div className="next-meal">
            <div className="meal-icon">
              <UtensilsCrossed size={30} strokeWidth={1.4} />
            </div>
            <h3>{next.menu_name || t("selectionNeeded")}</h3>
            <p>
              {s.slots.find((x) => x.id === next.slot_id)?.name} ·{" "}
              {s.slots
                .find((x) => x.id === next.slot_id)
                ?.start_time.slice(0, 5)}
            </p>
          </div>
          <div className="next-address">
            <MapPin size={17} />
            <span>
              {next.address.line}, {next.address.city}
            </span>
          </div>
          <Link
            href={base + "/deliveries/" + next.id}
            className="button cream full"
          >
            {!next.menu_id && new Date(s.now) < new Date(next.cutoff_at)
              ? t("selectMeal")
              : t("viewDetails")}
            <ArrowRight size={18} />
          </Link>
          <div className="next-cutoff">
            <Clock size={14} />
            <span>
              {t("cutoff")}: {fmt.datetime(next.cutoff_at, s.business.timezone)}
            </span>
          </div>
        </section>
      ) : (
        <Empty
          title={t("noNextDelivery")}
          description={t("noNextDescription")}
        />
      )}
      <section className="quota-block">
        <div className="section-top">
          <h2>{t("quota")}</h2>
          <Link href={base + "/package"}>
            {t("viewDetails")}
            <ArrowUpRight size={15} />
          </Link>
        </div>
        <Quota grants={s.grants} />
      </section>
      <section>
        <div className="section-top">
          <h2>{t("upcoming")}</h2>
          <Link href={base + "/schedule"}>
            {t("viewAll")}
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="agenda-list compact">
          {upcoming.slice(0, 4).map((d) => (
            <Link href={base + "/deliveries/" + d.id} key={d.id}>
              <div className="agenda-date">
                <strong>{d.service_date.slice(8)}</strong>
                <span>
                  {fmt.date(d.service_date, true).replace(/^\d+\s*/, "")}
                </span>
              </div>
              <div>
                <h3>{d.menu_name || t("selectionNeeded")}</h3>
                <p>{s.slots.find((x) => x.id === d.slot_id)?.name}</p>
              </div>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
