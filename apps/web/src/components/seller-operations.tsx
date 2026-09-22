"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Package,
  Truck,
  CircleAlert,
  Utensils,
  ArrowUpRight,
  ChefHat,
  Check,
  X,
  ArrowLeft,
} from "lucide-react";
import {
  addDays,
  statusLabel,
  fulfillmentStatus,
  nextDeliveryStatuses,
  scheduleSummary,
  mealWorkload,
  deliveryDeadlines,
  destinationKey,
  operationalGroups,
  type SellerOperationsState,
  type SellerDelivery,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { Button, Checkbox, TextInput } from "./form-controls";
import { Select, SelectOption } from "./select";
import { DatePicker } from "./date-picker";
import { Heading, Loading, ErrorNotice, Empty, Status, Facts } from "./ui";
import { Production } from "./seller-production";
import { SellerReadiness } from "./seller-readiness";
import { NeedsAttention } from "./seller-attention";
import {
  datesBetween,
  monthOf,
  monthEnd,
  shiftMonth,
  validDay,
} from "../lib/meal-calendar";
import "./meal-calendar.css";
import "./seller-operations.css";

export function SellerOperations({ view }: { view: string }) {
  const { actor } = useApp();
  const query = useSearchParams();
  const router = useRouter();
  const calendarFocus = useRef<string | null>(null);
  const requestedDate = query.get("date") || "";
  const date = validDay(requestedDate) ? requestedDate : "";
  useEffect(() => {
    if (view !== "delivery" && view !== "production") return;
    const next = new URLSearchParams(query);
    if (view === "delivery" && next.get("meal") !== "dinner")
      next.set("meal", "lunch");
    if (view === "production") next.set("production", "1");
    router.replace(
      (view === "delivery" ? "/seller" : "/seller/schedule") + "?" + next,
    );
  }, [view, query, router]);
  return (
    <OperationsLoader
      key={actor!.catererId}
      date={date}
      calendarFocus={calendarFocus}
      schedule={view === "schedule" || view === "production"}
    />
  );
}

function OperationsLoader({
  date,
  schedule,
  calendarFocus,
}: {
  date: string;
  schedule: boolean;
  calendarFocus: { current: string | null };
}) {
  const { actor, t } = useApp();
  const state = useResource("operations:" + actor!.catererId + ":" + date, () =>
    api.sellerOperations(actor!.catererId!, date),
    { keepPreviousData: true },
  );
  const reload = useRef(state.reload);
  reload.current = state.reload;
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) reload.current();
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  return (
    <>
      {state.error && (
        <ErrorNotice
          message={t(
            "Pesanan belum berhasil dimuat ulang.",
            "Orders could not be refreshed.",
          )}
          retry={state.reload}
        />
      )}
      <OperationsPage
        key={String(schedule)}
        state={state.data}
        selectedDate={date || state.data.operationalDate}
        schedule={schedule}
        calendarFocus={calendarFocus}
        refresh={state.reload}
        loading={
          state.loading ||
          Boolean(state.error) ||
          Boolean(date && state.data.operationalDate !== date)
        }
      />
    </>
  );
}

function OperationsPage({
  state: s,
  selectedDate,
  schedule,
  refresh,
  loading,
  calendarFocus,
}: {
  state: SellerOperationsState;
  selectedDate: string;
  schedule: boolean;
  refresh: () => void;
  loading: boolean;
  calendarFocus: { current: string | null };
}) {
  const { t, locale } = useApp();
  const query = useSearchParams();
  const router = useRouter();
  const date = selectedDate;
  const currentRows = s.operationalDate === date ? s.deliveries : [];
  const lunch = mealWorkload(currentRows, "lunch");
  const dinner = mealWorkload(currentRows, "dinner");
  const suggestedMeal = !lunch.portions && dinner.portions ? "dinner" : "lunch";
  const [defaultMeal, setDefaultMeal] = useState({ date, meal: suggestedMeal });
  if (!loading && defaultMeal.date !== date) {
    setDefaultMeal({ date, meal: suggestedMeal });
  }
  const initialMeal = defaultMeal.date === date ? defaultMeal.meal : suggestedMeal;
  const meal =
    query.get("meal") === "dinner"
      ? "dinner"
      : query.get("meal") === "lunch"
        ? "lunch"
        : schedule
          ? "all"
          : initialMeal;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const next = Math.min(
      ...s.deliveries
        .map((d) => Date.parse(d.cutoff_at))
        .filter((at) => at > now),
    );
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(60000, Math.max(1, next - now + 1)),
    );
    return () => clearTimeout(timer);
  }, [now, s.deliveries]);
  const [filterSearch, setFilterSearch] = useState("");
  const packageId = schedule ? query.get("package") || "" : "";
  const status =
    schedule && ["all", "cancelled"].includes(query.get("status") || "")
      ? query.get("status")!
      : "active";
  function navigate(values: Record<string, string>) {
    const next = new URLSearchParams(query);
    if (
      ["date", "meal", "package", "status", "group"].some(
        (key) => key in values,
      )
    ) {
      next.delete("filter");
      setFilterSearch("");
    }
    for (const [key, value] of Object.entries(values))
      value ? next.set(key, value) : next.delete(key);
    router.push((schedule ? "/seller/schedule" : "/seller") + "?" + next, {
      scroll: false,
    });
  }
  const dayRows = s.operationalDate === date ? s.deliveries : [];
  const rows = dayRows.filter(
    (d) =>
      (meal === "all" || d.meals.some((m) => m.meal === meal)) &&
      (!packageId || d.offer.id === packageId) &&
      ((!schedule && d.status !== "cancelled") ||
        status === "all" ||
        (status === "cancelled"
          ? d.status === "cancelled"
          : d.status !== "cancelled")),
  );
  const includeCancelled = schedule && status !== "active";
  const grouping =
    schedule && ["customers", "destinations"].includes(query.get("group") || "")
      ? query.get("group")!
      : "flat";
  const groupKey = (row: SellerDelivery) =>
    grouping === "customers" ? row.customer.id : destinationKey(row.address);
  const groupOptions = [
    ...new Map(
      rows.map((row) => [
        groupKey(row),
        grouping === "customers"
          ? row.customer.name
          : `${row.address.line}, ${row.address.area}`,
      ]),
    ).entries(),
  ];
  const selectedGroup = query.get("filter") || "";
  const filteredRows =
    grouping !== "flat" && selectedGroup
      ? rows.filter((row) => groupKey(row) === selectedGroup)
      : rows;
  const summary = scheduleSummary(filteredRows, meal, includeCancelled);
  const deadlines = deliveryDeadlines(filteredRows, now);
  const workload = meal === "dinner" ? dinner : lunch;
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
      dateStyle: "full",
      timeZone: "UTC",
    }).format(new Date(value + "T12:00:00Z"));
  return (
    <div className="seller-operations">
      <Heading
        title={
          schedule
            ? t("Jadwal pesanan", "Order schedule")
            : date === s.today
              ? t("Hari ini", "Today")
              : t("Operasional", "Operations")
        }
        description={
          schedule
            ? t(
                "Semua pesanan dapurmu, tanggal demi tanggal.",
                "Every order for your kitchen, day by day.",
              )
            : t(
                "Siapkan, antar, dan perbarui setiap pesanan.",
                "Prepare, deliver, and update every order.",
              )
        }
      ></Heading>
      <SellerReadiness caterer={s.caterer} offers={s.offers} />
      <div className="ops-context">
        <strong>
          {formatDate(date)} · {s.caterer.timezone}
        </strong>
        <Link
          className="button secondary"
          href={`/seller/schedule?date=${date}&production=1#production`}
        >
          <ChefHat size={18} />
          {t(
            "Daftar dapur & pengantaran · sehari penuh",
            "Kitchen & delivery list · whole day",
          )}
        </Link>
      </div>
      {loading && (
        <p role="status">
          {t(
            "Memuat ulang data; tindakan sementara dinonaktifkan.",
            "Refreshing data; actions are temporarily disabled.",
          )}
        </p>
      )}
      {s.caterer.status !== "approved" && (
        <p className="notice">
          {t("Status verifikasi", "Verification status")}:{" "}
          <Status status={s.caterer.status} />
        </p>
      )}
      {schedule && (
        <details
          className="ops-production spaced"
          id="production"
          open={query.get("production") === "1" || undefined}
        >
          <summary>
            {t("Daftar dapur & pengantaran", "Kitchen & delivery lists")}
          </summary>
          {s.operationalDate !== date ? (
            <Loading />
          ) : (
            <Production
              key={date}
              deliveries={dayRows}
              meal="all"
              date={date}
              loading={loading}
            />
          )}
        </details>
      )}
      {schedule && (
        <ScheduleCalendar
          key={meal + ":" + packageId + ":" + status}
          date={date}
          today={s.today}
          catererId={s.caterer.id}
          meal={meal}
          packageId={packageId}
          status={status}
          focusDate={calendarFocus}
          loading={loading}
          onDate={(value) => {
            calendarFocus.current = value;
            navigate({ date: value });
          }}
        />
      )}
      {schedule && (
        <div
          className="ops-package-filter"
          role="group"
          aria-label={t("Filter paket", "Package filter")}
        >
          {[
            { id: "", name: t("Semua paket", "All packages") },
            ...s.offers,
          ].map((p) => (
            <Button
              key={p.id}
              className={
                "button secondary small" +
                (packageId === p.id ? " is-selected" : "")
              }
              aria-pressed={packageId === p.id}
              onClick={() => navigate({ package: p.id })}
            >
              {p.name}
            </Button>
          ))}
        </div>
      )}
      {schedule && (
        <p className="muted">
          {t(
            "Porsi pada tab: seluruh tanggal ini, semua paket dan pelanggan.",
            "Tab portions: this whole day, all packages and customers.",
          )}
        </p>
      )}
      <div className="ops-filter-row">
        {!schedule && (
          <div className="ops-date">
            <DatePicker
              compact
              aria-label={t("Tanggal operasional", "Operational date")}
              value={date}
              onValueChange={(value) => navigate({ date: value })}
            />
          </div>
        )}

        <div
          className="ops-meal-tabs"
          role="tablist"
          aria-label={t("Waktu makan", "Meal period")}
        >
          {(schedule ? ["all", "lunch", "dinner"] : ["lunch", "dinner"]).map(
            (m, i, options) => (
              <Button
                key={m}
                role="tab"
                aria-selected={meal === m}
                aria-controls="ops-orders"
                tabIndex={meal === m ? 0 : -1}
                className={meal === m ? "selected" : ""}
                onClick={() => navigate({ meal: m })}
                onKeyDown={(e) => {
                  const index =
                    e.key === "ArrowRight"
                      ? (i + 1) % options.length
                      : e.key === "ArrowLeft"
                        ? (i - 1 + options.length) % options.length
                        : e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? options.length - 1
                            : -1;
                  if (index >= 0) {
                    e.preventDefault();
                    (
                      e.currentTarget.parentElement?.children[
                        index
                      ] as HTMLElement
                    )?.focus();
                    navigate({ meal: options[index] });
                  }
                }}
              >
                {m === "lunch" ? (
                  <Sun size={17} />
                ) : m === "dinner" ? (
                  <Moon size={17} />
                ) : (
                  <Utensils size={17} />
                )}
                {m === "all"
                  ? t("Semua", "All")
                  : m === "lunch"
                    ? t("Siang", "Lunch")
                    : t("Malam", "Dinner")}
                {m !== "all" && (
                  <small>
                    ·{" "}
                    {loading
                      ? "…"
                      : m === "lunch"
                        ? lunch.portions
                        : dinner.portions}{" "}
                    {t("porsi", "portions")}
                  </small>
                )}
              </Button>
            ),
          )}
        </div>
        {schedule && (
          <Select
            aria-label={t("Status pesanan", "Order status")}
            value={status}
            onValueChange={(value) => navigate({ status: value })}
          >
            <SelectOption value="active">
              {t("Tidak dibatalkan", "Not cancelled")}
            </SelectOption>
            <SelectOption value="all">
              {t("Semua status", "All statuses")}
            </SelectOption>
            <SelectOption value="cancelled">
              {t("Dibatalkan", "Cancelled")}
            </SelectOption>
          </Select>
        )}
      </div>
      {schedule ? (
        <div
          className="ops-scope-summary"
          aria-label={t("Ringkasan tabel", "Table summary")}
        >
          <strong>
            {loading
              ? "…"
              : summary.orders +
                " " +
                t("pesanan", "orders") +
                " · " +
                summary.portions +
                " " +
                t("porsi makan", "meal portions")}
          </strong>
          <span>
            {t("Sesuai filter tabel", "Matching table filters")}
            {includeCancelled &&
              " · " +
                t(
                  "termasuk jumlah historis yang dibatalkan; bukan kebutuhan dapur",
                  "includes cancelled historical quantities; not kitchen requirements",
                )}
          </span>
        </div>
      ) : (
        <section
          className="panel ops-workload"
          aria-label={t("Beban layanan", "Service workload")}
        >
          <h2>
            {t("Total porsi", "Total portions")}{" "}
            {meal === "lunch"
              ? t("siang", "for lunch")
              : t("malam", "for dinner")}
            : {loading ? "…" : workload.portions}
          </h2>
          <p>
            {loading ? "…" : workload.orders}{" "}
            {t(
              "pesanan · termasuk yang sudah diterima, tidak termasuk pembatalan",
              "orders · includes delivered meals, excludes cancellations",
            )}
          </p>
          <div className="ops-stages">
            {Object.entries(workload.stages).map(([status, portions]) => (
              <span key={status}>
                {statusLabel(status, locale)}:{" "}
                <strong>
                  {loading ? "…" : portions} {t("porsi", "portions")}
                </strong>
              </span>
            ))}
          </div>
          {!loading &&
            !workload.orders &&
            (meal === "lunch" ? dinner.orders : lunch.orders) > 0 && (
              <Button
                className="text-button"
                onClick={() =>
                  navigate({ meal: meal === "lunch" ? "dinner" : "lunch" })
                }
              >
                {t("Lihat pesanan", "View orders for")}{" "}
                {meal === "lunch" ? t("malam", "dinner") : t("siang", "lunch")}
              </Button>
            )}
        </section>
      )}
      {!loading && deadlines.length > 0 && (
        <details className="ops-deadlines">
          <summary>
            {t("Batas perubahan pelanggan", "Customer change deadlines")} ·{" "}
            {date} ·{" "}
            {deadlines.length === 1
              ? new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: s.caterer.timezone,
                }).format(new Date(deadlines[0].at)) +
                " · " +
                (deadlines[0].passed
                  ? t("Sudah lewat", "Passed")
                  : t("Belum lewat", "Not yet passed"))
              : deadlines.length +
                " " +
                t("batas berbeda", "different deadlines")}
          </summary>
          <p>
            {t(
              "Batas dari ketentuan pembelian. Kelayakan perubahan tetap diperiksa per pesanan; batas ini tidak mengunci pembaruan status dapur/pengantaran.",
              "Deadlines from purchased terms. Change eligibility is still checked per order; these deadlines do not lock kitchen/delivery status updates.",
            )}
          </p>
          {deadlines.map((d) => (
            <p key={d.at}>
              {new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: s.caterer.timezone,
              }).format(new Date(d.at))}{" "}
              · {s.caterer.timezone} ·{" "}
              {d.passed
                ? t("Sudah lewat", "Passed")
                : t("Belum lewat", "Not yet passed")}{" "}
              · {d.orders} {t("pesanan", "orders")}
            </p>
          ))}
        </details>
      )}
      {!schedule && <NeedsAttention catererId={s.caterer.id} />}
      {schedule && (
        <div className="ops-group-controls">
          <label>
            {t("Kelompokkan pesanan", "Group orders")}
            <Select
              aria-label={t("Kelompokkan pesanan", "Group orders")}
              value={grouping}
              onValueChange={(group) =>
                navigate({ group: group === "flat" ? "" : group })
              }
            >
              <SelectOption value="flat">
                {t("Tanpa kelompok", "No grouping")}
              </SelectOption>
              <SelectOption value="customers">
                {t("Pelanggan", "Customer")}
              </SelectOption>
              <SelectOption value="destinations">
                {t("Tujuan", "Destination")}
              </SelectOption>
            </Select>
          </label>
          {(packageId ||
            selectedGroup ||
            status !== "active" ||
            meal !== "all") && (
            <Button
              className="text-button"
              onClick={() =>
                navigate({
                  package: "",
                  filter: "",
                  status: "",
                  meal: "",
                  group: "",
                })
              }
            >
              {t("Reset filter tabel", "Reset table filters")}
            </Button>
          )}
        </div>
      )}
      <div
        id="ops-orders"
        role="tabpanel"
        aria-label={
          schedule
            ? t("Pesanan", "Orders")
            : meal === "lunch"
              ? t("Pesanan siang", "Lunch orders")
              : t("Pesanan malam", "Dinner orders")
        }
      >
        <OrderTable
          key={[date, meal, packageId, status, grouping, selectedGroup].join(
            ":",
          )}
          rows={filteredRows}
          scheduleGrouping={grouping}
          scheduleFilter={
            schedule && grouping !== "flat" ? (
              <div className="ops-list-filter">
                <TextInput
                  type="search"
                  aria-label={t(
                    "Cari pelanggan atau tujuan",
                    "Search customers or destinations",
                  )}
                  placeholder={t(
                    "Cari pelanggan atau tujuan",
                    "Search customers or destinations",
                  )}
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                />
                <Select
                  aria-label={t(
                    grouping === "customers"
                      ? "Filter pelanggan"
                      : "Filter tujuan",
                    grouping === "customers"
                      ? "Customer filter"
                      : "Destination filter",
                  )}
                  value={selectedGroup}
                  onValueChange={(value) => navigate({ filter: value })}
                >
                  <SelectOption value="">
                    {t(
                      grouping === "customers"
                        ? "Semua pelanggan"
                        : "Semua tujuan",
                      grouping === "customers"
                        ? "All customers"
                        : "All destinations",
                    )}
                  </SelectOption>
                  {groupOptions
                    .filter(
                      ([key, label]) =>
                        key === selectedGroup ||
                        label
                          .toLocaleLowerCase()
                          .includes(filterSearch.toLocaleLowerCase()),
                    )
                    .map(([key, label]) => (
                      <SelectOption key={key} value={key}>
                        {label}
                      </SelectOption>
                    ))}
                  {selectedGroup &&
                    !groupOptions.some(([key]) => key === selectedGroup) && (
                      <SelectOption value={selectedGroup}>
                        {t(
                          "Filter tersimpan · tidak ada hasil",
                          "Saved filter · no matches",
                        )}
                      </SelectOption>
                    )}
                </Select>
                <Button
                  className="text-button"
                  onClick={() => navigate({ filter: "" })}
                >
                  <X size={16} />
                  {t("Hapus filter", "Clear filter")}
                </Button>
              </div>
            ) : undefined
          }
          meal={meal}
          date={date}
          today={s.today}
          timezone={s.caterer.timezone}
          catererId={s.caterer.id}
          schedule={schedule}
          loading={loading}
          refresh={refresh}
        />
      </div>
    </div>
  );
}

function ScheduleCalendar({
  date,
  today,
  catererId,
  meal,
  packageId,
  status,
  onDate,
  focusDate,
  loading,
}: {
  date: string;
  today: string;
  catererId: string;
  meal: string;
  packageId: string;
  status: string;
  onDate: (date: string) => void;
  focusDate: { current: string | null };
  loading: boolean;
}) {
  const { t, locale } = useApp();
  const month = monthOf(date);
  const state = useResource(
    "seller-calendar:" + [catererId, month, meal, packageId, status].join(":"),
    () =>
      api.sellerCalendar(catererId, {
        from: month,
        to: monthEnd(month),
        meal,
        packageId,
        status,
      }),
  );
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const button = strip.current?.querySelector<HTMLElement>(
      `[data-day="${date}"]`,
    );
    const center = () => {
      if (button && strip.current)
        strip.current.scrollLeft =
          button.offsetLeft -
          strip.current.clientWidth / 2 +
          button.clientWidth / 2;
    };
    center();
    if (focusDate.current === date) {
      button?.focus({ preventScroll: true });
      // Keep keyboard intent until the requested date finishes loading.
      if (!loading) focusDate.current = null;
    }
    const observer = new ResizeObserver(center);
    if (strip.current) observer.observe(strip.current);
    return () => observer.disconnect();
  }, [date, loading]);
  const format = (d: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
      ...options,
      timeZone: "UTC",
    }).format(new Date(d + "T12:00:00Z"));
  return (
    <section
      className="ops-calendar"
      aria-label={t("Kalender pesanan", "Order calendar")}
    >
      <div className="coverage-toolbar">
        <div className="ops-month-controls">
          <Button
            className="icon-button"
            aria-label={t("Bulan sebelumnya", "Previous month")}
            onClick={() => onDate(shiftMonth(date, -1))}
          >
            <ChevronLeft size={19} />
          </Button>
          <CalendarDays size={19} />
          <strong>{format(date, { month: "long", year: "numeric" })}</strong>
          <Button
            className="icon-button"
            aria-label={t("Bulan berikutnya", "Next month")}
            onClick={() => onDate(shiftMonth(date, 1))}
          >
            <ChevronRight size={19} />
          </Button>
        </div>
        <div className="calendar-shortcuts">
          <DatePicker
            compact
            aria-label={t("Pilih tanggal", "Choose date")}
            value={date}
            onValueChange={onDate}
          />
          <Button
            className="button secondary small"
            onClick={() => onDate(today)}
          >
            {t("Hari ini", "Today")}
          </Button>
        </div>
      </div>
      {state.error && (
        <ErrorNotice
          message={t(
            "Kalender belum berhasil dimuat.",
            "Could not load the calendar.",
          )}
          retry={state.reload}
        />
      )}
      <div className="coverage-navigation">
        <Button
          className="icon-button calendar-scroll-arrow"
          aria-label={t("Tanggal sebelumnya", "Earlier dates")}
          onClick={() =>
            strip.current?.scrollBy({ left: -400, behavior: "smooth" })
          }
        >
          <ChevronLeft />
        </Button>
        <div
          className="coverage-strip"
          ref={strip}
          role="group"
          aria-label={t("Tanggal pesanan", "Order dates")}
          aria-busy={state.loading}
        >
          {datesBetween(month, monthEnd(month)).map((day) => {
            const d =
              !state.loading && !state.error
                ? state.data?.days.find((d) => d.date === day)
                : undefined;
            return (
              <Button
                key={day}
                data-day={day}
                className={
                  "coverage-day" +
                  (day === date ? " is-selected" : "") +
                  (day === today ? " is-today" : "")
                }
                aria-pressed={day === date}
                aria-current={day === today ? "date" : undefined}
                tabIndex={day === date ? 0 : -1}
                aria-label={`${format(day, { weekday: "long", day: "numeric", month: "long" })}, ${state.loading ? t("memuat", "loading") : state.error ? t("gagal dimuat", "failed to load") : `${d?.orders || 0} ${t("pesanan", "orders")}${d?.lunch ? t(", siang", ", lunch") : ""}${d?.dinner ? t(", malam", ", dinner") : ""}`}`}
                onClick={() => onDate(day)}
                onKeyDown={(e) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  ) {
                    e.preventDefault();
                    onDate(
                      e.key === "Home"
                        ? month
                        : e.key === "End"
                          ? monthEnd(month)
                          : addDays(day, e.key === "ArrowLeft" ? -1 : 1),
                    );
                  }
                }}
              >
                <span className="coverage-day-top">
                  {day === today
                    ? t("Hari ini", "Today")
                    : format(day, { weekday: "short" })}
                </span>
                <strong>{Number(day.slice(8))}</strong>
                <span className="coverage-info">
                  <span className="coverage-meal-icons">
                    {d?.lunch && <Sun size={16} className="is-lunch" />}
                    {d?.dinner && <Moon size={16} className="is-dinner" />}
                  </span>
                  <small>
                    {state.loading
                      ? "…"
                      : state.error
                        ? "—"
                        : `${d?.orders || 0} ${t("pesanan", "orders")}`}
                  </small>
                </span>
              </Button>
            );
          })}
        </div>
        <Button
          className="icon-button calendar-scroll-arrow"
          aria-label={t("Tanggal berikutnya", "Later dates")}
          onClick={() =>
            strip.current?.scrollBy({ left: 400, behavior: "smooth" })
          }
        >
          <ChevronRight />
        </Button>
      </div>
    </section>
  );
}

function OrderTable({
  rows,
  meal,
  date,
  today,
  timezone,
  catererId,
  schedule,
  loading,
  refresh,
  scheduleGrouping,
  scheduleFilter,
}: {
  rows: SellerDelivery[];
  scheduleGrouping: string;
  scheduleFilter?: React.ReactNode;
  meal: string;
  date: string;
  today: string;
  timezone: string;
  catererId: string;
  schedule: boolean;
  loading: boolean;
  refresh: () => void;
}) {
  const { t, locale, perform } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState("");
  const [grouping, setGrouping] = useState("package");
  const groups =
    schedule && scheduleGrouping !== "flat"
      ? [
          ...Map.groupBy(rows, (row) =>
            scheduleGrouping === "customers"
              ? row.customer.id
              : destinationKey(row.address),
          ),
        ].map(([key, items]) => ({
          key,
          rows: items,
          name:
            scheduleGrouping === "customers"
              ? items[0].customer.name
              : items[0].address.line,
          area:
            scheduleGrouping === "destinations" ? items[0].address.area : "",
          menu: "",
          portions: scheduleSummary(items, meal, true).portions,
        }))
      : operationalGroups(rows, meal, schedule ? "flat" : grouping);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const all = useRef<HTMLInputElement>(null);
  const eligible = rows.filter(
    (d) =>
      date <= today && nextDeliveryStatuses(fulfillmentStatus(d, meal)).length,
  );
  const chosen = eligible.filter((d) => selected.includes(d.id));
  const options = chosen.length
    ? nextDeliveryStatuses(fulfillmentStatus(chosen[0], meal)).filter((s) =>
        chosen.every((d) =>
          nextDeliveryStatuses(fulfillmentStatus(d, meal)).includes(s),
        ),
      )
    : [];
  const effectiveTarget = options.includes(target) ? target : options[0] || "";
  const d = rows.find((d) => d.id === detail);
  const actionLabel = (status: string) =>
    ({
      preparing: t("Mulai siapkan", "Start preparing"),
      out_for_delivery: t("Mulai antar", "Start delivery"),
      delivered: t("Tandai diterima", "Mark delivered"),
      issue: t("Tandai kendala", "Report issue"),
    })[status] || statusLabel(status, locale);
  const actionIcon = (status: string) =>
    status === "preparing" ? (
      <ChefHat size={18} aria-hidden="true" />
    ) : status === "out_for_delivery" ? (
      <Truck size={18} aria-hidden="true" />
    ) : status === "issue" ? (
      <CircleAlert size={18} aria-hidden="true" />
    ) : (
      <Check size={18} aria-hidden="true" />
    );
  function openDetail(id: string, button: HTMLElement) {
    opener.current = button;
    setDetail(id);
  }
  function closeDetail() {
    setDetail("");
    requestAnimationFrame(() => opener.current?.focus());
  }
  useEffect(() => {
    if (detail) {
      detailRef.current?.focus();
      detailRef.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    }
  }, [detail]);
  useEffect(() => {
    if (all.current)
      all.current.indeterminate =
        chosen.length > 0 && chosen.length < eligible.length;
  }, [chosen.length, eligible.length]);
  async function update(items: SellerDelivery[], status: string) {
    if (busy || loading) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await perform("delivery.statusBatch", {
        catererId,
        date,
        meal,
        status,
        items: items.map((d) => ({ id: d.id, version: d.version })),
      });
      setSelected([]);
      setSuccess(
        `${items.length} ${t("pesanan diperbarui", "orders updated")} · ${statusLabel(status, locale)}`,
      );
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(
        code === "CONFLICT"
          ? t(
              "Pesanan telah berubah. Tidak ada perubahan pada batch ini. Tinjau status terbaru sebelum mencoba lagi.",
              "Orders changed. This batch made no changes. Review the latest statuses before retrying.",
            )
          : code === "INVALID_STATE"
            ? t(
                "Status pilihan tidak lagi sesuai. Tidak ada pesanan yang diubah; tinjau ulang pilihan.",
                "The selected transition is no longer valid. No orders changed; review your selection.",
              )
            : t(
                "Pembaruan belum berhasil. Muat ulang dan coba lagi; permintaan yang sama aman diulang.",
                "Could not complete the update. Refresh and retry; the same request can be retried safely.",
              ),
      );
      refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={"master-detail ops-order-layout " + (d ? "has-detail" : "")}
    >
      <section className="panel ops-orders-panel" aria-busy={busy || loading}>
        <div className="section-heading">
          <h2>
            {schedule
              ? t("Daftar pesanan", "Order list")
              : t("Pesanan", "Orders") + " · " + date}
          </h2>
          <span className="muted">
            {rows.length} {t("pesanan", "orders")}
          </span>
        </div>
        {!schedule && date > today && (
          <p className="notice">
            {t(
              "Status dapat diperbarui pada hari pengantaran.",
              "Statuses can be updated on the delivery day.",
            )}
          </p>
        )}
        {success && (
          <p role="status" className="save-status">
            <Check size={18} aria-hidden="true" />
            {success}
          </p>
        )}
        {error && (
          <div role="alert" className="notice error">
            {error}
            <Button className="text-button" onClick={refresh}>
              {t("Muat ulang", "Refresh")}
            </Button>
          </div>
        )}
        {!schedule && chosen.length > 0 && (
          <div
            className="ops-bulk-toolbar"
            role="group"
            aria-label={t("Perbarui pilihan", "Update selected orders")}
          >
            <strong>
              {chosen.length} {t("dipilih", "selected")}
            </strong>
            {options.length ? (
              <>
                <Select
                  aria-label={t("Status tujuan", "Target status")}
                  value={effectiveTarget}
                  onValueChange={setTarget}
                  disabled={busy || loading}
                >
                  {options.map((s) => (
                    <SelectOption key={s} value={s}>
                      {statusLabel(s, locale)}
                    </SelectOption>
                  ))}
                </Select>
                <Button
                  className="button small"
                  disabled={busy || loading || chosen.length > 500}
                  onClick={() => update(chosen, effectiveTarget)}
                >
                  {actionIcon(effectiveTarget)}
                  {busy
                    ? t("Menyimpan…", "Saving…")
                    : `${actionLabel(effectiveTarget)} · ${chosen.length}`}
                </Button>
              </>
            ) : (
              <span>
                {t(
                  "Pilih pesanan dengan langkah status berikutnya yang sama.",
                  "Select orders with a shared next status.",
                )}
              </span>
            )}
            {chosen.length > 500 && (
              <span>
                {t(
                  "Maksimal 500 pesanan per pembaruan.",
                  "Select up to 500 orders per update.",
                )}
              </span>
            )}
            <Button
              className="text-button"
              disabled={busy}
              onClick={() => setSelected([])}
            >
              {t("Batal pilih", "Clear selection")}
            </Button>
          </div>
        )}
        {scheduleFilter}
        <div className="ops-list-toolbar">
          {!schedule && rows.length > 0 && (
            <label className="checkbox ops-select-all">
              <Checkbox
                ref={all}
                aria-label={t("Pilih semua pesanan", "Select all orders")}
                disabled={!eligible.length || busy || loading}
                checked={
                  eligible.length > 0 && chosen.length === eligible.length
                }
                onChange={(e) =>
                  setSelected(e.target.checked ? eligible.map((d) => d.id) : [])
                }
              />
              <span>{t("Pilih semua pesanan", "Select all orders")}</span>
            </label>
          )}
          {!schedule && (
            <Select
              aria-label={t("Kelompokkan pesanan", "Group orders")}
              value={grouping}
              onValueChange={setGrouping}
            >
              <SelectOption value="package">
                {t("Paket & menu", "Package & menu")}
              </SelectOption>
              <SelectOption value="area">
                {t("Paket, menu & area", "Package, menu & area")}
              </SelectOption>
              <SelectOption value="flat">
                {t("Daftar biasa", "Flat list")}
              </SelectOption>
            </Select>
          )}
        </div>
        {loading && !rows.length ? (
          <Loading />
        ) : rows.length ? (
          <div className="table-wrap">
            <table
              role="table"
              className={
                "ops-order-table" + (schedule ? " ops-schedule-table" : "")
              }
            >
              <thead>
                <tr>
                  {!schedule && (
                    <th>
                      <span className="sr-only">
                        {t("Pilih pesanan", "Select orders")}
                      </span>
                    </th>
                  )}
                  <th>{t("Pelanggan", "Customer")}</th>
                  <th>{t("Alamat", "Address")}</th>
                  {schedule && (
                    <>
                      <th>{t("Paket", "Package")}</th>
                      <th>{t("Waktu makan", "Meal period")}</th>
                    </>
                  )}
                  <th className="number">{t("Porsi", "Portions")}</th>
                  {!schedule && <th>{t("Status", "Status")}</th>}
                  <th>{t("Detail", "Detail")}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.key}>
                    {(schedule
                      ? scheduleGrouping !== "flat"
                      : grouping !== "flat") && (
                      <tr className="ops-group-heading">
                        <th colSpan={6} scope="rowgroup">
                          <div className="ops-group-summary">
                            <div>
                              <strong>
                                {group.name}
                                {group.area ? ` · ${group.area}` : ""}
                              </strong>
                              {!schedule && (
                                <small>
                                  {group.menu ||
                                    t("Katerer memilih", "Caterer chooses")}
                                </small>
                              )}
                            </div>
                            <span>
                              {group.rows.length} {t("pesanan", "orders")} ·{" "}
                              {group.portions}{" "}
                              {t(
                                schedule ? "porsi makan" : "porsi",
                                schedule ? "meal portions" : "portions",
                              )}
                            </span>
                          </div>
                        </th>
                      </tr>
                    )}
                    {group.rows.map((x) => (
                      <tr
                        key={x.id}
                        className={
                          selected.includes(x.id) || detail === x.id
                            ? "selected"
                            : ""
                        }
                      >
                        {!schedule && (
                          <td>
                            <Checkbox
                              aria-label={`${t("Pilih", "Select")} ${x.customer.name}, ${x.address.label}, ${x.offer.name}`}
                              checked={chosen.some((d) => d.id === x.id)}
                              disabled={
                                !eligible.some((d) => d.id === x.id) ||
                                busy ||
                                loading
                              }
                              onChange={(e) =>
                                setSelected(
                                  e.target.checked
                                    ? [...selected, x.id]
                                    : selected.filter((id) => id !== x.id),
                                )
                              }
                            />
                          </td>
                        )}
                        <td
                          data-cell="customer"
                          data-label={t("Pelanggan", "Customer")}
                        >
                          <strong>{x.customer.name}</strong>
                          {!schedule && (grouping === "flat" || x.trial) && (
                            <small>
                              {grouping === "flat" ? x.offer.name : ""}
                              {x.trial ? " · " + t("Trial", "Trial") : ""}
                            </small>
                          )}
                        </td>
                        <td
                          data-cell="address"
                          data-label={t("Alamat", "Address")}
                        >
                          <strong>{x.address.label}</strong>
                          <small>
                            {x.address.line}, {x.address.area}
                          </small>
                        </td>
                        {schedule && (
                          <>
                            <td
                              data-cell="package"
                              data-label={t("Paket", "Package")}
                            >
                              {x.offer.name}
                              {x.trial && <small>{t("Trial", "Trial")}</small>}
                              {x.status === "cancelled" && (
                                <Status status="cancelled" />
                              )}
                            </td>
                            <td
                              data-cell="meal"
                              data-label={t("Waktu makan", "Meal")}
                            >
                              {x.meals
                                .filter(
                                  (m) => meal === "all" || m.meal === meal,
                                )
                                .map((m) => (
                                  <small key={m.meal}>
                                    {m.meal === "lunch"
                                      ? t("Siang", "Lunch")
                                      : t("Malam", "Dinner")}
                                  </small>
                                ))}
                            </td>
                          </>
                        )}
                        <td
                          data-cell="portions"
                          data-label={t("Porsi", "Portions")}
                          className="number"
                        >
                          {x.portions}
                          {schedule && meal === "all" && x.meals.length > 1 && (
                            <small>{t("per waktu makan", "per meal")}</small>
                          )}
                        </td>
                        {!schedule && (
                          <td
                            data-cell="status"
                            data-label={t("Status", "Status")}
                          >
                            <Status status={fulfillmentStatus(x, meal)} />
                          </td>
                        )}
                        <td data-cell="actions">
                          <Button
                            className="text-button"
                            aria-label={`${t("Detail", "Details")} ${x.customer.name}, ${x.address.label}, ${x.offer.name}`}
                            onClick={(event) =>
                              openDetail(x.id, event.currentTarget)
                            }
                          >
                            {t("Detail", "Details")} <ArrowUpRight size={15} />
                          </Button>
                          {!schedule &&
                            date <= today &&
                            nextDeliveryStatuses(fulfillmentStatus(x, meal))
                              .slice(0, 1)
                              .map((next) => (
                                <Button
                                  key={next}
                                  type="button"
                                  className="button secondary small order-next"
                                  disabled={busy || loading}
                                  aria-label={`${actionLabel(next)}: ${x.customer.name}, ${x.offer.name}`}
                                  onClick={() => update([x], next)}
                                >
                                  {actionIcon(next)}
                                  {actionLabel(next)}
                                </Button>
                              ))}
                          {!schedule && date > today && (
                            <small>
                              {t(
                                "Tersedia pada hari pengantaran",
                                "Available on delivery day",
                              )}
                            </small>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={t("Tidak ada pesanan", "No orders")}
            description={t(
              "Tidak ada pesanan yang cocok dengan tanggal dan filter ini.",
              "No orders match this date and these filters.",
            )}
          />
        )}
      </section>
      {d && (
        <aside
          ref={detailRef}
          tabIndex={-1}
          className="panel detail-panel"
          aria-label={t("Detail pesanan", "Order details")}
        >
          <Button className="text-button" onClick={closeDetail}>
            <ArrowLeft size={18} aria-hidden="true" />
            {t("Tutup detail", "Close details")}
          </Button>
          <h2>{d.customer.name}</h2>
          <p>{d.offer.name}</p>
          <Facts
            rows={[
              [t("Tanggal", "Date"), d.service_date],
              [t("Alamat", "Address"), d.address.line + ", " + d.address.area],
              [t("Catatan", "Instructions"), d.address.instructions || "—"],
              [t("Porsi per waktu makan", "Portions per meal"), d.portions],
              [
                t("Batas perubahan", "Change cutoff"),
                new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: timezone,
                }).format(new Date(d.cutoff_at)) +
                  " · " +
                  timezone,
              ],
              ...d.meals.map(
                (m) =>
                  [
                    m.meal === "lunch"
                      ? t("Siang", "Lunch")
                      : t("Malam", "Dinner"),
                    <Status
                      key={m.meal}
                      status={fulfillmentStatus(d, m.meal)}
                    />,
                  ] as [string, React.ReactNode],
              ),
            ]}
          />
          {!schedule && date <= today && (
            <div className="ops-detail-actions">
              {nextDeliveryStatuses(fulfillmentStatus(d, meal)).map((s) => (
                <Button
                  className="button secondary small"
                  key={s}
                  disabled={busy || loading}
                  onClick={() => update([d], s)}
                >
                  {actionIcon(s)}
                  {actionLabel(s)}
                </Button>
              ))}
            </div>
          )}
          {schedule && (
            <Link
              className="button secondary spaced"
              href={`/seller?date=${date}&meal=${meal === "all" ? d.meals[0].meal : meal}`}
            >
              {t(
                "Buka operasional tanggal ini",
                "Open operations for this date",
              )}
            </Link>
          )}
        </aside>
      )}
    </div>
  );
}
