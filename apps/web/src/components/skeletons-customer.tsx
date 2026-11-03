"use client";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Library,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  Settings,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { localDay } from "@catera/domain";
import {
  datesBetween,
  monthEnd,
  monthOf,
  validDay,
  weekStart,
} from "../lib/meal-calendar";
import { useApp } from "./context";
import { Heading } from "./ui";
import { CatererEntry } from "./profile-menu";
import { Ghost, Screen, Sk, SkImg } from "./skeletons";
import "./menu-calendar.css";

/** A bar standing for a flex item's text: the <bdi> keeps that text's line box. */
const SkText = ({ w }: { w: string }) => (
  <bdi>
    <Sk w={w} />
  </bdi>
);

/** Bars split by a space, so they wrap where the real words would. */
const Bars = ({ w }: { w: string }) => (
  <>
    {w.split(" ").map((bar, i) => (
      <Fragment key={i}>
        {i ? " " : null}
        <Sk w={bar} />
      </Fragment>
    ))}
  </>
);

/** A status pill at its size, its label held. */
const SkStatus = ({ w = "5em" }: { w?: string }) => (
  <span className="status">
    <span />
    <SkText w={w} />
  </span>
);

/** A select trigger at its size, its value hidden. */
const SkSelect = ({ label }: { label: string }) => (
  <Ghost className="select-trigger">
    <span>{label}</span>
    <ChevronDown size={16} />
  </Ghost>
);

/** A field: its real label over a held select. The trigger is a span here, so it is given
 * the button's own 16px rather than the field label's span size. */
const SkField = ({ label }: { label: string }) => (
  <div className="field">
    <span>{label}</span>
    <Ghost className="select-trigger" style={{ fontSize: 16 }}>
      {label}
      <ChevronDown size={16} />
    </Ghost>
  </div>
);

/** A form's submit button at its size: the label and pending layers stacked as in ActionForm. */
const SkSubmit = ({ label, icon }: { label: string; icon?: ReactNode }) => {
  const { t } = useApp();
  return (
    <Ghost className="button form-submit">
      <span className="form-submit-label">
        {icon || <Check size={17} />}
        {label}
      </span>
      <span className="form-submit-pending">{t("Memproses…", "Processing…")}</span>
    </Ghost>
  );
};

/** A panel inside a loaded page: its own children, busy and announced once. */
function Busy({ children }: { children: ReactNode }) {
  const { t } = useApp();
  return (
    <div className="skeleton-panel" aria-busy="true" style={{ display: "contents" }}>
      <span className="sr-only" role="status">
        {t("Memuat…", "Loading…")}
      </span>
      {children}
    </div>
  );
}

function AddressCard() {
  const { t } = useApp();
  return (
    <div className="address-card">
      <MapPin size={20} aria-hidden="true" />
      <div>
        <h3>
          <Sk w="5em" />
        </h3>
        <p>
          <Sk w="16em" />
        </p>
        <p>
          <Sk w="11em" />
        </p>
        <small>
          <Sk w="14em" />
        </small>
      </div>
      <Ghost className="text-button">{t("Ubah", "Edit")}</Ghost>
    </div>
  );
}

/** Akun and Alamat: the sidebar is known from the session; only the saved addresses wait. */
export function AccountSkeleton({ view }: { view: string }) {
  const { actor, t } = useApp();
  return (
    <Screen
      className={
        "content account-page " + (view === "addresses" ? "addresses-page" : "")
      }
    >
      <Heading
        title={
          view === "addresses"
            ? t("Alamat pengantaran", "Delivery addresses")
            : t("Akun", "Account")
        }
      />
      <div className="account-layout">
        {view === "account" && (
          <aside className="account-sidebar">
            <div className="account-identity">
              <span className="account-avatar" aria-hidden="true">
                {actor?.name[0]}
              </span>
              <h2>{actor?.name}</h2>
            </div>
            <nav
              className="account-navigation"
              aria-label={t("Navigasi akun", "Account navigation")}
            >
              <h3>{t("Beranda", "Home")}</h3>
              {(
                [
                  ["/subscriptions", t("Langganan saya", "My subscriptions"), Package],
                  ["/saved", t("Paket tersimpan", "Saved packages"), Package],
                  ["/messages", t("Pesan", "Messages"), MessageCircle],
                  ["/notifications", t("Notifikasi", "Notifications"), Bell],
                ] as const
              ).map(([href, label, I]) => (
                <Link key={href} href={href}>
                  <I size={18} aria-hidden="true" />
                  <span>{label}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              ))}
              <h3>{t("Bantuan", "Support")}</h3>
              <Link href="/support">
                <LifeBuoy size={18} aria-hidden="true" />
                <span>
                  {t("Bantuan & pembatalan", "Support & cancellation")}
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
              {actor?.catererId && (
                <>
                  <h3>{t("Usaha katering", "Catering business")}</h3>
                  <CatererEntry>
                    <Settings size={18} aria-hidden="true" />
                    <span>{t("Dapur", "Caterer workspace")}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </CatererEntry>
                </>
              )}
            </nav>
          </aside>
        )}
        <div className="account-settings">
          {view === "addresses" && (
            <Link className="account-back text-button" href="/account">
              <ArrowLeft size={17} aria-hidden="true" />{" "}
              {t("Kembali ke akun", "Back to account")}
            </Link>
          )}
          <section className="account-section">
            <div className="account-section-heading">
              <h2>{t("Alamat tersimpan", "Saved addresses")}</h2>
              <Ghost className="button secondary small">
                <Plus size={17} />
                {t("Tambah alamat", "Add address")}
              </Ghost>
            </div>
            <AddressCard />
            <AddressCard />
            <AddressCard />
          </section>
          {view === "account" && (
            <>
              <section className="account-section">
                <div className="account-section-heading">
                  <h2>{t("Preferensi", "Preferences")}</h2>
                </div>
                <div className="account-setting-row">
                  <span>{t("Bahasa", "Language")}</span>
                  <SkSelect label="Bahasa Indonesia" />
                </div>
              </section>
              <div className="account-session">
                <Ghost className="text-button">
                  <LogOut size={17} />
                  {t("Keluar", "Sign out")}
                </Ghost>
              </div>
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}

function SupportCaseRow({ title, heading }: { title: string; heading: "h2" | "h3" }) {
  const H = heading;
  return (
    <div className="support-case">
      <div className="section-heading">
        <H>
          <Sk w={title} />
        </H>
        <SkStatus />
      </div>
      <p>
        <Sk w="22em" />
      </p>
    </div>
  );
}

function DeliveryIssuesPanel() {
  const { t } = useApp();
  return (
    <section
      className="panel spaced"
      aria-label={t("Kendala pengantaran", "Delivery issues")}
    >
      <h2>{t("Kendala pengantaran", "Delivery issues")}</h2>
      <SupportCaseRow title="12em" heading="h3" />
    </section>
  );
}

/** Kendala pengantaran: the panel and two report rows. */
export function DeliveryIssuesSkeleton() {
  return (
    <Busy>
      <DeliveryIssuesPanel />
    </Busy>
  );
}

/** A delivery report opens from this button once its delivery is read. */
export function ReportDeliveryIssueSkeleton() {
  const { t } = useApp();
  return (
    <Busy>
      <Ghost className="button secondary">
        {t("Laporkan masalah pengantaran", "Report delivery issue")}
      </Ghost>
    </Busy>
  );
}

/** Bantuan & pembatalan: the heading, the fixed notice, the delivery reports and two cases. */
export function SupportSkeleton() {
  const { t } = useApp();
  return (
    <Screen className="content narrow-wide">
      <Heading
        title={t("Bantuan & pembatalan", "Support & cancellation")}
        description={t(
          "Ceritakan kendalamu. Katering merespons lebih dulu, lalu Catera ikut membantu kalau perlu.",
          "Tell us what happened. Your caterer responds first, and Catera steps in if needed.",
        )}
      >
        <Ghost className="button">
          <Plus size={17} />
          {t("Ajukan bantuan", "Request help")}
        </Ghost>
      </Heading>
      <p className="notice">
        {t(
          "Permintaan pembatalan dan pengembalian dana dicek satu per satu. Jadwal tetap berjalan sampai ada keputusan yang dikonfirmasi.",
          "Cancellation and refund requests are reviewed one by one. Your schedule remains active until a confirmed decision.",
        )}
      </p>
      <DeliveryIssuesPanel />
      <SupportCaseRow title="10em" heading="h2" />
    </Screen>
  );
}

function DeliveryRowSkeleton() {
  return (
    <div className="delivery-row">
      <SkImg width={80} height={80} />
      <div>
        <small>
          <Sk w="11em" />
        </small>
        <h3>
          <Sk w="9em" />
        </h3>
        <p>
          <Sk w="12em" />
        </p>
      </div>
      <SkStatus />
      <ArrowUpRight size={18} style={{ visibility: "hidden" }} />
    </div>
  );
}

/** One subscription: its card, contents, facts, actions and the deliveries in it. */
export function SubscriptionDetailSkeleton() {
  const { t } = useApp();
  const facts: [string, string][] = [
    [t("Sisa pengantaran", "Remaining days"), "3em"],
    [t("Porsi tetap", "Fixed portions"), "1em"],
    [t("Mulai / selesai", "Start / end"), "12em"],
    [t("Nilai pembelian", "Purchase total"), "5em"],
    [t("Aturan", "Terms"), "5em"],
    [t("Asal pembelian", "Purchase source"), "4em"],
  ];
  return (
    <Screen className="content narrow-wide">
      <Heading
        title={t("Langganan saya", "My subscriptions")}
        description={t(
          "Setiap paket punya porsi, jadwal, dan ketentuannya sendiri.",
          "Each package keeps its own portions, schedule, and terms.",
        )}
      />
      <div className="subscription-card">
        <SkImg width={100} height={100} />
        <div>
          <small>
            <Sk w="6em" />
          </small>
          <h2 className="subscription-title">
            <Sk w="10em" />
          </h2>
          <p>
            <Sk w="8em" />
          </p>
          <span className="remaining">
            <Sk w="5em" />
          </span>
        </div>
        <ArrowUpRight size={18} style={{ visibility: "hidden" }} />
      </div>
      <div className="package-contents">
        <strong>
          <Sk w="5em" />
        </strong>
        <p className="nutrition-line">
          <Sk w="20em" />
          <small>
            <Sk w="12em" />
          </small>
        </p>
        <section className="meal-contents">
          <p className="contents-caption">
            <Sk w="11em" />
          </p>
          <p>
            <Sk w="14em" />
          </p>
          <ul className="dish-list" />
        </section>
      </div>
      <dl className="facts">
        {facts.map(([label, w]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <Sk w={w} />
            </dd>
          </div>
        ))}
      </dl>
      <details className="disclosure disclosure-inline spaced" inert>
        <summary>
          <span className="disclosure-heading">
            <span className="disclosure-title">
              {t(
                "Harga & jadwal saat pembelian",
                "Original purchase price & schedule",
              )}
            </span>
          </span>
          <ChevronDown className="disclosure-chevron" size={18} />
        </summary>
      </details>
      <div className="action-row">
        <Ghost className="button">
          {t("Beli paket berikutnya", "Buy the next package")}
          <ArrowRight size={17} />
        </Ghost>
        <Ghost className="button secondary">
          {t("Ajukan pembatalan / bantuan", "Request cancellation / help")}
        </Ghost>
      </div>
      <p className="notice">
        {t(
          "Pembelian berikutnya memakai harga dan aturan terbaru. Cek semuanya sebelum membayar.",
          "The next purchase uses current prices and terms. Review them before paying.",
        )}
      </p>
      <h2 className="spaced">
        {t("Pengantaran dalam paket", "Deliveries in this package")}
      </h2>
      <DeliveryRowSkeleton />
      <DeliveryRowSkeleton />
      <DeliveryRowSkeleton />
    </Screen>
  );
}

/** The next package: both pickers, the prepared facts, the price facts and the action. */
export function RenewSkeleton() {
  const { t } = useApp();
  const prepared: [string, string][] = [
    [t("Porsi per waktu makan", "Portions per meal"), "1em"],
    [t("Mulai", "Starts"), "6em"],
    [t("Alamat pengantaran", "Delivery address"), "10em 9em"],
  ];
  const price: [string, ReactNode][] = [
    [t("Hari pengantaran", "Delivery days"), <Sk key="d" w="1em" />],
    [t("Harga paket", "Package price"), <Sk key="p" w="6em" />],
    [t("Pengantaran", "Delivery"), t("Termasuk", "Included")],
    [
      t("Perpanjangan", "Renewal"),
      t("Manual · dibayar di awal", "Manual · paid upfront"),
    ],
  ];
  return (
    <Screen className="panel narrow">
      <Heading
        title={t("Siapkan paket berikutnya", "Prepare your next package")}
        description={t(
          "Porsi dan alamat sebelumnya sudah disiapkan. Harga dan ketentuan terbaru dicek sebelum pembayaran.",
          "Your previous portions and address are prepared. Review current prices and terms before payment.",
        )}
      />
      <SkField label={t("Paket berikutnya", "Next package")} />
      <SkField label={t("Durasi paket", "Package duration")} />
      <dl className="facts">
        {prepared.map(([label, w]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <Bars w={w} />
            </dd>
          </div>
        ))}
      </dl>
      <dl className="facts">
        {price.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="form">
        <p className="small muted">
          {t("Tidak ada pembayaran otomatis.", "There is no automatic payment.")}
        </p>
        <SkSubmit
          label={t("Pakai alamat & cek pesanan", "Use address & review purchase")}
        />
      </div>
    </Screen>
  );
}

/** A claim link: the caterer's intro, the package card and the continue action. */
export function ClaimSkeleton() {
  const { t } = useApp();
  return (
    <Screen className="claim narrow">
      <div className="claim-intro">
        <p className="claim-from">
          <Sk w="8em" />
        </p>
        <h1>
          {t(
            "Langgananmu sekarang ada di Catera",
            "Your subscription is now on Catera",
          )}
        </h1>
        <p>
          <Bars w="11em 11em 11em 11em 9em" />
        </p>
      </div>
      <div className="claim-card">
        <strong>
          <Sk w="10em" />
        </strong>
        <dl>
          <dt>{t("Sisa", "Left")}</dt>
          <dd>
            <Sk w="4em" />
          </dd>
          <dt>{t("Berikutnya", "Next")}</dt>
          <dd>
            <Sk w="9em" />
          </dd>
          <dt>{t("Alamat", "Address")}</dt>
          <dd>
            <Sk w="5em" />
          </dd>
        </dl>
      </div>
      <div className="form">
        <div className="claim-actions">
          <SkSubmit
            label={t("Lanjut dengan", "Continue with")}
            icon={<ArrowRight size={17} />}
          />
          <p className="claim-hint">
            <Bars w="14em 14em" />
          </p>
        </div>
      </div>
    </Screen>
  );
}

/** Choosing a menu: the back link, the title, the package picker and the month in its panel. */
export function CustomerMenuSkeleton({ id }: { id: string }) {
  const { t, locale } = useApp();
  // The month the calendar will most likely open on (the requested date, else today), so its week rows match.
  const requested = useSearchParams().get("date");
  const month = monthOf(requested && validDay(requested) ? requested : localDay());
  const days = datesBetween(weekStart(month), monthEnd(month));
  return (
    <Screen className="content narrow-wide">
      <Link href={"/subscriptions/" + id}>
        {t("Kembali ke paket", "Back to package")}
      </Link>
      <h1>{t("Pilih menu sendiri", "Choose your menu")}</h1>
      <div className="menu-workspace menu-workspace-customer">
        <p className="notice">
          {t(
            "Semua pilihan termasuk harga paket. Simpan sebelum batas waktu; kalau belum memilih, katering menentukan hidangan. Satu menu untuk semua porsi.",
            "All choices are included. Save before cutoff; otherwise the caterer chooses. One menu applies to all portions.",
          )}
        </p>
        <div className="menu-context">
          <SkField label={t("Paket", "Package")} />
          <Ghost className="text-button menu-library-trigger">
            <Library size={18} />
            {t("Pilihan hidangan", "Dish choices")}
          </Ghost>
        </div>
        <div className="menu-columns">
          <section className="menu-main">
            <div className="menu-panel-content">
              <div className="menu-month-heading">
                <Ghost className="text-button">
                  <ChevronLeft />
                </Ghost>
                <h2>
                  <Sk w="7em" />
                </h2>
                <Ghost className="text-button">
                  <ChevronRight />
                </Ghost>
              </div>
              <div className="menu-selection-bar">
                <span>
                  <SkText w="6em" />
                </span>
                <Ghost className="text-button">
                  {t("Pilih beberapa tanggal", "Select multiple dates")}
                </Ghost>
              </div>
              <p className="menu-calendar-legend">
                <LockKeyhole size={14} aria-hidden="true" />
                {t(
                  "Tanggal terkunci hanya bisa dibaca · Pilih tanggal mendatang untuk mengedit",
                  "Locked dates are read only · Choose a future date to edit",
                )}
              </p>
              <div className="menu-due-callout">
                <strong>
                  <Sk w="13em" />
                </strong>
                <span>
                  <Bars w="12em 12em" />
                </span>
              </div>
              <div className="menu-month-grid">
                {(locale === "id"
                  ? ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
                  : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                ).map((d) => (
                  <span className="menu-weekday" key={d}>
                    {d}
                  </span>
                ))}
                {days.map((day) => (
                  <span
                    key={day}
                    className="menu-day menu-day-unavailable"
                    style={{ opacity: 1 }}
                  >
                    <Sk w="1.4em" />
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </Screen>
  );
}

/** An open conversation while the list refreshes: its header, notice, one message and the composer. */
export function ConversationSkeleton() {
  const { t } = useApp();
  return (
    <>
      <span className="sr-only" role="status">
        {t("Memuat…", "Loading…")}
      </span>
      <header>
        <span className="mini-avatar sk" />
        <div>
          <h2>
            <Sk w="7em" />
          </h2>
          <p>
            <Sk w="14em" />
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
        <div className="message">
          <p>
            <Bars w="9em 9em 9em" />
          </p>
          <small>
            <Sk w="2.5em" />
          </small>
        </div>
      </div>
      <div className="form composer">
        <textarea
          className="catera-textarea sk sk-ghost"
          style={{ resize: "none" }}
          aria-hidden="true"
          tabIndex={-1}
          disabled
        />
        <SkSubmit label={t("Kirim", "Send")} />
      </div>
    </>
  );
}

/** Customers to message: three rows, each a held choice button. */
export function RecipientRowsSkeleton() {
  return (
    <Busy>
      {["Pelanggan satu", "Pelanggan", "Pelanggan ketiga"].map((name) => (
        <div className="request-row" key={name}>
          <Ghost className="button secondary">{name}</Ghost>
        </div>
      ))}
    </Busy>
  );
}
