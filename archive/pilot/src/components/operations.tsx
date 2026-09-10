"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpRight,
  CalendarDays,
  ChefHat,
  Truck,
  X,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import type { Snapshot, Delivery, ProductionEntry } from "@/lib/types";
import {
  PageHeading,
  Status,
  Empty,
  useFormat,
  FormDialog,
  downloadCsv,
} from "./ui";
import { DeliveryDetail } from "./delivery-detail";
function localDate(now: string, zone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}
export function Operations({ s, view }: { s: Snapshot; view: string }) {
  const t = useTranslations(),
    fmt = useFormat(),
    query = useSearchParams(),
    router = useRouter(),
    [search, setSearch] = useState(""),
    [slot, setSlot] = useState(""),
    [page, setPage] = useState(0);
  const date = query.get("date") || localDate(s.now, s.business.timezone),
    base = "/w/" + s.business.slug + "/admin/",
    selected = s.deliveries.find((d) => d.id === query.get("delivery"));
  const rows = s.deliveries.filter(
      (d) => d.service_date === date && (!slot || d.slot_id === slot),
    ),
    active = rows.filter((d) => d.status !== "cancelled");
  const filtered = rows.filter((d) =>
    (
      s.customers.find((c) => c.id === d.customer_id)?.name +
      " " +
      (d.menu_name || "")
    )
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const changeDate = (d: string) => {
    setPage(0);
    router.push(base + view + "?date=" + d);
  };
  const shiftDate = (n: number) => {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    changeDate(d.toISOString().slice(0, 10));
  };
  const dateControls = (
    <div className="date-controls">
      <button
        className="icon-button"
        aria-label={t("previous")}
        onClick={() => shiftDate(-1)}
      >
        <ChevronLeft size={18} />
      </button>
      <label className="date-input">
        <CalendarDays size={17} />
        <input
          aria-label={t("selectedDate")}
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) changeDate(e.target.value);
          }}
        />
      </label>
      <button
        className="icon-button"
        aria-label={t("next")}
        onClick={() => shiftDate(1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
  return (
    <>
      <PageHeading
        title={view === "today" ? t("greeting") : t(view)}
        description={t(view + "Description")}
      >
        {dateControls}
      </PageHeading>
      <div className="daily-overview">
        <div>
          <strong>{fmt.date(date)}</strong>
          <span>
            {active.length} {t("scheduledToday")}
            <span className="summary-divider">/</span>
            {active.filter((d) => !d.menu_id).length}{" "}
            {t("menuMissing").toLowerCase()}
          </span>
        </div>
        <Status
          status={
            active.length && active.every((d) => d.status === "delivered")
              ? "delivered"
              : "scheduled"
          }
        />
      </div>
      <div
        className="cycle-tabs"
        role="navigation"
        aria-label={t("operations")}
      >
        {[
          ["schedule", CalendarDays],
          ["production", ChefHat],
          ["delivery", Truck],
        ].map(([key, Icon]) => {
          const k = key as string,
            Component = Icon as typeof CalendarDays;
          return (
            <Link
              key={k}
              href={base + k + "?date=" + date}
              className={
                view === k || (view === "today" && k === "schedule")
                  ? "active"
                  : ""
              }
            >
              <Component size={18} />
              <span>{t(k)}</span>
              <small>
                {k === "schedule"
                  ? active.length
                  : k === "production"
                    ? new Set(active.map((d) => d.menu_id).filter(Boolean)).size
                    : active.filter((d) => d.status === "delivered").length +
                      "/" +
                      active.length}
              </small>
            </Link>
          );
        })}
      </div>
      {view === "production" ? (
        <ProductionView s={s} date={date} slot={slot} setSlot={setSlot} />
      ) : (
        <section className="list-surface">
          <div className="list-toolbar">
            <h2>{t(view === "delivery" ? "delivery" : "schedule")}</h2>
            <div className="filter-controls">
              <label className="search-control">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder={t("search")}
                  aria-label={t("search")}
                />
              </label>
              <select
                aria-label={t("slots")}
                value={slot}
                onChange={(e) => {
                  setSlot(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">{t("allSlots")}</option>
                {s.slots.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {filtered.length ? (
            <>
              <div className="table-scroll">
                <table className="delivery-table">
                  <thead>
                    <tr>
                      <th>{t("customer")}</th>
                      <th>{t("meal")}</th>
                      <th>{t("slots")}</th>
                      <th>{t("status")}</th>
                      <th>
                        <span className="sr-only">{t("viewDetails")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(page * 20, page * 20 + 20).map((d) => {
                      const c = s.customers.find((x) => x.id === d.customer_id);
                      return (
                        <tr key={d.id}>
                          <td>
                            <Link
                              href={
                                base +
                                view +
                                "?date=" +
                                date +
                                "&delivery=" +
                                d.id
                              }
                              className="customer-link"
                            >
                              <span className="customer-avatar">
                                {c?.name
                                  .split(" ")
                                  .map((p) => p[0])
                                  .slice(0, 2)
                                  .join("")}
                              </span>
                              <span>
                                <strong>{c?.name}</strong>
                                <small>{d.address.city}</small>
                              </span>
                            </Link>
                          </td>
                          <td>
                            <span className={!d.menu_id ? "missing-menu" : ""}>
                              {d.menu_name || t("menuMissing")}
                            </span>
                            {d.selection_source === "default" && (
                              <small className="table-note">
                                {t("defaultMeal")}
                              </small>
                            )}
                          </td>
                          <td>
                            {s.slots.find((x) => x.id === d.slot_id)?.name}
                          </td>
                          <td>
                            <Status status={d.status} />
                          </td>
                          <td>
                            <Link
                              className="icon-button"
                              href={
                                base +
                                view +
                                "?date=" +
                                date +
                                "&delivery=" +
                                d.id
                              }
                              aria-label={t("viewDetails") + " " + c?.name}
                            >
                              <ArrowUpRight size={18} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  {filtered.length} {t("deliveriesUnit")}
                </span>
                <div>
                  <button
                    className="icon-button"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                    aria-label={t("previous")}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <span>
                    {page + 1} / {Math.ceil(filtered.length / 20)}
                  </span>
                  <button
                    className="icon-button"
                    disabled={(page + 1) * 20 >= filtered.length}
                    onClick={() => setPage(page + 1)}
                    aria-label={t("next")}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Empty
              title={t("noDeliveries")}
              description={t("noDeliveriesDescription")}
            >
              <Link className="button secondary" href={base + "customers"}>
                {t("createSchedule")}
                <ArrowUpRight size={16} />
              </Link>
            </Empty>
          )}
        </section>
      )}
      {view === "today" && (
        <div className="daily-footer">
          <div>
            <ChefHat size={24} />
            <div>
              <h3>{t("production")}</h3>
              <p>
                {active.filter((d) => !!d.menu_id).length} / {active.length}{" "}
                {t("productionReady")}
              </p>
            </div>
          </div>
          <Link href={base + "production?date=" + date}>
            {t("viewProduction")}
            <ArrowRight size={18} />
          </Link>
        </div>
      )}
      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open)
            router.push(base + view + "?date=" + date, { scroll: false });
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="detail-drawer">
            <div className="drawer-header">
              <Dialog.Title>{t("viewDetails")}</Dialog.Title>
              <Dialog.Close asChild>
                <button className="icon-button" aria-label={t("close")}>
                  <X />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              {t("deliverySummary")}
            </Dialog.Description>
            {selected && <DeliveryDetail s={s} d={selected} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {view === "delivery" && <ManifestLinks s={s} date={date} />}
    </>
  );
}
function ProductionView({
  s,
  date,
  slot,
  setSlot,
}: {
  s: Snapshot;
  date: string;
  slot: string;
  setSlot: (s: string) => void;
}) {
  const t = useTranslations(),
    fmt = useFormat(),
    [revision, setRevision] = useState(""),
    chosenSlot = slot || s.slots[0]?.id;
  const versions = s.production
      .filter((p) => p.service_date === date && p.slot_id === chosenSlot)
      .sort((a, b) => b.revision - a.revision),
    version = versions.find((v) => v.id === revision) || versions[0];
  const live = s.deliveries
    .filter(
      (d) =>
        d.service_date === date &&
        d.slot_id === chosenSlot &&
        d.status !== "cancelled",
    )
    .map((d) => ({
      id: d.id,
      customer_id: d.customer_id,
      customer: s.customers.find((c) => c.id === d.customer_id)?.name || "",
      menu: d.menu_name,
      menu_id: d.menu_id,
      address: d.address,
    }));
  const entries = version?.entries || live,
    totals = new Map<string, number>();
  entries.forEach((e) =>
    totals.set(
      e.menu || t("menuMissing"),
      (totals.get(e.menu || t("menuMissing")) || 0) + 1,
    ),
  );
  function csv() {
    if (!version) return;
    downloadCsv("catera-" + date + "-v" + version.revision + ".csv", [
      [
        s.business.name,
        date,
        s.slots.find((x) => x.id === chosenSlot)?.name,
        t("revision"),
        version.revision,
      ],
      [version.created_at],
      [t("date"), t("revision"), t("customer"), t("meal"), t("address")],
      ...entries.map((e) => [
        date,
        version.revision,
        e.customer,
        e.menu || t("menuMissing"),
        e.address.line + ", " + e.address.city,
      ]),
    ]);
  }
  return (
    <section className="production-view">
      <div className="list-toolbar">
        <div className="production-title">
          <h2>{t(version ? "frozen" : "livePreview")}</h2>
          {version && (
            <Status status={version.incomplete ? "incomplete" : "complete"} />
          )}
        </div>
        <div className="filter-controls">
          <select
            aria-label={t("slots")}
            value={chosenSlot}
            onChange={(e) => {
              setSlot(e.target.value);
              setRevision("");
            }}
          >
            {s.slots.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          {version && (
            <select
              aria-label={t("revision")}
              value={version.id}
              onChange={(e) => setRevision(e.target.value)}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {t("revision")} {v.revision}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {version ? (
        <div className="production-version-bar">
          <span>
            {fmt.datetime(version.created_at, s.business.timezone)} ·{" "}
            {t("revision")} {version.revision}
          </span>
          <div>
            <button className="button ghost" onClick={() => window.print()}>
              <Printer size={16} />
              {t("print")}
            </button>
            <button className="button ghost" onClick={csv}>
              <Download size={16} />
              {t("export")}
            </button>
          </div>
        </div>
      ) : (
        <div className="notice">
          <ClockIcon />
          <p>{t("productionWait")}</p>
          <FormDialog
            slug={s.business.slug}
            action="freeze"
            title={t("freeze")}
            build={() => ({ service_date: date, slot_id: chosenSlot })}
            description={t("productionWait")}
          />
        </div>
      )}
      {!!(version?.incomplete || live.filter((x) => !x.menu).length) && (
        <div className="notice warning">
          <AlertCircle size={18} />
          <p>{t("missingDefault")}</p>
          <Link href={"/w/" + s.business.slug + "/admin/menus"}>
            {t("publishMenu")}
          </Link>
        </div>
      )}
      {!entries.length ? (
        <Empty title={t("noDeliveries")} />
      ) : (
        <>
          <div className="production-totals">
            {[...totals].map(([name, count]) => (
              <div className="production-total" key={name}>
                <ChefHat size={22} />
                <strong>{name}</strong>
                <span>
                  <b>{count}</b> {t("mealsUnit")}
                </span>
              </div>
            ))}
          </div>
          <h3 className="section-heading">{t("sourceDeliveries")}</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("customer")}</th>
                  <th>{t("meal")}</th>
                  <th>{t("address")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.customer}</td>
                    <td>{e.menu || t("menuMissing")}</td>
                    <td>
                      {e.address.line}, {e.address.city}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {version && (
        <details className="revision-diff">
          <summary>
            {t("changes")} · {version.changes.length}
          </summary>
          {version.revision === 1 ? (
            <p>{t("noChanges")}</p>
          ) : (
            version.changes.map((c) => (
              <div key={c.id}>
                <strong>{c.after?.customer || c.before?.customer}</strong>
                <p>
                  {c.before?.menu || "—"} → {c.after?.menu || "—"}
                </p>
                <small>
                  {c.before?.address.line} → {c.after?.address.line}
                </small>
              </div>
            ))
          )}
        </details>
      )}
    </section>
  );
}
function ClockIcon() {
  return <CalendarDays size={18} />;
}
function ManifestLinks({ s, date }: { s: Snapshot; date: string }) {
  const t = useTranslations();
  const versions = s.slots
    .map(
      (slot) =>
        s.production
          .filter((p) => p.service_date === date && p.slot_id === slot.id)
          .sort((a, b) => b.revision - a.revision)[0],
    )
    .filter(Boolean);
  return (
    <div className="manifest-links">
      {versions.map((v) => (
        <div key={v.id}>
          <span>
            {s.slots.find((x) => x.id === v.slot_id)?.name} · {t("revision")}{" "}
            {v.revision}
          </span>
          <a
            className="button secondary"
            target="_blank"
            rel="noreferrer"
            href={"/api/exports/" + v.id + "?business=" + s.business.slug}
          >
            <Printer size={16} />
            {t("print")}
          </a>
          <a
            className="button secondary"
            href={
              "/api/exports/" +
              v.id +
              "?business=" +
              s.business.slug +
              "&format=csv"
            }
          >
            <Download size={16} />
            {t("export")}
          </a>
        </div>
      ))}
    </div>
  );
}
