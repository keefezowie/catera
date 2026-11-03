"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { HTMLAttributes, ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Clock,
  Clock3,
  Landmark,
  Library,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Moon,
  Package,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Store,
  Sun,
  Users,
  Utensils,
  Wallet,
} from "lucide-react";
import { areaOptions, localDay, statusLabel } from "@catera/domain";
import {
  datesBetween,
  monthEnd,
  monthOf,
  validDay,
  weekStart,
} from "../lib/meal-calendar";
import { useApp } from "./context";
import { Heading } from "./ui";
import { Sk, SkImg } from "./skeletons";
import styles from "./seller-account.module.css";
import "./skeleton.css";
import "./skeletons-dapur.css";

/* Dapur and admin screens while they load. Each renders the loaded screen's own containers and classes, so the
   screen's CSS sizes every block; data text is a bar inside its real element and every control is held at its size. */

type Tag = "div" | "section" | "span" | "button" | "a";

/** The busy wrapper: the real container (or none, for a fragment) with one "Memuat…" for screen readers. */
function Busy({
  as: El = "div",
  className = "",
  children,
  ...rest
}: {
  as?: "div" | "section";
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  const { t } = useApp();
  return (
    <El
      {...rest}
      className={(className ? className + " " : "") + "skeleton-screen"}
      aria-busy="true"
    >
      <span className="sr-only" role="status">
        {t("Memuat…", "Loading…")}
      </span>
      {children}
    </El>
  );
}

/** A real control (button, link, tab) held at its size and shape, its label hidden. */
function Hold({
  as: El = "span",
  className = "",
  children,
}: {
  as?: Tag;
  className?: string;
  children: ReactNode;
}) {
  return (
    <El
      className={className + " sk sk-ghost"}
      aria-hidden="true"
      tabIndex={-1}
      {...(El === "button" ? { type: "button" as const } : {})}
    >
      {children}
    </El>
  );
}

/** A bar for a flex item's text, keeping that text's line box. */
const Bar = ({ w }: { w: string }) => (
  <bdi>
    <Sk w={w} />
  </bdi>
);

const Dot = ({ size = 20 }: { size?: number }) => (
  <span className="sk sk-dot" style={{ width: size, height: size }} />
);

const HoldInput = () => (
  <input
    className="catera-input sk sk-ghost"
    readOnly
    tabIndex={-1}
    aria-hidden="true"
  />
);

const HoldArea = () => (
  <textarea
    className="catera-textarea sk sk-ghost"
    readOnly
    tabIndex={-1}
    aria-hidden="true"
  />
);

const HoldSelect = ({ label = "Bahasa Indonesia" }: { label?: string }) => (
  <Hold as="button" className="select-trigger">
    <span>{label}</span>
    <ChevronDown size={16} aria-hidden="true" />
  </Hold>
);

const HoldDate = () => (
  <span className="date-picker date-picker-compact">
    <Hold as="button" className="date-picker-trigger">
      <CalendarDays size={17} aria-hidden="true" />
      <span>00 Nov 0000</span>
    </Hold>
  </span>
);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Submit({ label, icon }: { label: string; icon?: ReactNode }) {
  const { t } = useApp();
  return (
    <Hold as="button" className="button form-submit">
      <span className="form-submit-label">
        {icon || <Check size={17} aria-hidden="true" />}
        {label}
      </span>
      <span className="form-submit-pending">
        <LoaderCircle size={18} aria-hidden="true" />
        {t("Memproses…", "Processing…")}
      </span>
    </Hold>
  );
}

/** A checkbox row at its size; the box is the real control, unticked and inert. */
function CheckRow({ children }: { children: ReactNode }) {
  return (
    <label className="checkbox">
      <span className="checkbox-control">
        <input
          type="checkbox"
          className="catera-checkbox"
          disabled
          tabIndex={-1}
          aria-hidden="true"
        />
        <span className="checkbox-mark" aria-hidden="true" />
      </span>
      {children}
    </label>
  );
}

/** A collapsed disclosure, held shut. */
function Closed({
  title,
  description,
  className = "",
  variant = "inline",
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  variant?: "inline" | "panel";
}) {
  return (
    <details className={`disclosure disclosure-${variant} ${className}`} inert>
      <summary>
        <span className="disclosure-heading">
          <span className="disclosure-title">{title}</span>
          {description && (
            <span className="disclosure-description">{description}</span>
          )}
        </span>
        <ChevronDown
          className="disclosure-chevron"
          size={18}
          aria-hidden="true"
        />
      </summary>
      <div className="disclosure-body flow" />
    </details>
  );
}

const SkStatus = ({ w = "4.5em" }: { w?: string }) => (
  <span className="status">
    <span />
    <Bar w={w} />
  </span>
);

/** The page heading with a data line under the title (the caterer's name, the date). */
function DataHeading({
  title,
  w = "7em",
  children,
}: {
  title: string;
  w?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>
          <Sk w={w} />
        </p>
      </div>
      {children}
    </div>
  );
}

const rows3 = ["a", "b", "c"];

/* ---------- Operations: Hari ini and Jadwal ---------- */

/** One order-table body: the head and three rows, with the loaded table's cells and labels. */
function OrderTable({ schedule }: { schedule: boolean }) {
  const { t } = useApp();
  return (
    <div className="table-wrap">
      <table
        role="table"
        className={"ops-order-table" + (schedule ? " ops-schedule-table" : "")}
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
          {!schedule && (
            <tr className="ops-group-heading">
              <th colSpan={6} scope="rowgroup">
                <div className="ops-group-summary">
                  <div>
                    <strong>
                      <Sk w="9em" />
                    </strong>
                    <small>
                      <Sk w="12em" /> <Sk w="10em" />
                    </small>
                  </div>
                  <span>
                    <Sk w="7em" />
                  </span>
                </div>
              </th>
            </tr>
          )}
          {["7em", "6em", "8em"].map((w) => (
            <tr key={w}>
              {!schedule && (
                <td>
                  <span className="checkbox-control">
                    <input
                      type="checkbox"
                      className="catera-checkbox"
                      disabled
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <span className="checkbox-mark" aria-hidden="true" />
                  </span>
                </td>
              )}
              <td data-cell="customer" data-label={t("Pelanggan", "Customer")}>
                <strong>
                  <Sk w={w} />
                </strong>
                {!schedule && (
                  <small>
                    <Sk w="3em" />
                  </small>
                )}
              </td>
              <td data-cell="address" data-label={t("Alamat", "Address")}>
                <strong>
                  <Sk w="4em" />
                </strong>
                <small>
                  <Sk w="14em" />
                  <br />
                  <Sk w="8em" />
                </small>
              </td>
              {schedule && (
                <>
                  <td data-cell="package" data-label={t("Paket", "Package")}>
                    <Sk w="9em" />
                    <small>
                      <Sk w="3em" />
                    </small>
                  </td>
                  <td data-cell="meal" data-label={t("Waktu makan", "Meal")}>
                    <small>
                      <Sk w="3em" />
                    </small>
                    <small>
                      <Sk w="3em" />
                    </small>
                  </td>
                </>
              )}
              <td
                data-cell="portions"
                data-label={t("Porsi", "Portions")}
                className="number"
              >
                <Sk w="1em" />
                {schedule && (
                  <small>
                    <Sk w="4em" />
                    <br />
                    <Sk w="3em" />
                  </small>
                )}
              </td>
              {!schedule && (
                <td data-cell="status" data-label={t("Status", "Status")}>
                  <SkStatus w="5em" />
                </td>
              )}
              <td data-cell="actions">
                <div className="ops-row-actions">
                  <Hold as="button" className="text-button">
                    {t("Detail", "Details")} <ArrowUpRight size={15} />
                  </Hold>
                  {!schedule && (
                    <Hold
                      as="button"
                      className="button secondary small order-next"
                    >
                      {t("Mulai siapkan", "Start preparing")}
                    </Hold>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The order table while a new date loads inside the loaded Operations page. */
export function OrderRowsSkeleton({ schedule }: { schedule: boolean }) {
  return (
    <Busy className="sk-contents">
      <OrderTable schedule={schedule} />
    </Busy>
  );
}

/** The kitchen & delivery list while its date catches up. */
export function ProductionSkeleton() {
  const { t } = useApp();
  return (
    <Busy as="section" className="panel">
      <div className="section-heading">
        <div>
          <h2>
            {t("Daftar dapur & pengantaran", "Kitchen & delivery list")} ·{" "}
            <Sk w="6em" />
          </h2>
          <strong>
            <Sk w="16em" />
          </strong>
          <p>
            {t(
              "Sehari penuh: semua paket, termasuk coba paket, makan siang dan malam. Filter di atas tidak mengubah daftar ini.",
              "Whole day: all packages, including trials, lunch and dinner. The filters above do not change this list.",
            )}
          </p>
        </div>
        <Hold as="button" className="button secondary small">
          {t("Cetak", "Print")}
        </Hold>
      </div>
      {rows3.map((k) => (
        <p key={k}>
          <Sk w="60%" />
        </p>
      ))}
    </Busy>
  );
}

/** Hari ini and Jadwal: heading, (calendar strip), scope bar, service totals with needs-attention, and the orders. */
export function OperationsSkeleton({ schedule }: { schedule: boolean }) {
  const { t, locale } = useApp();
  const query = useSearchParams();
  const requested = query.get("date") || "";
  const title = schedule
    ? t("Jadwal pesanan", "Order schedule")
    : !validDay(requested) || requested === localDay()
      ? t("Hari ini", "Today")
      : t("Operasional", "Operations");
  return (
    <Busy className="seller-operations flow" data-schedule={schedule}>
      <DataHeading title={title} w="16em">
        <Hold as="a" className="button secondary">
          <ChefHat size={18} />
          {t(
            "Daftar dapur & pengantaran · sehari penuh",
            "Kitchen & delivery list · whole day",
          )}
        </Hold>
      </DataHeading>
      {schedule && (
        <section className="ops-calendar">
          <div className="coverage-toolbar">
            <div className="ops-month-controls">
              <Hold as="button" className="icon-button">
                <ChevronLeft size={19} />
              </Hold>
              <CalendarDays size={19} />
              <strong>
                <Sk w="7em" />
              </strong>
              <Hold as="button" className="icon-button">
                <ChevronRight size={19} />
              </Hold>
            </div>
            <div className="calendar-shortcuts">
              <HoldDate />
              <Hold as="button" className="button secondary small">
                {t("Hari ini", "Today")}
              </Hold>
            </div>
          </div>
          <div className="coverage-navigation">
            <Hold as="button" className="icon-button calendar-scroll-arrow">
              <ChevronLeft />
            </Hold>
            <div className="coverage-strip">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <Hold as="button" className="coverage-day" key={d}>
                  <span className="coverage-day-top">Min</span>
                  <strong>{d}</strong>
                  <span className="coverage-info">
                    <span className="coverage-meal-icons">
                      <Sun size={16} />
                    </span>
                    <small>0 pesanan</small>
                  </span>
                </Hold>
              ))}
            </div>
            <Hold as="button" className="icon-button calendar-scroll-arrow">
              <ChevronRight />
            </Hold>
          </div>
        </section>
      )}
      <section className="ops-scope-area">
        <div className="ops-scope-field ops-date">
          <span>{t("Tanggal", "Date")}</span>
          <HoldDate />
        </div>
        <div className="ops-meal-tabs">
          {(schedule ? ["all", "lunch", "dinner"] : ["lunch", "dinner"]).map(
            (m, i) => (
              <Hold as="button" key={m} className={i ? "" : "selected"}>
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
                {m !== "all" && <small>· 0 porsi</small>}
              </Hold>
            ),
          )}
        </div>
        <div className="ops-filter-actions">
          <Hold as="button" className="button secondary ops-filter-toggle">
            {schedule
              ? t("Filter & kelompokkan pesanan", "Filter & group orders")
              : t("Filter pesanan", "Order filters")}
          </Hold>
        </div>
        <div className="ops-extra-filters" data-open={false} />
      </section>
      <div
        className={schedule ? "ops-planning-summary" : "ops-service-overview"}
      >
        {schedule ? (
          <div className="ops-scope-summary">
            <strong>
              <Sk w="11em" />
            </strong>
            <span>{t("Sesuai filter tabel", "Matching table filters")}</span>
          </div>
        ) : (
          <>
            <section className="panel ops-workload">
              <div className="ops-workload-heading">
                <h2>
                  <Sk w="13em" />
                </h2>
                <Hold as="a" className="text-button">
                  {t("Lihat pesanan", "View orders")}{" "}
                  <ArrowRight size={16} aria-hidden="true" />
                </Hold>
              </div>
              <p>
                <Sk w="20em" /> <Sk w="12em" />
              </p>
              <div className="ops-stages">
                {[
                  "scheduled",
                  "preparing",
                  "out_for_delivery",
                  "delivered",
                  "issue",
                ].map((s) => (
                  <Hold as="button" className="button secondary" key={s}>
                    {statusLabel(s, locale)}: <strong>0 porsi</strong>
                  </Hold>
                ))}
              </div>
              <p className="ops-visible-summary">
                <Sk w="9em" /> <Sk w="9em" />
              </p>
            </section>
            <section
              className="panel spaced seller-attention"
              data-empty="true"
            >
              <div className="section-heading">
                <div>
                  <h2>
                    <CircleAlert size={20} aria-hidden="true" />{" "}
                    {t("Perlu perhatian", "Needs attention")} <Sk w="1.6em" />
                  </h2>
                </div>
                <Hold
                  as="button"
                  className="text-button attention-desktop-toggle"
                >
                  {t("Lihat masalah", "View issues")}
                </Hold>
              </div>
              <p className="muted attention-scope-summary">
                <Sk w="19em" />
              </p>
              <Hold as="button" className="text-button attention-scope-toggle">
                {t("Filter masalah", "Filter issues")}
              </Hold>
              <div className="attention-scope-details" data-open={false} />
              <p className="quiet-empty">
                <Sk w="80%" />
                <br />
                <Sk w="40%" />
              </p>
            </section>
          </>
        )}
      </div>
      <div id="ops-orders">
        <div className="master-detail ops-order-layout">
          <section className="panel ops-orders-panel">
            <div className="ops-order-header">
              <div className="section-heading">
                <h2>
                  {schedule ? (
                    t("Daftar pesanan", "Order list")
                  ) : (
                    <>
                      {t("Pesanan", "Orders")} · <Sk w="5em" />
                    </>
                  )}
                </h2>
                <span className="muted">
                  <Sk w="5em" />
                </span>
              </div>
              <div className="ops-list-toolbar">
                {!schedule && (
                  <>
                    <CheckRow>
                      <span>
                        {t("Pilih semua pesanan", "Select all orders")}
                      </span>
                    </CheckRow>
                    <HoldSelect label={t("Paket & menu", "Package & menu")} />
                  </>
                )}
              </div>
            </div>
            <OrderTable schedule={schedule} />
          </section>
        </div>
      </div>
      {schedule ? (
        <Closed
          className="ops-production spaced"
          title={t("Daftar dapur & pengantaran", "Kitchen & delivery lists")}
        />
      ) : (
        <Closed
          className="ops-task-help"
          title={t("Cara memperbarui pesanan", "How to update orders")}
        />
      )}
    </Busy>
  );
}

/* ---------- Seller workspace ---------- */

const workspaceTitles = (t: (id: string, en: string) => string) =>
  ({
    packages: t("Paket", "Packages"),
    menus: t("Menu", "Menus"),
    dishes: t("Daftar hidangan", "Dish library"),
    customers: t("Pelanggan", "Customers"),
    support: t("Pesan & bantuan", "Messages & support"),
    transactions: t("Transaksi & pencairan", "Transactions & payouts"),
    settings: t("Pengaturan", "Settings"),
    profile: t("Profil katering", "Caterer profile"),
  }) as Record<string, string>;

function PackagesBody() {
  const { t, actor } = useApp();
  return (
    <>
      <div className="section-heading">
        <p>
          {t(
            "Harga dasar dan isi paket yang sudah tayang tetap. Pilihan durasi dan diskonnya bisa diatur untuk pembelian berikutnya.",
            "Published base prices and contents stay fixed. You can update duration options and savings for future purchases.",
          )}
        </p>
        {actor?.role === "owner" && (
          <Hold as="button" className="button">
            <Plus size={17} />
            {t("Buat paket", "Create package")}
          </Hold>
        )}
      </div>
      <div className="seller-packages">
        {["9em", "8em", "10em"].map((w) => (
          <article className="panel" key={w}>
            <SkImg width={400} height={300} />
            <div>
              <SkStatus />
              <h2>
                <Sk w={w} />
              </h2>
              <p>
                <Sk w="12em" />
              </p>
              <strong>
                <Sk w="6em" />
              </strong>
            </div>
            <Hold as="button" className="button secondary">
              {t("Lihat rincian paket", "View package details")}
            </Hold>
            <Hold as="a" className="button secondary">
              {t("Kelola menu", "Manage menus")}
            </Hold>
            {actor?.role === "owner" && (
              <Closed
                className="package-secondary-settings"
                title={t(
                  "Pengaturan paket lanjutan",
                  "Advanced package settings",
                )}
              />
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function MenusBody() {
  const { t, locale } = useApp();
  const query = useSearchParams();
  const today = localDay();
  const month = /^\d{4}-(0[1-9]|1[0-2])-01$/.test(query.get("month") || "")
    ? query.get("month")!
    : monthOf(validDay(query.get("date") || "") ? query.get("date")! : today);
  return (
    <div className="menu-workspace">
      <div className="menu-context">
        <Field label={t("Paket", "Package")}>
          <HoldSelect />
        </Field>
        <Hold as="button" className="text-button menu-library-trigger">
          <Library size={18} />
          {t("Pustaka hidangan", "Dish library")}
        </Hold>
      </div>
      <div className="menu-columns">
        <section className="menu-main">
          <div className="menu-panel-content">
            <div className="menu-month-heading">
              <Hold as="button" className="text-button">
                <ChevronLeft />
              </Hold>
              <h2>
                <Sk w="7em" />
              </h2>
              <Hold as="button" className="text-button">
                <ChevronRight />
              </Hold>
            </div>
            <div className="menu-selection-bar">
              <span>
                <Sk w="6em" />
              </span>
              <Hold as="button" className="text-button">
                {t("Pilih beberapa tanggal", "Select multiple dates")}
              </Hold>
            </div>
            <p className="menu-calendar-legend">
              <LockKeyhole size={14} aria-hidden="true" />
              {t(
                "Tanggal terkunci hanya bisa dibaca · Pilih tanggal mendatang untuk mengedit",
                "Locked dates are read only · Choose a future date to edit",
              )}
            </p>
            <div className="menu-month-grid">
              {(locale === "id"
                ? ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
                : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
              ).map((d) => (
                <span className="menu-weekday" key={d}>
                  {d}
                </span>
              ))}
              {datesBetween(weekStart(month), monthEnd(month)).map((day) =>
                day < month ? (
                  <span key={day} className="menu-day-outside" />
                ) : (
                  <Hold as="button" className="menu-day" key={day}>
                    <span className="menu-day-heading">
                      <strong>{Number(day.slice(-2))}</strong>
                    </span>
                    <span className="menu-day-empty">
                      {t("Belum diisi", "Not set")}
                    </span>
                  </Hold>
                ),
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function CustomerRow({ owner, w }: { owner: boolean; w: string }) {
  const { t } = useApp();
  return (
    <article className="panel customer-row" role="listitem">
      <header className="customer-row-header">
        <div className="customer-identity">
          <span className="customer-avatar sk" aria-hidden="true" />
          <div>
            <h2>
              <Sk w={w} />
            </h2>
            <p>
              <Sk w="9em" />
            </p>
            <div className="pilot-tags">
              <span>
                <Sk w="6em" />
              </span>
              <span>
                <Sk w="7em" />
              </span>
            </div>
          </div>
        </div>
        <div className="customer-row-metrics">
          {[
            t("Langganan", "Subscriptions"),
            t("Hari tersisa", "Days remaining"),
            t("Berikutnya", "Next delivery"),
          ].map((label) => (
            <span key={label}>
              <strong>
                <Sk w="2em" />
              </strong>
              <small>{label}</small>
            </span>
          ))}
        </div>
        <div className="customer-row-actions">
          <Hold as="button" className="button secondary">
            <CalendarDays size={16} />
            {t("Lihat jadwal", "View schedule")}
          </Hold>
          {owner && (
            <Hold as="button" className="button secondary">
              <Pencil size={16} />
              {t("Edit", "Edit")}
            </Hold>
          )}
        </div>
      </header>
      <details className="customer-subscriptions" inert>
        <summary>
          <span>
            <strong>
              <Sk w="6em" />
            </strong>
            <small>
              {t(
                "Lihat paket, pembayaran, dan tindak lanjut",
                "View packages, payments, and follow-ups",
              )}
            </small>
          </span>
          <ChevronDown size={19} aria-hidden="true" />
        </summary>
      </details>
    </article>
  );
}

function CustomerList({ owner }: { owner: boolean }) {
  const { t } = useApp();
  return (
    <>
      <div className="pilot-customer-grid customer-list" role="list">
        {["7em", "8em", "6em"].map((w) => (
          <CustomerRow key={w} owner={owner} w={w} />
        ))}
      </div>
      {owner && (
        <>
          <Closed
            className="panel customer-owner-tools"
            variant="panel"
            title={t(
              "Tindakan pemilik · impor prabayar",
              "Owner actions · prepaid import",
            )}
          />
          <Closed
            className="panel customer-owner-tools"
            variant="panel"
            title={t("Biaya & tagihan pilot", "Pilot fees & invoices")}
          />
        </>
      )}
    </>
  );
}

/** Customers below their loaded search and filter controls: three customer rows and the owner tools. */
export function CustomerListSkeleton() {
  const { actor } = useApp();
  return (
    <Busy className="sk-contents">
      <CustomerList owner={actor?.role === "owner"} />
    </Busy>
  );
}

function CustomersBody() {
  const { t, actor } = useApp();
  return (
    <div className="pilot-workspace seller-customers">
      <section className="customer-controls">
        <div className="customer-filter-bar">
          <div className="customer-view-switch">
            <Hold as="button" className="button secondary">
              {t("Semua pelanggan", "All customers")}
            </Hold>
            <Hold as="button" className="button secondary">
              {t("Perlu perpanjangan", "Renewal follow-ups")}
            </Hold>
          </div>
          <p className="customer-result-count">
            <Sk w="6em" />
          </p>
        </div>
        <form className="customer-search">
          <Field label={t("Cari pelanggan", "Search customers")}>
            <HoldInput />
          </Field>
          <Hold as="button" className="button secondary">
            {t("Cari", "Search")}
          </Hold>
        </form>
      </section>
      <CustomerList owner={actor?.role === "owner"} />
    </div>
  );
}

/** Dapur's embedded Messages panel: the conversation list and one open conversation. */
export function EmbeddedMessagesSkeleton() {
  const { t } = useApp();
  return (
    <div className="messages-page embedded" aria-busy="true">
      <div className="messages-layout">
        <aside>
          <h2>{t("Percakapan", "Conversations")}</h2>
          <Hold
            as="button"
            className="button secondary start-conversation-button"
          >
            <MessageCircle size={17} />
            {t("Mulai percakapan", "Start conversation")}
          </Hold>
          <div className="conversation-preview active">
            <span className="mini-avatar sk" />
            <div>
              <strong>
                <Sk w="6em" />
              </strong>
              <small>
                <Sk w="11em" />
              </small>
            </div>
          </div>
        </aside>
        <section className="conversation">
          <header>
            <span className="mini-avatar sk" />
            <div>
              <h2>
                <Sk w="7em" />
              </h2>
              <p>
                {t(
                  "Koordinasi dengan pelanggan",
                  "Coordinate with your customer",
                )}
              </p>
            </div>
          </header>
          <div className="chat-notice">
            <Check size={16} />
            {t(
              "Lakukan pembayaran melalui Catera agar transaksi dan bantuan tercatat.",
              "Keep payments on Catera so your purchase and support stay connected.",
            )}
          </div>
          <div className="message-stream">
            <div className="message mine">
              <p>
                <Sk w="28em" />
                <br />
                <Sk w="12em" />
              </p>
              <small>
                <Sk w="2.5em" />
              </small>
            </div>
          </div>
          <div className="form composer">
            <HoldArea />
            <Submit label={t("Kirim", "Send")} />
          </div>
        </section>
      </div>
    </div>
  );
}

function SupportBody() {
  const { t } = useApp();
  return (
    <>
      <div className="workspace-tabs">
        <button type="button" tabIndex={-1} aria-selected="true">
          <MessageCircle size={19} />
          {t("Pesan", "Messages")} <Sk w="1.4em" />
        </button>
        <button type="button" tabIndex={-1} aria-selected="false">
          <LifeBuoy size={19} />
          {t("Bantuan", "Support")} <Sk w="1.4em" />
        </button>
      </div>
      <section>
        <EmbeddedMessagesSkeleton />
      </section>
    </>
  );
}

/** A sales or purchases table: the head and three rows. */
function TransactionTable({ sales }: { sales: boolean }) {
  const { t } = useApp();
  const first = sales ? t("Penjualan", "Sale") : t("Pembelian", "Purchase");
  return (
    <div className="table-wrap">
      <table className="record-table">
        <thead>
          <tr>
            <th>{first}</th>
            <th>{t("Porsi × hari", "Portions × days")}</th>
            <th>{t("Total pelanggan", "Customer total")}</th>
            <th>{t("Status", "Status")}</th>
            <th>{t("Waktu", "Time")}</th>
          </tr>
        </thead>
        <tbody>
          {["9em", "8em", "10em"].map((w) => (
            <tr key={w}>
              <td data-label={first}>
                <strong>
                  <Sk w={w} />
                </strong>
                <small>
                  <Sk w="7em" />
                </small>
                <Closed
                  className="record-details"
                  title={
                    sales
                      ? t("Nomor penjualan", "Sale ID")
                      : t("Nomor pembelian", "Purchase ID")
                  }
                />
              </td>
              <td data-label={t("Porsi × hari", "Portions × days")}>
                <Sk w="2em" />
              </td>
              <td data-label={t("Total pelanggan", "Customer total")}>
                <Sk w="5em" />
                <small>
                  <Sk w="8em" />
                </small>
              </td>
              <td data-label={t("Status", "Status")}>
                <SkStatus />
              </td>
              <td data-label={t("Waktu", "Time")}>
                <Sk w="5em" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryRows({ kind }: { kind: string }) {
  return (
    <div className="settlement-records">
      {rows3.map((k) => (
        <div className="settlement-row" key={k}>
          <span className="settlement-row-icon">
            {kind === "payouts" ? (
              <Landmark size={20} />
            ) : (
              <Package size={20} />
            )}
          </span>
          <span className="settlement-row-main">
            <strong>
              <Sk w="9em" />
            </strong>
            <small>
              <Sk w="7em" />
            </small>
          </span>
          <span className="settlement-row-value">
            <strong>
              <Sk w="5em" />
            </strong>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Settlement history rows while their page loads. */
export function HistoryRowsSkeleton({ kind }: { kind: string }) {
  return (
    <Busy className="sk-contents">
      <HistoryRows kind={kind} />
    </Busy>
  );
}

/** One payout's detail while it loads. */
export function PayoutDetailSkeleton() {
  const { t } = useApp();
  return (
    <Busy className="settlement-detail">
      <strong className="settlement-detail-amount">
        <Sk w="6em" />
      </strong>
      <SkStatus />
      <p className="small">
        <Sk w="12em" />
      </p>
      <p className="small">
        <Sk w="16em" />
      </p>
      <h3>{t("Status yang tercatat", "Recorded status history")}</h3>
      <ol className="settlement-timeline">
        {["a", "b"].map((k) => (
          <li key={k}>
            <SkStatus />
            <small>
              <Sk w="8em" />
            </small>
          </li>
        ))}
      </ol>
      <h3>{t("Pembelian dalam pencairan", "Included purchases")}</h3>
      {["a", "b"].map((k) => (
        <div className="settlement-allocation" key={k}>
          <span>
            <strong>
              <Sk w="9em" />
            </strong>
            <small>
              <Sk w="14em" />
            </small>
          </span>
          <strong>
            <Sk w="5em" />
          </strong>
        </div>
      ))}
    </Busy>
  );
}

function Chart() {
  const { t } = useApp();
  return (
    <>
      <p className="small muted">
        <Sk w="15em" /> <Sk w="13em" />
      </p>
      <div className="settlement-chart-totals">
        {[
          ["credit-key", t("Pengantaran selesai", "Delivery earnings")],
          ["adjustment-key", t("Penyesuaian saldo", "Balance adjustments")],
        ].map(([key, label]) => (
          <div key={key}>
            <span>
              <i className={key} />
              {label}
            </span>
            <strong>
              <Sk w="5em" />
            </strong>
          </div>
        ))}
      </div>
      <div className="settlement-bars sk" aria-hidden="true" />
      <div className="settlement-chart-selection">
        <div className="settlement-day-controls">
          <button type="button" tabIndex={-1} aria-hidden="true">
            ‹
          </button>
          <strong>
            <Sk w="4em" />
          </strong>
          <button type="button" tabIndex={-1} aria-hidden="true">
            ›
          </button>
        </div>
        <span>
          <Sk w="9em" />
        </span>
        <span>
          <Sk w="9em" />
        </span>
      </div>
      <Closed title={t("Lihat data", "View data")} />
    </>
  );
}

/** The earnings chart's body while its range loads: totals, the chart area and the selected day. */
export function ChartSkeleton() {
  return (
    <Busy className="sk-contents">
      <Chart />
    </Busy>
  );
}

function PayoutSetup({
  variant,
  editable,
}: {
  variant: "full" | "destination";
  editable: boolean;
}) {
  const { t } = useApp();
  return (
    <>
      <h2>
        <Landmark size={21} />{" "}
        {t("Rekening & pencairan", "Bank account & payouts")}
      </h2>
      <p>
        <strong>
          <Sk w="8em" />
        </strong>
      </p>
      {variant === "full" && (
        <div className="payout-state">
          {[
            t("Diproses", "Processing"),
            t("Dibayar", "Paid"),
            t("Ditahan", "Held"),
          ].map((label) => (
            <p key={label}>
              <strong>{label}</strong>
              <br />
              <Sk w="3em" />
            </p>
          ))}
        </div>
      )}
      <p>
        {t(
          "Pencairan otomatis diproses Senin pukul 09.00 WIB setelah diaktifkan. Waktu masuk ke rekening bergantung pada bank.",
          "Automatic payouts process Mondays at 09:00 WIB once enabled. Bank arrival time may vary.",
        )}
      </p>
      <p>
        <Sk w="16em" />
      </p>
      <Hold as={editable ? "button" : "a"} className="button">
        {t("Atur pencairan", "Set up payout")}
      </Hold>
    </>
  );
}

/** The payout setup card while its read loads. */
export function PayoutSetupSkeleton({
  variant = "full",
  editable = false,
}: {
  variant?: "full" | "destination";
  editable?: boolean;
}) {
  return (
    <Busy as="section" className="panel" id="payout">
      <PayoutSetup variant={variant} editable={editable} />
    </Busy>
  );
}

function SettlementBody({
  tab,
  tabs,
  purchases,
}: {
  tab: string;
  tabs: { id: string; name: string }[];
  purchases?: ReactNode;
}) {
  const { t } = useApp();
  return (
    <>
      <div className="settlement-refresh">
        <Hold as="button" className="button secondary">
          {t("Perbarui saldo", "Refresh balances")}
        </Hold>
      </div>
      <section>
        <div className="settlement-heading">
          <h2>{t("Pendapatan & pencairan", "Earnings & payouts")}</h2>
        </div>
        <dl className="settlement-summary">
          {[
            [
              "available",
              t("Tersedia untuk pencairan", "Available for payout"),
              t("Pengantaran selesai", "Completed deliveries"),
            ],
            [
              "upcoming",
              t("Mendatang · nilai pengantaran", "Upcoming · delivery value"),
              t(
                "Belum tersedia untuk pencairan",
                "Not yet available for payout",
              ),
            ],
            [
              "held",
              t("Ditahan · dalam peninjauan", "Held · under review"),
              t("Dalam peninjauan", "Under review"),
            ],
            [
              "paid-out",
              t("Sudah dicairkan · ke bank", "Paid out · to bank"),
              t("Sepanjang waktu", "All time"),
            ],
          ].map(([key, label, note]) => (
            <div className={key} key={key}>
              <dt>{label}</dt>
              <dd>
                <Sk w="3em" />
                <small>{note}</small>
              </dd>
            </div>
          ))}
        </dl>
        <p className="settlement-readiness-note">
          <Clock3 size={18} aria-hidden="true" />
          <span>
            <strong>
              <Sk w="13em" />
            </strong>{" "}
            <Sk w="16em" />
          </span>
        </p>
        <Closed
          className="settlement-balance-details"
          title={t("Rincian saldo", "Balance details")}
        />
      </section>
      <section className="panel settlement-history">
        <div className="settlement-tabs">
          {tabs.map((item) => (
            <button
              type="button"
              key={item.id}
              tabIndex={-1}
              aria-selected={tab === item.id}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div>
          {tab === "purchases" ? (
            (purchases ?? (
              <section className="settlement-purchases">
                <TransactionTable sales />
              </section>
            ))
          ) : (
            <>
              {tab === "entries" && (
                <section className="settlement-chart">
                  <div className="settlement-heading">
                    <h3>{t("Pendapatan tercatat", "Earnings credited")}</h3>
                    <div className="settlement-range">
                      {[7, 30].map((n) => (
                        <button
                          type="button"
                          key={n}
                          tabIndex={-1}
                          aria-pressed={n === 30}
                        >
                          {n} {t("hari", "days")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Chart />
                </section>
              )}
              <HistoryRows kind={tab} />
              {tab === "payouts" && (
                <>
                  <section className="panel" id="payout">
                    <PayoutSetup variant="destination" editable={false} />
                  </section>
                  <Closed
                    className="spaced"
                    title={t(
                      "Pencairan pembelian lama",
                      "Legacy purchase payouts",
                    )}
                  />
                </>
              )}
            </>
          )}
        </div>
      </section>
      <Closed
        className="panel settlement-help"
        variant="panel"
        title={
          <>
            {" "}
            <CircleHelp size={18} />
            {t("Cara pendapatan dihitung", "How earnings work")}{" "}
          </>
        }
      />
    </>
  );
}

/** Earnings & payouts while the balance loads: overview, the history tabs (with the loaded sales when given) and help. */
export function SettlementSkeleton({
  tab,
  purchases,
  withSales,
}: {
  tab: string;
  purchases?: ReactNode;
  withSales: boolean;
}) {
  const { t } = useApp();
  const tabs = [
    { id: "payouts", name: t("Pencairan", "Payouts") },
    { id: "entries", name: t("Aktivitas pendapatan", "Earnings activity") },
    ...(withSales ? [{ id: "purchases", name: t("Penjualan", "Sales") }] : []),
  ];
  return (
    <Busy className="settlement-screen">
      <SettlementBody tab={tab} tabs={tabs} purchases={purchases} />
    </Busy>
  );
}

function TransactionsBody() {
  const { t, actor } = useApp();
  const query = useSearchParams();
  if (actor?.role !== "owner")
    return (
      <section className="panel">
        <h2>{t("Akses khusus pemilik", "Owner access required")}</h2>
        <p>
          {t(
            "Penjualan, rekening bank, dan pencairan hanya tersedia bagi pemilik katering. Hubungi pemilik untuk informasi keuangan.",
            "Sales, bank accounts, and payouts are available only to the caterer owner. Contact your owner for financial information.",
          )}
        </p>
        <Hold as="a" className="button secondary">
          {t("Kembali ke operasional", "Return to operations")}
        </Hold>
      </section>
    );
  const requested = query.get("tab") || "";
  const tab = ["payouts", "entries", "purchases"].includes(requested)
    ? requested
    : "purchases";
  return (
    <div className="settlement-screen">
      <SettlementBody
        tab={tab}
        tabs={[
          { id: "payouts", name: t("Pencairan", "Payouts") },
          {
            id: "entries",
            name: t("Aktivitas pendapatan", "Earnings activity"),
          },
          { id: "purchases", name: t("Penjualan", "Sales") },
        ]}
      />
    </div>
  );
}

function AccountHelpPanel({ compact }: { compact: boolean }) {
  const { t } = useApp();
  return (
    <section className="panel" id="help">
      <h2>
        <LifeBuoy size={21} /> {t("Bantuan akun", "Account help")}
      </h2>
      {compact && (
        <Closed
          title={t("Kirim permintaan", "Send request")}
          description={t(
            "Bantuan masuk, keamanan, atau penghapusan akun.",
            "Sign-in, security, or account deletion help.",
          )}
          className={styles.helpDisclosure}
        />
      )}
      <p className={styles.accountRequestsEmpty}>
        <Sk w="10em" />
      </p>
    </section>
  );
}

function SettingsBody() {
  const { t, actor } = useApp();
  const owner = actor?.role === "owner";
  const sections = [
    {
      id: "account",
      label: t("Akun pribadi", "Personal account"),
      icon: ShieldCheck,
    },
    {
      id: "business",
      label: t("Profil katering", "Caterer profile"),
      icon: Store,
    },
    ...(owner
      ? [
          {
            id: "payout",
            label: t("Rekening & pencairan", "Bank account & payouts"),
            icon: Landmark,
          },
          { id: "team", label: t("Tim katering", "Caterer team"), icon: Users },
        ]
      : []),
    { id: "help", label: t("Bantuan akun", "Account help"), icon: LifeBuoy },
  ];
  return (
    <div className={styles.settingsLayout}>
      <nav
        className={styles.sectionNav}
        aria-label={t("Bagian pengaturan", "Settings sections")}
      >
        {sections.map(({ id, label, icon: Icon }, i) => (
          <a key={id} href={"#" + id} aria-current={i ? undefined : "location"}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </a>
        ))}
      </nav>
      <div className={styles.settingsMain}>
        <div className={styles.settingsContent}>
          <section className="panel" id="account">
            <h2>{t("Akun pribadi", "Personal account")}</h2>
            <dl className={styles.accountRows}>
              <div className={styles.accountRow}>
                <dt>{t("Nama akun", "Account name")}</dt>
                <dd>
                  <Sk w="9em" />
                </dd>
              </div>
              <div className={styles.accountRow}>
                <dt>{t("Akses", "Access")}</dt>
                <dd>
                  {owner
                    ? t("Pemilik katering", "Caterer owner")
                    : t("Staf katering", "Caterer staff")}
                </dd>
              </div>
              <div className={styles.accountRow}>
                <dt>{t("Bahasa", "Language")}</dt>
                <dd>
                  <Hold
                    as="button"
                    className={"select-trigger " + styles.languageControl}
                  >
                    <span>Bahasa Indonesia</span>
                    <ChevronDown size={16} aria-hidden="true" />
                  </Hold>
                </dd>
              </div>
              <div className={styles.accountRow}>
                <dt>{t("Masuk & keamanan", "Sign-in & security")}</dt>
                <dd>
                  <a href="#help" className={styles.rowLink}>
                    {t("Bantuan akun", "Account help")}
                    <ChevronRight size={16} aria-hidden="true" />
                  </a>
                </dd>
              </div>
            </dl>
          </section>
          <section className="panel" id="business">
            <h2>{t("Profil katering", "Caterer profile")}</h2>
            <Link href="/seller/profile" className={styles.profileLink}>
              <span>
                <strong>
                  <Sk w="7em" />
                </strong>
                <span>
                  {t(
                    "Profil usaha & area pengantaran",
                    "Business profile & delivery coverage",
                  )}
                </span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </section>
          {owner && (
            <>
              <section className="panel" id="payout">
                <PayoutSetup variant="full" editable />
              </section>
              <section className="panel" id="team">
                <h2>{t("Tim katering", "Caterer team")}</h2>
                <ul className={styles.teamList}>
                  {["9em", "7em"].map((w) => (
                    <li key={w}>
                      <span>
                        <Sk w={w} />
                      </span>
                      <span>
                        <Sk w="3em" />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="form">
                  <p>
                    {t(
                      "Staf menangani operasi; akses keuangan dibatasi untuk pemilik.",
                      "Staff handle operations; financial access is limited to owners.",
                    )}
                  </p>
                  <Submit
                    label={t("Buat undangan staf", "Create staff invite")}
                  />
                </div>
              </section>
            </>
          )}
          <AccountHelpPanel compact />
        </div>
        <div className={styles.sessionActions}>
          <Hold as="button" className="text-button">
            <LogOut size={17} aria-hidden="true" />
            {t("Keluar dari sesi ini", "Sign out of this session")}
          </Hold>
        </div>
      </div>
    </div>
  );
}

function ProfileBody() {
  const { t } = useApp();
  return (
    <div className="ops-two-col">
      <section className="panel">
        <h2>{t("Profil & pengantaran", "Profile & delivery")}</h2>
        <div className="form">
          <Field label={t("Nama katering", "Caterer name")}>
            <HoldInput />
          </Field>
          <Field label={t("Tentang katering", "About the caterer")}>
            <HoldArea />
          </Field>
          <fieldset>
            <legend>{t("Area pengantaran", "Delivery area")}</legend>
            {areaOptions.map((a) => (
              <CheckRow key={a}>{a}</CheckRow>
            ))}
          </fieldset>
          <Field
            label={t(
              "Batas perubahan sehari sebelumnya",
              "Previous-day change deadline",
            )}
          >
            <span className="time-input">
              <Hold as="button" className="time-input-trigger">
                <Clock size={17} aria-hidden="true" />
                <span>00:00</span>
              </Hold>
            </span>
          </Field>
          <p>
            <Sk w="6em" />
          </p>
          <Submit
            label={t("Simpan profil", "Save profile")}
            icon={<Save size={18} />}
          />
        </div>
      </section>
      <section className="panel verification-panel">
        <div className="verification-heading">
          <h2>{t("Verifikasi", "Verification")}</h2>
          <SkStatus />
        </div>
        <p className="verification-help">
          <Sk w="100%" />
          <br />
          <Sk w="70%" />
        </p>
      </section>
      <section className="panel">
        <h2>{t("Pratinjau profil publik", "Public profile preview")}</h2>
        <h3>
          <Sk w="7em" />
        </h3>
        <p>
          <Sk w="20em" />
        </p>
        <p>
          <Sk w="16em" />
        </p>
        <Hold as="a" className="button secondary">
          {t("Lihat profil publik", "View public profile")}
        </Hold>
      </section>
    </div>
  );
}

/** A Dapur workspace page (Paket, Menu, Pelanggan, Pesan, Transaksi, Pengaturan, Profil) while the caterer loads. */
export function SellerWorkspaceSkeleton({ view }: { view: string }) {
  const { t } = useApp();
  return (
    <Busy className="sk-contents">
      <DataHeading title={workspaceTitles(t)[view] || view} />
      {view === "packages" ? (
        <PackagesBody />
      ) : view === "dishes" || view === "menus" ? (
        <MenusBody />
      ) : view === "customers" ? (
        <CustomersBody />
      ) : view === "support" ? (
        <SupportBody />
      ) : view === "transactions" ? (
        <TransactionsBody />
      ) : view === "profile" ? (
        <ProfileBody />
      ) : (
        <SettingsBody />
      )}
    </Busy>
  );
}

/** Dapur notifications: the heading, the way back and three unread rows. */
export function SellerNotificationsSkeleton({
  returnTo,
}: {
  returnTo: string;
}) {
  const { t } = useApp();
  return (
    <Busy className="notifications-page">
      <Heading title={t("Notifikasi", "Notifications")} />
      <Link className="button secondary" href={returnTo}>
        {t("Kembali ke operasional", "Return to operations")}
      </Link>
      {["18em", "24em", "15em"].map((w) => (
        <div className="notification unread" key={w}>
          <Bell size={19} aria-hidden="true" style={{ visibility: "hidden" }} />
          <div>
            <span>
              <strong>
                <Sk w={w} />
              </strong>
              <small>
                <Sk w="8em" />
              </small>
            </span>
            <Hold as="button" className="button secondary">
              {t("Tandai dibaca", "Mark as read")}
            </Hold>
          </div>
        </div>
      ))}
    </Busy>
  );
}

/** The pilot panel (inside its owner disclosure) while it loads. */
export function PilotPanelSkeleton() {
  const { t } = useApp();
  return (
    <Busy className="pilot-workspace">
      <section className="panel">
        <h2>{t("Status pilot", "Pilot status")}</h2>
        <p>
          <Sk w="22em" />
        </p>
        <p>
          <Sk w="14em" />
        </p>
      </section>
      <section className="panel">
        <h2>{t("Kesepakatan biaya", "Pricing agreements")}</h2>
        <p>
          <Sk w="20em" />
        </p>
      </section>
      <section className="panel">
        <h2>{t("Tagihan bulanan", "Monthly invoices")}</h2>
        <p>
          <Sk w="10em" />
        </p>
      </section>
    </Busy>
  );
}

/* ---------- Admin ---------- */

function QueueRows({ status = true }: { status?: boolean }) {
  return (
    <>
      {["9em", "7em", "11em"].map((w) => (
        <div className="queue-row" key={w}>
          <span>
            <strong>
              <Sk w={w} />
            </strong>
            <small>
              <Sk w="12em" />
            </small>
          </span>
          {status && <SkStatus />}
        </div>
      ))}
    </>
  );
}

function RecordTable({
  heads,
  details,
}: {
  heads: string[];
  details?: string;
}) {
  return (
    <div className="table-wrap">
      <table className="record-table">
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows3.map((k) => (
            <tr key={k}>
              {heads.map((h, i) => (
                <td key={h} data-label={h}>
                  {details && i === heads.length - 1 ? (
                    <Closed title={details} />
                  ) : (
                    <Sk w={i ? "6em" : "10em"} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const adminTitles = (t: (id: string, en: string) => string) =>
  ({
    sellers: t("Verifikasi katering", "Caterer verification"),
    transactions: t("Transaksi marketplace", "Marketplace transactions"),
    support: t("Bantuan & pengembalian dana", "Support & refunds"),
    payouts: t("Pencairan dana katering", "Caterer payouts"),
    promotions: t("Promosi historis", "Historical promotions"),
    reviews: t("Ulasan pelanggan", "Customer reviews"),
    audit: t("Riwayat audit", "Audit history"),
  }) as Record<string, string>;

/** A Catera Admin page while the admin read loads, in that view's own layout. */
export function AdminSkeleton({ view }: { view: string }) {
  const { t } = useApp();
  let body: ReactNode;
  if (view === "sellers")
    body = (
      <>
        <div className="ops-metrics">
          {[
            [ShieldCheck, t("Menunggu tinjauan", "Awaiting review")],
            [ShieldCheck, t("Katering aktif", "Active caterers")],
            [LifeBuoy, t("Permintaan terbuka", "Open requests")],
            [Wallet, t("Pembayaran bermasalah", "Payment issues")],
          ].map(([Icon, label]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <div key={label as string}>
                <I size={21} />
                <span>{label as string}</span>
                <strong>
                  <Sk w="1.2em" />
                </strong>
              </div>
            );
          })}
        </div>
        <div className="master-detail">
          <section className="panel">
            <h2>{t("Antrean verifikasi", "Verification queue")}</h2>
            <div className="queue-filters">
              <Hold as="button" className="selected">
                {t("Menunggu tinjauan", "Awaiting review")}
              </Hold>
              <Hold as="button">{t("Semua katering", "All caterers")}</Hold>
            </div>
            <QueueRows />
          </section>
        </div>
      </>
    );
  else if (view === "transactions")
    body = (
      <section className="panel">
        <TransactionTable sales={false} />
      </section>
    );
  else if (view === "support")
    body = (
      <>
        <AccountHelpPanel compact={false} />
        <section className="panel">
          <h2>{t("Permintaan & keputusan", "Requests & decisions")}</h2>
          <div className="master-detail">
            <div>
              <QueueRows />
            </div>
          </div>
        </section>
        <section className="panel spaced">
          <h2>{t("Proses pengembalian dana", "Refund processing")}</h2>
          <RecordTable
            heads={[
              t("Kasus", "Case"),
              t("Jumlah", "Amount"),
              t("Status pengembalian dana", "Refund status"),
            ]}
          />
        </section>
      </>
    );
  else if (view === "payouts")
    body = (
      <div className="ops-two-col">
        <section className="panel">
          <h2>{t("Verifikasi rekening", "Bank account review")}</h2>
          <p>
            <Sk w="16em" />
          </p>
        </section>
        <section className="panel">
          <h2>{t("Pencairan pembelian lama", "Legacy purchase payouts")}</h2>
          <div className="form">
            <Field label={t("Katering", "Caterer")}>
              <HoldSelect />
            </Field>
            <Field label={t("Catatan pemeriksaan", "Review notes")}>
              <HoldArea />
            </Field>
            <CheckRow>
              {t(
                "Transaksi, pengembalian dana, dan saldo sengketa sudah dicek.",
                "Transactions, refunds, and disputed balances have been reviewed.",
              )}
            </CheckRow>
            <p className="notice">
              {t(
                "Server menghitung saldo yang bisa dilepas. Dana dalam sengketa dikecualikan. Status berhasil hanya dicatat setelah konfirmasi penyelesaian.",
                "The server calculates the releasable balance. Disputed funds are excluded. Success is recorded only after settlement is confirmed.",
              )}
            </p>
            <Submit
              label={t(
                "Setujui pencairan tersedia",
                "Approve available payout",
              )}
            />
          </div>
        </section>
        <section className="panel">
          <h2>{t("Riwayat pencairan", "Payout history")}</h2>
          <QueueRows />
        </section>
      </div>
    );
  else if (view === "promotions")
    body = (
      <section className="panel">
        <h2>{t("Promosi historis", "Historical promotions")}</h2>
        <p>
          {t(
            "Kode promosi tidak tersedia untuk pembelian baru. Diskon porsi dan durasi ditanggung katering.",
            "Promotion codes are disabled for new purchases. Portion and multi-cycle discounts are seller-funded.",
          )}
        </p>
        {["6em", "8em", "5em"].map((w) => (
          <div className="queue-row" key={w}>
            <strong>
              <Sk w={w} />
            </strong>
            <span>
              <Sk w="2em" />
            </span>
          </div>
        ))}
      </section>
    );
  else if (view === "reviews")
    body = (
      <section className="panel">
        <h2>
          {t("Ulasan pembelian terverifikasi", "Verified purchase reviews")}
        </h2>
        {["a", "b"].map((k) => (
          <div className="support-case" key={k}>
            <strong>
              <Sk w="2.5em" />
            </strong>
            <p>
              <Sk w="24em" />
            </p>
            <div className="form">
              <Field label={t("Alasan moderasi", "Moderation reason")}>
                <HoldInput />
              </Field>
              <Submit label={t("Sembunyikan ulasan", "Hide review")} />
            </div>
          </div>
        ))}
      </section>
    );
  else
    body = (
      <section className="panel">
        <h2>{t("Riwayat audit", "Audit history")}</h2>
        <p>
          {t(
            "Riwayat bersifat permanen dan tidak bisa diedit. Menampilkan 100 kejadian terbaru.",
            "This history is permanent and cannot be edited. Showing the 100 most recent events.",
          )}
        </p>
        <RecordTable
          heads={[
            t("Waktu", "Time"),
            t("Aksi", "Action"),
            t("Pelaku", "Actor"),
            t("Detail", "Details"),
          ]}
          details={t("Lihat catatan", "View notes")}
        />
      </section>
    );
  return (
    <Busy className="sk-contents">
      <Heading
        title={adminTitles(t)[view] || t("Catera Admin", "Catera Admin")}
      />
      {body}
    </Busy>
  );
}

function RolloutForm() {
  const { t } = useApp();
  return (
    <div className="form">
      <CheckRow>
        {t("Pembelian beberapa periode", "Multi-cycle purchases")}
      </CheckRow>
      <CheckRow>
        {t("Pengiriman pencairan otomatis", "Automatic payout dispatch")}
      </CheckRow>
      <Field label={t("Alasan", "Reason")}>
        <HoldInput />
      </Field>
      <Submit label={t("Simpan kontrol", "Save controls")} />
    </div>
  );
}

/** The rollout controls form while its read loads. */
export function RolloutControlsSkeleton() {
  return (
    <Busy className="sk-contents">
      <RolloutForm />
    </Busy>
  );
}

/** A caterer's payout policy form while its settlement read loads. */
export function PolicyEditorSkeleton() {
  const { t } = useApp();
  return (
    <Busy className="sk-contents">
      <div className="form">
        <p>
          {t(
            "Setiap Senin, 09.00 WIB. Kebijakan disimpan sebagai versi baru.",
            "Every Monday, 09:00 WIB. Each policy is saved as a new version.",
          )}
        </p>
        <CheckRow>{t("Aktifkan pencairan", "Enable payouts")}</CheckRow>
        <CheckRow>{t("Data pengujian", "Synthetic testing")}</CheckRow>
        <Field label={t("Minimum pencairan (Rp)", "Minimum payout (IDR)")}>
          <HoldInput />
        </Field>
        <Field
          label={t("Maksimum per transfer (Rp)", "Maximum per transfer (IDR)")}
        >
          <HoldInput />
        </Field>
        <p className="small muted">
          {t(
            "Sesuaikan batas dengan rekening dan kanal pembayaran yang sudah diverifikasi.",
            "Match these limits to the verified recipient and payout channel.",
          )}
        </p>
        <Field label={t("Alasan", "Reason")}>
          <HoldInput />
        </Field>
        <Submit label={t("Simpan kebijakan pencairan", "Save payout policy")} />
      </div>
      <Closed
        className="spaced"
        title={t(
          "Catat pengembalian dana dari katering",
          "Record funds recovered from caterer",
        )}
      />
    </Busy>
  );
}

/** Delivery-earned settlement while the caterer list loads: the caterer picker and the rollout controls. */
export function AdminSettlementSkeleton() {
  const { t } = useApp();
  return (
    <Busy className="sk-contents">
      <Heading
        title={t(
          "Pencairan berdasarkan pengantaran",
          "Delivery-earned settlement",
        )}
      />
      <section className="panel">
        <Field label={t("Katering", "Caterer")}>
          <HoldSelect label={t("Pilih katering", "Choose caterer")} />
        </Field>
      </section>
      <section className="panel spaced">
        <h2>{t("Kontrol peluncuran", "Rollout controls")}</h2>
        <RolloutForm />
      </section>
    </Busy>
  );
}
