"use client";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  ChevronDown,
  GitCompareArrows,
  Minus,
  Plus,
} from "lucide-react";
import { useApp } from "./context";
import { Heading } from "./ui";
import "./skeleton.css";

const blank =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** A text bar inside a real text element, so that element's font sets its height. */
const Sk = ({ w }: { w: string }) => (
  <span className="sk sk-line" style={{ width: w }} />
);

/** A photo placeholder: a transparent <img> the screen's own img rules size and round. */
const SkImg = ({
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
const Ghost = ({
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
const Stepper = () => (
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
function Screen({
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
