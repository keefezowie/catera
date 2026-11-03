"use client";
import Link from "next/link";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  GitCompareArrows,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
} from "lucide-react";
import { useApp } from "./context";
import { Heading, Status } from "./ui";
import "./skeleton.css";

const blank =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** A text bar inside a real text element, so that element's font sets its height. */
export const Sk = ({ w }: { w: string }) => (
  <span className="sk sk-line" style={{ width: w }} />
);

/** A bar standing for a flex item's text: the <bdi> keeps that text's line box, so the line height sets the height. */
const SkText = ({ w }: { w: string }) => (
  <bdi>
    <Sk w={w} />
  </bdi>
);

/** A photo placeholder: a transparent <img> the screen's own img rules size and round. */
export const SkImg = ({
  className,
  width,
  height,
}: {
  className?: string;
  width: number;
  height: number;
}) => (
  <img
    className={"sk " + (className ?? "")}
    src={blank}
    alt=""
    aria-hidden="true"
    width={width}
    height={height}
  />
);

/** A real control kept at its size and shape, its label hidden. */
export const Ghost = ({
  className,
  children,
  style,
}: {
  className: string;
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <span className={className + " sk sk-ghost"} aria-hidden="true" style={style}>
    {children}
  </span>
);

/** The portion stepper at its size: both buttons held, the count shown as its starting 1. */
export const Stepper = () => (
  <div>
    <Ghost className="icon-button">
      <Minus size={16} />
    </Ghost>
    <strong>1</strong>
    <Ghost className="icon-button">
      <Plus size={16} />
    </Ghost>
  </div>
);

/** The screen while it loads: the same containers, out of the reading order but for one "Memuat…". */
export function Screen({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const { t } = useApp();
  return (
    <div className={className + " skeleton-screen"} aria-busy="true">
      <span className="sr-only" role="status">
        {t("Memuat…", "Loading…")}
      </span>
      {children}
    </div>
  );
}

function AgendaRow() {
  return (
    <div className="home-agenda-row">
      <span className="sk sk-dot" />
      <div>
        <small>
          <Sk w="7em" />
        </small>
        <strong>
          <Sk w="60%" />
        </strong>
        <p>
          <Sk w="40%" />
        </p>
      </div>
    </div>
  );
}

function SubscriptionRow() {
  const { t } = useApp();
  return (
    <div className="home-subscription-row">
      <div className="subscription-card compact">
        <SkImg width={100} height={100} />
        <div>
          <small>
            <Sk w="6em" />
          </small>
          <h3 className="subscription-title">
            <Sk w="9em" />
          </h3>
          <p>
            <Sk w="7em" />
          </p>
        </div>
      </div>
      <Ghost className="text-button">{t("Perpanjang", "Renew")}</Ghost>
    </div>
  );
}

/** Beranda: the next meal, the agenda and the active packages, in Beranda's own grid. */
export function HomeSkeleton() {
  const { t } = useApp();
  return (
    <Screen className="content home-page">
      <Heading title={t("Beranda", "Home")}>
        <Link className="button secondary" href="/#packages">
          {t("Jelajah katering", "Explore catering")}
          <ArrowUpRight size={17} />
        </Link>
      </Heading>
      <div className="home-overview">
        <div className="home-delivery-column">
          <section className="next-meal-card">
            <div className="next-meal-photo">
              <SkImg width={800} height={600} />
            </div>
            <div className="next-meal-content">
              <div className="caterer-line">
                <span>
                  <Sk w="8em" />
                </span>
              </div>
              <h2>
                <Sk w="70%" />
              </h2>
              <p>
                <Sk w="45%" />
              </p>
              <div className="next-meal-info">
                <span>
                  <Sk w="9em" />
                </span>
                <span>
                  <Sk w="12em" />
                </span>
              </div>
              <Ghost className="button">
                {t("Lihat pengantaran", "View delivery")}
              </Ghost>
            </div>
          </section>
          <section className="date-agenda">
            <div className="section-heading">
              <div>
                <h2>{t("Jadwal makan berikutnya", "Your next meals")}</h2>
                <p>
                  {t(
                    "Diurutkan per tanggal dan waktu makan.",
                    "Ordered by date and meal time.",
                  )}
                </p>
              </div>
              <Link className="text-button" href="/calendar">
                {t("Lihat kalender", "View calendar")}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <div className="date-agenda-groups">
              <section className="date-agenda-group">
                <h3>
                  <Sk w="6em" />
                </h3>
                <div className="date-agenda-meals">
                  <AgendaRow />
                  <AgendaRow />
                </div>
              </section>
            </div>
          </section>
        </div>
        <aside className="home-package-column">
          <section className="active-packages home-subscriptions">
            <div className="section-heading">
              <h2>{t("Paket aktif", "Active packages")}</h2>
              <Link href="/subscriptions" className="text-button">
                {t("Lihat semua", "View all")}
                <ArrowUpRight size={19} aria-hidden="true" />
              </Link>
            </div>
            <SubscriptionRow />
            <SubscriptionRow />
            <Link className="add-package" href="/#packages">
              <Plus size={20} />
              {t("Tambah paket", "Add a package")}
            </Link>
          </section>
        </aside>
      </div>
    </Screen>
  );
}

/** A package page: hero, heading, badges and the purchase card, in the detail grid. */
export function PackageSkeleton() {
  const { t } = useApp();
  return (
    <Screen className="content package-detail">
      <div className="breadcrumbs">
        <Link href="/#packages">{t("Jelajah", "Discover")}</Link>
        <span>/</span>
        <Sk w="8em" />
      </div>
      <div className="detail-layout">
        <div>
          <div className="detail-image-frame">
            <SkImg className="detail-hero" width={900} height={675} />
          </div>
          <div className="detail-heading">
            <span className="seller-link">
              <span className="mini-avatar sk" />
              <Sk w="9em" />
            </span>
            <h1>
              <Sk w="75%" />
            </h1>
            <p>
              <Sk w="100%" />
              <br />
              <Sk w="60%" />
            </p>
          </div>
          <div className="detail-badges">
            {["11em", "10em", "7em"].map((w) => (
              <span key={w}>
                <span className="sk sk-dot" style={{ width: 17, height: 17 }} />
                <Sk w={w} />
              </span>
            ))}
          </div>
          <section className="detail-section">
            <h2>{t("Isi paket", "Included dishes")}</h2>
            <p>
              <Sk w="80%" />
            </p>
          </section>
        </div>
        <aside className="purchase-card">
          <h2>
            <Sk w="7em" />
          </h2>
          <p className="booking-commitment">
            <Sk w="100%" />
            <br />
            <Sk w="45%" />
          </p>
          <p className="small muted">
            <Sk w="100%" />
            <br />
            <Sk w="95%" />
            <br />
            <Sk w="50%" />
          </p>
          <p>
            <Sk w="6em" />
          </p>
          <div className="portion-control">
            <label>{t("Jumlah porsi", "Portions")}</label>
            <Stepper />
          </div>
          <p className="small muted">
            {t(
              "1 porsi = 1 orang setiap kali makan.",
              "1 portion = 1 person per meal.",
            )}
          </p>
          <p className="small muted">
            <Sk w="100%" />
            <br />
            <Sk w="40%" />
          </p>
          <dl className="facts">
            {["7em", "6em"].map((w) => (
              <div key={w}>
                <dt>
                  <Sk w={w} />
                </dt>
                <dd>
                  <Sk w="4em" />
                </dd>
              </div>
            ))}
          </dl>
          <p className="delivery-coverage unknown">
            <span>
              <Sk w="100%" />
              <br />
              <Sk w="60%" />
            </span>
          </p>
          <Ghost className="button full">
            {t("Pilih paket ini", "Choose this package")}
            <ArrowRight size={17} />
          </Ghost>
          <Ghost className="text-button purchase-trial">
            {t("Belum yakin? Coba 1 hari", "Not sure? Try 1 day")}
          </Ghost>
          <div className="purchase-secondary">
            <Ghost className="button secondary">
              <Bookmark size={17} />
              <span>{t("Simpan", "Save")}</span>
            </Ghost>
            <Ghost className="button secondary">
              <GitCompareArrows size={17} />
              <span>{t("Bandingkan", "Compare")}</span>
            </Ghost>
          </div>
          <p className="purchase-footnote">
            {t(
              "Biaya layanan ditampilkan saat checkout. Tidak ada perpanjangan otomatis.",
              "Service fee appears at checkout. No automatic renewal.",
            )}
          </p>
        </aside>
      </div>
    </Screen>
  );
}

/** Checkout's first step: the summary card and the portion, date and address fields. */
export function CheckoutSkeleton({ trial }: { trial: boolean }) {
  const { t } = useApp();
  return (
    <Screen className="content checkout-page">
      <span className="back-link">
        <ArrowLeft size={16} />
        {t("Kembali ke paket", "Back to package")}
      </span>
      <Heading
        title={
          trial
            ? t("Pesan uji coba", "Order a trial")
            : t("Pesan paket", "Order package")
        }
      />
      <ol className="checkout-steps">
        <li className="current">1. {t("Porsi & jadwal", "Portions & dates")}</li>
        <li>2. {t("Cek paket", "Review package")}</li>
        <li>3. {t("Pembayaran", "Payment")}</li>
      </ol>
      <div className="checkout-layout">
        <aside className="checkout-summary">
          <SkImg width={350} height={180} />
          <div>
            <div className="checkout-summary-description">
              <small>
                <Sk w="8em" />
              </small>
              <h2>
                <Sk w="80%" />
              </h2>
              <p>
                <Sk w="100%" />
                <br />
                <Sk w="45%" />
              </p>
            </div>
            <div className="total-row">
              <strong>{t("Harga paket", "Package price")}</strong>
              <strong>
                <Sk w="6em" />
              </strong>
            </div>
            <p className="small muted">
              <Sk w="100%" />
              <br />
              <Sk w="55%" />
            </p>
            <p className="small muted">
              <Sk w="100%" />
              <br />
              <Sk w="40%" />
            </p>
            <details
              className="disclosure disclosure-inline checkout-package-details"
              inert
            >
              <summary>
                <span className="disclosure-heading">
                  <span className="disclosure-title">
                    {t("Isi paket & menu", "Package contents & menu")}
                  </span>
                </span>
                <ChevronDown size={18} />
              </summary>
            </details>
            <p className="small muted">
              {t(
                "Dibayar penuh di awal. Tidak diperpanjang otomatis.",
                "Paid in full upfront. No automatic renewal.",
              )}
            </p>
          </div>
        </aside>
        <section className="checkout-fields">
          <div className="form">
            <div className="checkout-step-content">
              <h2>{t("Paket untuk siapa saja?", "How many are eating?")}</h2>
              <p>
                {t(
                  "Jumlah porsi tetap untuk seluruh paket. Semua porsi mendapat menu yang sama.",
                  "Portions stay fixed throughout the package. Every portion gets the same menu.",
                )}
              </p>
              <div className="portion-control">
                <strong>{t("Porsi setiap hari", "Portions per day")}</strong>
                <Stepper />
              </div>
              <div className="field">
                <span>{t("Mulai tanggal", "Start date")}</span>
                <span className="date-picker">
                  <Ghost className="date-picker-trigger">
                    {t("Mulai tanggal", "Start date")}
                  </Ghost>
                </span>
              </div>
              <div className="field">
                <span>{t("Alamat pengantaran", "Delivery address")}</span>
                <Ghost className="select-trigger">
                  <span>{t("Alamat pengantaran", "Delivery address")}</span>
                </Ghost>
              </div>
              <div className="checkout-address-guidance">
                <span className="sk sk-dot" style={{ width: 18, height: 18 }} />
                <div>
                  <p>
                    <Sk w="16em" />
                  </p>
                  <p className="small muted">
                    <Sk w="10em" />
                  </p>
                </div>
              </div>
              <Ghost className="text-button">
                <Plus size={16} />
                {t("Tambah alamat", "Add address")}
              </Ghost>
              <div className="field">
                <span>{t("Durasi paket", "Package duration")}</span>
                <Ghost className="select-trigger">
                  <span>{t("Durasi paket", "Package duration")}</span>
                </Ghost>
                <p className="small muted">
                  <Sk w="12em" />
                </p>
              </div>
            </div>
            <Ghost className="button form-submit">
              {t("Cek jadwal & harga", "Review schedule & price")}
            </Ghost>
          </div>
        </section>
      </div>
    </Screen>
  );
}

/** Notifications: the heading and three unread rows, each with its mark-as-read button. */
export function NotificationsSkeleton() {
  const { t } = useApp();
  return (
    <Screen className="content narrow-wide">
      <Heading title={t("Notifikasi", "Notifications")} />
      {["24em", "32em", "20em"].map((w) => (
        <div className="notification unread" key={w}>
          <span className="sk sk-dot" style={{ width: 19, height: 19 }} />
          <div>
            <span>
              <strong>
                <Sk w={w} />
              </strong>
              <small>
                <Sk w="9em" />
              </small>
            </span>
            <Ghost className="button secondary">
              {t("Tandai dibaca", "Mark as read")}
            </Ghost>
          </div>
        </div>
      ))}
    </Screen>
  );
}

function PackageCardSkeleton() {
  const { t } = useApp();
  return (
    <article className="package-card package-card-v2">
      <div className="package-image">
        <Ghost className="button secondary save-package card-save">
          <Bookmark size={17} />
          <span>{t("Tersimpan", "Saved")}</span>
        </Ghost>
        <SkImg width={724} height={543} />
      </div>
      <div className="package-body">
        <div className="package-identity">
          <div className="caterer-line">
            <strong>
              <Sk w="7em" />
            </strong>
            <span>
              <Sk w="2.5em" />
            </span>
          </div>
          <h3>
            <Sk w="70%" />
          </h3>
        </div>
        <p className="package-meta">
          {["4em", "6em"].map((w) => (
            <span key={w}>
              <span className="sk sk-dot" style={{ width: 15, height: 15 }} />
              <SkText w={w} />
            </span>
          ))}
          <span>
            <SkText w="7em" />
          </span>
        </p>
        <div className="package-pricing">
          <div className="card-price">
            <small className="package-total-label">
              <Sk w="16em" />
            </small>
            <strong>
              <Sk w="6em" />
            </strong>
            <small className="package-unit-price">
              <Sk w="10em" />
            </small>
          </div>
          <p className="delivery-coverage unknown">
            <span className="sk sk-dot" style={{ width: 15, height: 15 }} />
            <span>
              <Sk w="12em" />
            </span>
          </p>
        </div>
        <div className="package-footer">
          <div className="package-actions">
            <button
              type="button"
              className="sk sk-ghost"
              aria-hidden="true"
              tabIndex={-1}
              disabled
            >
              {t("Bandingkan", "Compare")}
            </button>
            <a className="sk sk-ghost" aria-hidden="true" tabIndex={-1}>
              {t("Lihat paket", "View package")}
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
        <div className="package-preview">
          <div className="preview-heading">
            <span className="preview-source">
              <Sk w="7em" />
            </span>
          </div>
          <p className="composition-preview">
            <Sk w="14em" />
          </p>
          <Ghost className="contents-link">
            {t("Lihat isi paket", "See included dishes")}
            <ArrowRight size={14} />
          </Ghost>
          <div className="nutrition-strip">
            <dl>
              {[
                t("Energi", "Energy"),
                "Protein",
                t("Karbo", "Carbs"),
                t("Lemak", "Fat"),
              ].map((label) => (
                <div key={label}>
                  <dt>
                    <span
                      className="sk sk-dot"
                      style={{ width: 16, height: 16 }}
                    />
                    {label}
                  </dt>
                  <dd>
                    <Sk w="3em" />
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              {t(
                "Estimasi katering · per porsi makan",
                "Caterer estimate · per meal portion",
              )}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Saved packages below their real heading: the package grid with three cards. */
export function SavedPackagesSkeleton() {
  return (
    <Screen className="package-grid">
      <PackageCardSkeleton />
      <PackageCardSkeleton />
      <PackageCardSkeleton />
    </Screen>
  );
}

/** The subscriptions list: heading and three full subscription cards. */
export function SubscriptionsSkeleton() {
  const { t } = useApp();
  return (
    <Screen className="content narrow-wide">
      <Heading
        title={t("Langganan saya", "My subscriptions")}
        description={t(
          "Setiap paket punya porsi, jadwal, dan ketentuannya sendiri.",
          "Each package keeps its own portions, schedule, and terms.",
        )}
      />
      <div className="subscription-list">
        {["9em", "7em", "11em"].map((w) => (
          <div className="subscription-card" key={w}>
            <SkImg width={100} height={100} />
            <div>
              <small>
                <Sk w="6em" />
              </small>
              <h2 className="subscription-title">
                <Sk w={w} />
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
        ))}
      </div>
    </Screen>
  );
}

/** A collapsed optional section, held shut. */
function ClosedSection({ title }: { title: string }) {
  return (
    <details className="optional-section" inert>
      <summary>
        <span>{title}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
    </details>
  );
}

/** One delivery: its summary card, the management facts and actions, the timeline and the closed sections. */
export function DeliverySkeleton() {
  const { t } = useApp();
  return (
    <Screen className="content narrow-wide delivery-detail-page">
      <Link className="back-link" href="/calendar">
        <ArrowLeft size={17} />
        {t("Jadwal makan", "Meal calendar")}
      </Link>
      <section className="next-meal-card delivery-summary">
        <div className="next-meal-photo">
          <SkImg width={800} height={600} />
          <span className="image-label">
            <Clock size={14} />
            {t("Pengantaran", "Delivery")}
          </span>
        </div>
        <div className="next-meal-content">
          <div className="caterer-line">
            <span>
              <Sk w="8em" />
            </span>
            <span className="status">
              <span />
              <SkText w="4em" />
            </span>
          </div>
          <h1>
            <Sk w="70%" />
          </h1>
          <p>
            <Sk w="11em" />
          </p>
          <div className="next-meal-info">
            <span>
              <span className="sk sk-dot" style={{ width: 16, height: 16 }} />
              <SkText w="12em" />
            </span>
            <span>
              <span className="sk sk-dot" style={{ width: 16, height: 16 }} />
              <bdi>
                <Sk w="16em" /> <Sk w="11em" />
              </bdi>
            </span>
          </div>
        </div>
      </section>
      <section className="delivery-management-summary">
        <h2>{t("Kelola pengantaran", "Manage delivery")}</h2>
        <dl className="facts">
          <div>
            <dt>
              <Sk w="6em" />
            </dt>
            <dd>
              <span className="status">
                <span />
                <SkText w="5em" />
              </span>
            </dd>
          </div>
          <div>
            <dt>{t("Batas perubahan", "Change cutoff")}</dt>
            <dd>
              <Sk w="9em" /> <Sk w="12em" />
            </dd>
          </div>
        </dl>
      </section>
      <div className="action-row delivery-actions">
        <Ghost className="button secondary">
          <MapPin size={17} />
          {t("Ubah alamat", "Change address")}
        </Ghost>
        <Ghost className="button">
          <CalendarDays size={17} />
          {t("Ubah jadwal", "Change schedule")}
        </Ghost>
        <Ghost className="button secondary">
          <MessageCircle size={17} />
          {t("Hubungi katering", "Contact caterer")}
        </Ghost>
        <Ghost className="text-button">
          {t("Laporkan masalah", "Report an issue")}
        </Ghost>
      </div>
      <div className="delivery-timeline">
        {["scheduled", "preparing", "out_for_delivery", "delivered"].map(
          (s) => (
            <div key={s}>
              <span>
                <Check size={15} />
              </span>
              <Status status={s} />
            </div>
          ),
        )}
      </div>
      <ClosedSection title={t("Alamat & ketentuan", "Address & rules")} />
      <ClosedSection title={t("Isi paket", "Package contents")} />
    </Screen>
  );
}

/** A pending payment: the status heading, the order facts and the payment action. */
export function PaymentSkeleton() {
  const { t } = useApp();
  // Bars split by a space wrap where the real text would (the long order reference on a phone).
  const rows: [string, string][] = [
    [t("Referensi pesanan", "Order reference"), "9em 9em"],
    [t("Paket", "Package"), "9em"],
    [t("Hari pengantaran", "Delivery days"), "3em"],
    [t("Porsi per waktu makan", "Portions per meal"), "2em"],
    [t("Total dibayar di awal", "Total paid upfront"), "6em"],
    [t("Batas pembayaran", "Time remaining"), "3em"],
  ];
  return (
    <Screen className="narrow payment-pending">
      <div className="page-heading">
        <div>
          <h1>
            <Sk w="9em" />
          </h1>
        </div>
      </div>
      <dl className="facts">
        {rows.map(([label, w]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {w.split(" ").map((bar, i) => (
                <Fragment key={i}>
                  {i ? " " : null}
                  <Sk w={bar} />
                </Fragment>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <Ghost className="button full">
        {t("Buka halaman pembayaran", "Open payment page")}
      </Ghost>
    </Screen>
  );
}

/** Messages: the heading, the conversation list and one open conversation with its composer. */
export function MessagesSkeleton() {
  const { t } = useApp();
  return (
    <Screen className="content messages-page">
      <Heading
        title={t("Pesan", "Messages")}
        description={t(
          "Tanya menu, atur pengantaran, atau sampaikan sesuatu ke kateringmu.",
          "Ask about meals, coordinate a delivery, or talk to your caterer.",
        )}
      />
      <div className="messages-layout">
        <aside>
          <h2>{t("Percakapan", "Conversations")}</h2>
          {["7em", "6em"].map((w, i) => (
            <div
              className={"conversation-preview" + (i ? "" : " active")}
              key={w}
            >
              <span className="mini-avatar sk" />
              <div>
                <strong>
                  <Sk w={w} />
                </strong>
                <small>
                  <Sk w="11em" />
                </small>
              </div>
            </div>
          ))}
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
                  "Koordinasi langsung dengan katering",
                  "Coordinate directly with your caterer",
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
            <div className="message">
              <p>
                <Sk w="28em" />
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
            <Ghost className="button form-submit">
              <span className="form-submit-label">
                <Check size={17} />
                {t("Kirim", "Send")}
              </span>
              <span className="form-submit-pending">
                <LoaderCircle size={18} />
                {t("Memproses…", "Processing…")}
              </span>
            </Ghost>
          </div>
        </section>
      </div>
    </Screen>
  );
}
