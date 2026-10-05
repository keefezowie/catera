"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
  DateInput,
  downloadCsv,
} from "./ui";
import { DeliveryDetail } from "./delivery-detail";
import { OperationsBatch } from "./operations-batch";
import {
  batchBlocker,
  dailyGuidance,
  productionReadyIds,
} from "./operations-batch-model";
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
    [slot, setSlot] = useState(
      s.slots.some((slot) => slot.id === query.get("slot"))
        ? query.get("slot") || ""
        : "",
    ),
    [page, setPage] = useState(0),
    [selection, setSelection] = useState<string[]>([]),
    [navigationPending, startNavigation] = useTransition(),
    [navigationDate, setNavigationDate] = useState<string | null>(null),
    opener = useRef<HTMLElement | null>(null),
    openerSelector = useRef<string | null>(null),
    lastDeliveryId = useRef(query.get("delivery")),
    region = useRef<HTMLDivElement>(null);
  const date = query.get("date") || localDate(s.now, s.business.timezone),
    focus = query.get("filter") || "all",
    base = "/w/" + s.business.slug + "/admin/",
    listQuery =
      "?date=" +
      date +
      (focus !== "all" ? "&filter=" + focus : "") +
      (slot ? "&slot=" + slot : ""),
    selected = s.deliveries.find((d) => d.id === query.get("delivery"));
  const querySlot = s.slots.some((slot) => slot.id === query.get("slot"))
    ? query.get("slot") || ""
    : "";
  useEffect(() => {
    setSlot(querySlot);
  }, [querySlot]);
  useEffect(() => {
    if (!navigationPending) setNavigationDate(null);
  }, [navigationPending, date]);
  const updateSlot = (value: string) => {
    if (navigationPending) return;
    setSlot(value);
    setPage(0);
    setSelection([]);
    const params = new URLSearchParams(query.toString());
    params.set("date", date);
    params.delete("delivery");
    if (value) params.set("slot", value);
    else params.delete("slot");
    startNavigation(() =>
      router.replace(base + view + "?" + params.toString(), { scroll: false }),
    );
  };
  const rows = s.deliveries.filter(
      (d) => d.service_date === date && (!slot || d.slot_id === slot),
    ),
    active = rows.filter((d) => d.status !== "cancelled");
  const filtered = rows.filter(
    (d) =>
      (focus === "all" ||
        (focus === "attention"
          ? d.status === "failed" || (d.status === "scheduled" && !d.menu_id)
          : d.status === focus)) &&
      (
        s.customers.find((c) => c.id === d.customer_id)?.name +
        " " +
        (d.menu_name || "")
      )
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const changeFocus = (value: string) => {
    if (navigationPending) return;
    setPage(0);
    setSelection([]);
    startNavigation(() =>
      router.replace(
        base +
          view +
          "?date=" +
          date +
          (value === "all" ? "" : "&filter=" + value) +
          (slot ? "&slot=" + slot : ""),
        { scroll: false },
      ),
    );
  };
  const clearFilters = () => {
    if (navigationPending) return;
    setSearch("");
    setSlot("");
    setPage(0);
    setSelection([]);
    startNavigation(() =>
      router.replace(base + view + "?date=" + date, { scroll: false }),
    );
  };
  const guidance = dailyGuidance(s, active);
  const { failed, missing, readyIds, dispatchIds } = guidance;
  const unfinished = active.filter((d) => d.status !== "delivered").length;
  const nextTask = guidance.task,
    nextStage = guidance.stage;
  const changeDate = (d: string) => {
    if (navigationPending) return;
    setNavigationDate(d);
    setPage(0);
    setSelection([]);
    startNavigation(() =>
      router.push(base + view + "?date=" + d + (slot ? "&slot=" + slot : "")),
    );
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
        disabled={navigationPending}
        onClick={() => shiftDate(-1)}
      >
        <ChevronLeft size={18} />
      </button>
      <label className="date-input">
        <CalendarDays size={17} />
        <DateInput
          aria-label={t("selectedDate")}
          value={navigationDate || date}
          disabled={navigationPending}
          onChange={(e) => {
            if (e.target.value) changeDate(e.target.value);
          }}
        />
      </label>
      <button
        className="icon-button"
        aria-label={t("next")}
        disabled={navigationPending}
        onClick={() => shiftDate(1)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
  const dailyStatus = !active.length
    ? "dayEmpty"
    : failed || missing
      ? "attention"
      : !unfinished
        ? "delivered"
        : guidance.blocked
          ? "dayPreparing"
          : readyIds.length
            ? "dayAwaitingReady"
            : active.some((d) => d.status === "out_for_delivery")
              ? "out_for_delivery"
              : "ready";
  const selectable =
    view === "delivery" &&
    rows.some((d) => ["scheduled", "ready"].includes(d.status));
  const visibleRows = filtered.slice(page * 20, page * 20 + 20);
  const visibleIds = visibleRows.map((d) => d.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.includes(id));
  const toggleSelection = (id: string) =>
    setSelection((old) =>
      old.includes(id)
        ? old.filter((selectedId) => selectedId !== id)
        : [...old, id],
    );
  return (
    <div className="operations-workspace" data-view={view} ref={region}>
      <div className="operations-day-header">
        <PageHeading title={view === "today" ? t("greeting") : t(view)}>
          {dateControls}
        </PageHeading>
        <div className="operations-day-context">
          <div className="daily-overview">
            <div>
              <strong>{fmt.date(date)}</strong>
              <span>
                {t("daySummary", {
                  count: active.length,
                  delivered: active.filter((d) => d.status === "delivered")
                    .length,
                })}
              </span>
            </div>
            <Status status={dailyStatus} />
          </div>
          {view === "today" && active.length > 0 && (
            <fieldset
              className="daily-task operations-navigation-guard"
              disabled={navigationPending}
              inert={navigationPending}
              aria-label={t("nextStep")}
            >
              <strong>{t(nextTask)}</strong>
              <span>
                {t(nextTask + "Hint", {
                  count: guidance.count,
                })}
              </span>
              <OperationsBatch
                s={s}
                ids={[]}
                clear={() => {}}
                removeCompleted={() => {}}
                handoff={
                  nextTask === "taskReadyReview" ||
                  nextTask === "taskDispatchReview"
                    ? {
                        target:
                          nextTask === "taskReadyReview"
                            ? "ready"
                            : "out_for_delivery",
                        ids:
                          nextTask === "taskReadyReview"
                            ? readyIds
                            : dispatchIds,
                        label: t(
                          nextTask === "taskReadyReview"
                            ? "productionReviewReady"
                            : "productionReviewDispatch",
                          { count: guidance.count },
                        ),
                      }
                    : undefined
                }
              />
              {nextTask !== "taskReadyReview" &&
                nextTask !== "taskDispatchReview" &&
                unfinished > 0 && (
                  <Link
                    className="button primary"
                    href={
                      base +
                      nextStage +
                      "?date=" +
                      date +
                      (failed
                        ? "&filter=failed"
                        : missing
                          ? "&filter=attention"
                          : "")
                    }
                  >
                    {t(
                      nextStage === "schedule"
                        ? "openSchedule"
                        : nextStage === "production"
                          ? "viewProduction"
                          : "openDelivery",
                    )}
                    <ArrowRight size={17} />
                  </Link>
                )}
            </fieldset>
          )}
        </div>
      </div>
      <div
        className="cycle-tabs"
        inert={navigationPending}
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
              href={base + k + "?date=" + date + (slot ? "&slot=" + slot : "")}
              aria-label={t(k)}
              aria-describedby={"cycle-" + k + "-count"}
              className={
                view === k || (view === "today" && k === "schedule")
                  ? "active"
                  : ""
              }
              aria-current={
                view === k || (view === "today" && k === "schedule")
                  ? "page"
                  : undefined
              }
            >
              <Component size={18} />
              <span>{t(k)}</span>
              <small id={"cycle-" + k + "-count"}>
                {t(
                  k === "schedule"
                    ? "cycleDeliveryCount"
                    : k === "production"
                      ? "cycleVersionCount"
                      : "cycleCompletedCount",
                  k === "delivery"
                    ? {
                        completed: active.filter(
                          (d) => d.status === "delivered",
                        ).length,
                        total: active.length,
                      }
                    : {
                        count:
                          k === "schedule"
                            ? active.length
                            : s.slots.filter((slot) =>
                                s.production.some(
                                  (p) =>
                                    p.service_date === date &&
                                    p.slot_id === slot.id,
                                ),
                              ).length,
                      },
                )}
              </small>
            </Link>
          );
        })}
      </div>
      <div
        className="operations-navigation-status"
        role="status"
        aria-live="polite"
      >
        {navigationPending ? t("updatingWork") : ""}
      </div>
      <fieldset
        className="operations-work-body operations-navigation-guard"
        disabled={navigationPending}
        inert={navigationPending}
        aria-busy={navigationPending}
      >
        {view === "production" ? (
          <ProductionView s={s} date={date} slot={slot} setSlot={updateSlot} />
        ) : (
          <section className="list-surface operations-list">
            <div className="list-toolbar">
              <h2>{t(view === "delivery" ? "delivery" : "schedule")}</h2>
              <div className="filter-controls">
                <label className="search-control">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelection([]);
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
                    updateSlot(e.target.value);
                  }}
                >
                  <option value="">{t("allSlots")}</option>
                  {s.slots.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={t("filterWork")}
                  value={focus}
                  onChange={(e) => changeFocus(e.target.value)}
                >
                  <option value="all">{t("allStatuses")}</option>
                  <option value="attention">{t("attention")}</option>
                  {[
                    "scheduled",
                    "ready",
                    "out_for_delivery",
                    "delivered",
                    "failed",
                    "cancelled",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {t(status)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {view === "delivery" && (
              <OperationsBatch
                s={s}
                ids={selection}
                clear={() => setSelection([])}
                removeCompleted={(ids) =>
                  setSelection((old) => old.filter((id) => !ids.includes(id)))
                }
              />
            )}
            {filtered.length ? (
              <>
                <div className="table-scroll">
                  <table className="delivery-table">
                    <thead>
                      <tr>
                        {selectable && (
                          <th className="selection-cell">
                            <input
                              type="checkbox"
                              aria-label={t("batchSelectPage")}
                              checked={allVisibleSelected}
                              ref={(node) => {
                                if (node)
                                  node.indeterminate =
                                    !allVisibleSelected &&
                                    visibleIds.some((id) =>
                                      selection.includes(id),
                                    );
                              }}
                              onChange={(e) =>
                                setSelection((old) =>
                                  e.target.checked
                                    ? [...new Set([...old, ...visibleIds])]
                                    : old.filter(
                                        (id) => !visibleIds.includes(id),
                                      ),
                                )
                              }
                            />
                          </th>
                        )}
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
                      {visibleRows.map((d) => {
                        const c = s.customers.find(
                          (x) => x.id === d.customer_id,
                        );
                        return (
                          <tr
                            key={d.id}
                            data-selected={
                              selection.includes(d.id) || undefined
                            }
                          >
                            {selectable && (
                              <td className="selection-cell">
                                <input
                                  type="checkbox"
                                  aria-label={t("batchSelectCustomer", {
                                    name: c?.name || "",
                                  })}
                                  checked={selection.includes(d.id)}
                                  onChange={() => toggleSelection(d.id)}
                                />
                              </td>
                            )}
                            <td>
                              <Link
                                href={
                                  base + view + listQuery + "&delivery=" + d.id
                                }
                                className="customer-link"
                                data-delivery-opener={d.id}
                                onClick={(e) => {
                                  if (navigationPending) {
                                    e.preventDefault();
                                    return;
                                  }
                                  opener.current = e.currentTarget;
                                  lastDeliveryId.current = d.id;
                                  openerSelector.current = `[data-delivery-opener="${d.id}"].customer-link`;
                                }}
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
                              <span
                                className={!d.menu_id ? "missing-menu" : ""}
                              >
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
                              {selection.includes(d.id) &&
                                (d.status === "scheduled"
                                  ? batchBlocker(s, d, "ready")
                                  : d.status === "ready"
                                    ? null
                                    : "batchIndividualOnly") && (
                                  <small className="table-note batch-row-blocker">
                                    {t(
                                      d.status === "scheduled"
                                        ? batchBlocker(s, d, "ready")!
                                        : "batchIndividualOnly",
                                    )}
                                  </small>
                                )}
                            </td>
                            <td>
                              <Link
                                className="icon-button"
                                data-delivery-opener={d.id}
                                onClick={(e) => {
                                  if (navigationPending) {
                                    e.preventDefault();
                                    return;
                                  }
                                  opener.current = e.currentTarget;
                                  lastDeliveryId.current = d.id;
                                  openerSelector.current = `[data-delivery-opener="${d.id}"].icon-button`;
                                }}
                                href={
                                  base + view + listQuery + "&delivery=" + d.id
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
                title={t(rows.length ? "noMatchingDeliveries" : "noDeliveries")}
                description={t(
                  rows.length ? "noMatchingHint" : "noDeliveriesDescription",
                )}
              >
                {rows.length ? (
                  <button className="button secondary" onClick={clearFilters}>
                    {t("clearFilters")}
                  </button>
                ) : (
                  <Link className="button secondary" href={base + "customers"}>
                    {t("createSchedule")}
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </Empty>
            )}
          </section>
        )}
        <Dialog.Root
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) {
              // Query updates can replace the selected DTO before Radix restores focus.
              lastDeliveryId.current = selected?.id || lastDeliveryId.current;
              startNavigation(() =>
                router.push(base + view + listQuery, { scroll: false }),
              );
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content
              className="detail-drawer"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                const restored = opener.current?.isConnected
                  ? opener.current
                  : region.current?.querySelector<HTMLElement>(
                      openerSelector.current ||
                        `[data-delivery-opener="${lastDeliveryId.current}"]`,
                    );
                if (restored) restored.focus();
                else {
                  const heading =
                    region.current?.querySelector<HTMLElement>("h1");
                  heading?.setAttribute("tabindex", "-1");
                  heading?.focus();
                }
              }}
            >
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
              {selected && (
                <DeliveryDetail s={s} d={selected} headingLevel={2} />
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        {view === "delivery" && <ManifestLinks s={s} date={date} />}
      </fieldset>
    </div>
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
  const sourceDeliveries = s.deliveries.filter(
      (d) =>
        d.service_date === date &&
        d.slot_id === chosenSlot &&
        d.status !== "cancelled",
    ),
    cutoffDue =
      sourceDeliveries.length > 0 &&
      sourceDeliveries.every((d) => new Date(s.now) >= new Date(d.cutoff_at));
  const isLatest = !!version && version.id === versions[0]?.id;
  const eligibleIds = version ? productionReadyIds(s, version) : [];
  const dispatchIds = sourceDeliveries
    .filter((d) => d.status === "ready")
    .map((d) => d.id);
  const handoffTarget = eligibleIds.length ? "ready" : "out_for_delivery";
  const handoffIds = eligibleIds.length ? eligibleIds : dispatchIds;
  const deliveryHref =
    "/w/" +
    s.business.slug +
    "/admin/delivery?date=" +
    date +
    "&slot=" +
    chosenSlot;
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
            disabled={!cutoffDue}
            build={() => ({ service_date: date, slot_id: chosenSlot })}
            description={t("productionWait")}
          />
        </div>
      )}
      {version && (
        <section className="production-next-step" aria-label={t("nextStep")}>
          <p>
            {t(
              !isLatest
                ? "productionHistoricalHint"
                : version.incomplete
                  ? "taskProductionIncompleteHint"
                  : eligibleIds.length
                    ? "productionReadyHandoff"
                    : dispatchIds.length
                      ? "productionDispatchHandoff"
                      : "productionFulfillmentHandoff",
            )}
          </p>
          <OperationsBatch
            s={s}
            ids={[]}
            clear={() => {}}
            removeCompleted={() => {}}
            handoff={
              isLatest && !version.incomplete && handoffIds.length
                ? {
                    target: handoffTarget,
                    ids: handoffIds,
                    label: t(
                      eligibleIds.length
                        ? "productionReviewReady"
                        : "productionReviewDispatch",
                      { count: handoffIds.length },
                    ),
                  }
                : undefined
            }
          />
          {!isLatest ? (
            <button
              className="button secondary"
              onClick={() => setRevision("")}
            >
              {t("productionViewLatest")}
            </button>
          ) : (
            <Link className="button ghost" href={deliveryHref}>
              {t("openDelivery")}
            </Link>
          )}
        </section>
      )}
      {!!(
        version?.incomplete ||
        (!version &&
          cutoffDue &&
          live.some((x) => !x.menu) &&
          !s.offerings.some(
            (o) =>
              o.service_date === date &&
              o.slot_id === chosenSlot &&
              o.is_default,
          ))
      ) && (
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
