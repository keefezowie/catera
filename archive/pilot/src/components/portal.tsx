"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Clock,
  UtensilsCrossed,
  ArrowLeft,
} from "lucide-react";
import type { Snapshot, Delivery } from "@/lib/types";
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
    [scheduleTab, setScheduleTab] = useState<"upcoming" | "history">(
      "upcoming",
    ),
    base = "/w/" + s.business.slug,
    c = s.customers[0],
    day = new Intl.DateTimeFormat("en-CA", {
      timeZone: s.business.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(s.now));
  const upcoming = s.deliveries
      .filter((d) => !["cancelled", "delivered"].includes(d.status))
      .sort(
        (a, b) =>
          a.service_date.localeCompare(b.service_date) ||
          (
            s.slots.find((x) => x.id === a.slot_id)?.start_time || ""
          ).localeCompare(
            s.slots.find((x) => x.id === b.slot_id)?.start_time || "",
          ),
      ),
    next = upcoming[0],
    history = s.deliveries
      .filter((d) => ["cancelled", "delivered"].includes(d.status))
      .sort(
        (a, b) =>
          b.service_date.localeCompare(a.service_date) ||
          (
            s.slots.find((x) => x.id === b.slot_id)?.start_time || ""
          ).localeCompare(
            s.slots.find((x) => x.id === a.slot_id)?.start_time || "",
          ),
      ),
    scheduleRows = scheduleTab === "upcoming" ? upcoming : history,
    scheduleGroups = [
      ...scheduleRows.reduce((groups, delivery) => {
        const rows = groups.get(delivery.service_date) || [];
        rows.push(delivery);
        groups.set(delivery.service_date, rows);
        return groups;
      }, new Map<string, Delivery[]>()),
    ],
    selectionNeeded = upcoming
      .filter((d) => !d.menu_id && new Date(s.now) < new Date(d.cutoff_at))
      .sort((a, b) => a.cutoff_at.localeCompare(b.cutoff_at))[0];
  const selectionDefault = selectionNeeded
    ? s.menus.find(
        (menu) =>
          menu.id ===
          s.offerings.find(
            (offering) =>
              offering.service_date === selectionNeeded.service_date &&
              offering.slot_id === selectionNeeded.slot_id &&
              offering.is_default,
          )?.menu_id,
      )
    : undefined;
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
        <PageHeading
          title={t("schedule")}
          description={t("portalScheduleDescription")}
        />
        <div
          className="schedule-switch"
          role="group"
          aria-label={t("schedule")}
        >
          <button
            className="button secondary"
            aria-pressed={scheduleTab === "upcoming"}
            onClick={() => setScheduleTab("upcoming")}
          >
            {t("upcoming")} <span>{upcoming.length}</span>
          </button>
          <button
            className="button secondary"
            aria-pressed={scheduleTab === "history"}
            onClick={() => setScheduleTab("history")}
          >
            {t("history")} <span>{history.length}</span>
          </button>
        </div>
        {scheduleRows.length ? (
          <div className="customer-planning">
            <nav
              className="planning-dates"
              aria-label={t("portalPlanningDates")}
            >
              {scheduleGroups.map(([date]) => (
                <a key={date} href={"#delivery-day-" + date}>
                  <strong>{date.slice(8)}</strong>
                  <span>{fmt.date(date, true).replace(/^\d+\s*/, "")}</span>
                </a>
              ))}
            </nav>
            <div className="planning-days">
              {scheduleGroups.map(([date, deliveries]) => (
                <section
                  className="planning-day"
                  key={date}
                  id={"delivery-day-" + date}
                  aria-labelledby={"delivery-heading-" + date}
                >
                  <div className="planning-day-heading">
                    <h2 id={"delivery-heading-" + date}>{fmt.date(date)}</h2>
                    {scheduleTab === "upcoming" && date < day && (
                      <p className="overdue-note">{t("portalOverdue")}</p>
                    )}
                  </div>
                  <div className="agenda-list">
                    {deliveries.map((d) => {
                      const slot = s.slots.find((x) => x.id === d.slot_id);
                      const open = new Date(s.now) < new Date(d.cutoff_at);
                      return (
                        <Link href={base + "/deliveries/" + d.id} key={d.id}>
                          <div className="agenda-date">
                            <strong>{slot?.start_time.slice(0, 5)}</strong>
                            <span>{slot?.name}</span>
                          </div>
                          <div>
                            <h3>{d.menu_name || t("selectionNeeded")}</h3>
                            <p>{d.address.city}</p>
                            {!["cancelled", "delivered"].includes(d.status) && (
                              <p className="planning-cutoff">
                                {t(
                                  open
                                    ? "portalEditableUntil"
                                    : "portalChangesClosed",
                                )}{" "}
                                ·{" "}
                                {fmt.datetime(d.cutoff_at, s.business.timezone)}
                              </p>
                            )}
                          </div>
                          <Status status={d.status} />
                          <ArrowUpRight size={18} />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <Empty
            title={t(
              scheduleTab === "history"
                ? "portalNoHistory"
                : "portalNoUpcoming",
            )}
            description={t(
              scheduleTab === "history"
                ? "portalNoHistoryHint"
                : "portalNoUpcomingHint",
            )}
          />
        )}
      </>
    );
  return (
    <>
      <PageHeading
        title={t("home") + ", " + c.name.split(" ")[0] + "."}
        description={t("foodRepeat")}
      />
      {selectionNeeded && (
        <div className="notice selection-notice">
          <Clock size={18} />
          <div>
            <strong>{t("portalMenuAttention")}</strong>
            <p>
              {fmt.date(selectionNeeded.service_date, true)} · {t("cutoff")}:{" "}
              {fmt.datetime(selectionNeeded.cutoff_at, s.business.timezone)}
            </p>
            <p className="selection-outcome">
              {selectionDefault
                ? t("portalPublishedDefaultOutcome", {
                    menu: selectionDefault.name,
                  })
                : t("portalNoDefaultAttention")}
            </p>
          </div>
          <Link
            className="button primary"
            href={base + "/deliveries/" + selectionNeeded.id}
          >
            {t("selectMeal")}
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <div className="customer-overview">
        {next ? (
          <section className="next-delivery">
            <div className="next-delivery-top">
              <h2>{t("nextDelivery")}</h2>
              <span>{fmt.date(next.service_date, true)}</span>
            </div>
            <Status status={next.status} />
            {next.service_date < day && (
              <p className="overdue-note">{t("portalOverdue")}</p>
            )}
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
                {t(
                  new Date(s.now) < new Date(next.cutoff_at)
                    ? "portalEditableUntil"
                    : "portalChangesClosed",
                )}{" "}
                · {fmt.datetime(next.cutoff_at, s.business.timezone)}
              </span>
            </div>
          </section>
        ) : (
          <Empty
            title={t("noNextDelivery")}
            description={t("portalNoUpcomingHint")}
          />
        )}
        <div className="customer-planning-summary">
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
          <section className="customer-upcoming">
            <div className="section-top">
              <h2>{t("upcoming")}</h2>
              <Link href={base + "/schedule"}>
                {t("viewAll")}
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="agenda-list compact">
              {upcoming
                .filter((d) => d.id !== next?.id)
                .slice(0, 3)
                .map((d) => (
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
                        {s.slots
                          .find((x) => x.id === d.slot_id)
                          ?.start_time.slice(0, 5)}
                      </p>
                      {d.service_date < day && (
                        <p className="overdue-note">{t("portalOverdue")}</p>
                      )}
                    </div>
                    <ArrowUpRight size={18} />
                  </Link>
                ))}
              {upcoming.length < 2 && (
                <p className="planning-empty">{t("portalNoOtherDeliveries")}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
