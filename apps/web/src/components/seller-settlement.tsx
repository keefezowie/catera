"use client";
import { useId, useState, type ReactNode, type KeyboardEvent } from "react";
import {
  CalendarDays,
  Landmark,
  ShieldAlert,
  ArrowUpRight,
  CircleHelp,
  Wallet,
  Clock3,
} from "lucide-react";
import { settlementCurrency, type SettlementState } from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { Loading, ErrorNotice, Facts } from "./ui";
import { SettlementChart } from "./settlement-chart";
import { SettlementHistory, SettlementDetail } from "./settlement-history";
import "./seller-settlement.css";

export function SellerSettlement({
  catererId,
  purchases,
  legacy,
}: {
  catererId: string;
  purchases?: ReactNode;
  legacy?: ReactNode;
}) {
  return (
    <SettlementScreen
      key={catererId}
      catererId={catererId}
      purchases={purchases}
      legacy={legacy}
    />
  );
}
function SettlementScreen({
  catererId,
  purchases,
  legacy,
}: {
  catererId: string;
  purchases?: ReactNode;
  legacy?: ReactNode;
}) {
  const { t } = useApp();
  const state = useResource("settlement:" + catererId, () =>
    api.settlement(catererId),
  );
  const [tab, setTab] = useState("payouts");
  const [detail, setDetail] = useState<string | null>(null);
  const id = useId();
  if (!state.data)
    return (
      <>
        {state.error ? (
          <ErrorNotice message={state.error} retry={state.reload} />
        ) : (
          <Loading />
        )}
        {purchases}
        {legacy}
      </>
    );
  const s = state.data;
  if ("unavailable" in s)
    return (
      <>
        <SettlementUnavailableNotice />
        {purchases}
        {legacy}
      </>
    );
  const tabs = [
    { id: "payouts", name: t("Pencairan", "Payouts") },
    { id: "entries", name: t("Aktivitas pendapatan", "Earnings activity") },
    ...(purchases
      ? [{ id: "purchases", name: t("Pembelian", "Purchases") }]
      : []),
  ];
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].id);
    document.getElementById(`${id}-${tabs[next].id}`)?.focus();
  };
  return (
    <div className="settlement-screen">
      <BalanceOverview s={s} onHolds={() => setDetail("holds")} />
      {s.reportingVersion ? (
        <SettlementChart key={catererId} catererId={catererId} />
      ) : (
        <ReportingUnavailable />
      )}
      <section className="panel settlement-history">
        <div
          className="settlement-tabs"
          role="tablist"
          aria-label={t("Riwayat transaksi", "Transaction history")}
        >
          {tabs.map((item, index) => (
            <button
              type="button"
              role="tab"
              key={item.id}
              id={`${id}-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`${id}-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onKeyDown={(e) => keyboard(e, index)}
              onClick={() => setTab(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
        {tabs.map((item) => (
          <div
            key={item.id}
            role="tabpanel"
            id={`${id}-panel-${item.id}`}
            aria-labelledby={`${id}-${item.id}`}
            hidden={tab !== item.id}
            tabIndex={0}
          >
            {tab === item.id &&
              (item.id === "purchases" ? (
                purchases
              ) : (
                <>
                  <SettlementHistory
                    key={`${catererId}-${item.id}`}
                    catererId={catererId}
                    kind={item.id === "payouts" ? "payouts" : "entries"}
                    reporting={!!s.reportingVersion}
                    fallback={s}
                    onPayout={setDetail}
                  />
                  {item.id === "payouts" && legacy}
                </>
              ))}
          </div>
        ))}
      </section>
      <details className="panel settlement-help">
        <summary>
          <CircleHelp size={18} />
          {t("Cara pendapatan dihitung", "How earnings work")}
        </summary>
        <ol className="settlement-flow">
          <li>{t("Pengantaran hari itu selesai", "Delivery day completed")}</li>
          <li>{t("Pendapatan dicatat", "Earnings credited")}</li>
          <li>
            {t(
              "Dana yang memenuhi syarat dicairkan",
              "Eligible funds paid out",
            )}
          </li>
        </ol>
        <p>
          {t(
            "Untuk paket siang + malam, kedua makanan harus terkirim. Dana pengantaran mendatang belum tersedia untuk pencairan.",
            "Lunch + dinner packages require both meals to be delivered. Future delivery earnings are not yet available for payout.",
          )}
        </p>
        <p className="small muted">
          {t(
            "Pencairan diproses setiap Senin pukul 09.00 WIB setelah diaktifkan. Saldo ini tidak dapat digunakan untuk berbelanja.",
            "Payouts are processed on Mondays at 09:00 WIB once enabled. This balance cannot be spent on purchases.",
          )}
        </p>
      </details>
      {detail && (
        <SettlementDetail
          key={`${catererId}-${detail}`}
          catererId={catererId}
          selection={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
function BalanceOverview({
  s,
  onHolds,
}: {
  s: SettlementState;
  onHolds: () => void;
}) {
  const { t, locale } = useApp();
  const money = (v: string) => settlementCurrency(v, locale);
  const readiness = s.payoutReadiness;
  const ready =
    readiness === "ready" && !s.policy?.synthetic && s.nextProcessingAt;
  const label =
    readiness === "not_configured" || !s.policy
      ? t("Pencairan belum dikonfigurasi", "Payouts are not configured")
      : readiness === "synthetic" || s.policy.synthetic
        ? t(
            "Mode simulasi · tidak ada transfer nyata",
            "Demo mode · no real transfers",
          )
        : !s.policy.enabled
          ? t(
              "Pencairan otomatis belum diaktifkan",
              "Automatic payouts are not enabled",
            )
          : t("Transfer belum aktif", "Transfers are not active");
  return (
    <section aria-label={t("Ringkasan pendapatan", "Earnings overview")}>
      <div className="settlement-heading">
        <h2>{t("Pendapatan & pencairan", "Earnings & payouts")}</h2>
        {s.policy?.synthetic && (
          <span className="settlement-demo">
            {t("Data simulasi", "Demo data")}
          </span>
        )}
      </div>
      <div className="settlement-hero">
        <div>
          <span className="settlement-eyebrow">
            <Wallet size={20} />
            {t("Saldo tersedia", "Available balance")}
          </span>
          <strong className="settlement-amount">{money(s.available)}</strong>
          <span>
            {t(
              "Dari pengantaran yang sudah selesai",
              "From completed deliveries",
            )}
          </span>
        </div>
        <div className="settlement-readiness">
          <Clock3 size={22} />
          <strong>
            {ready
              ? t("Jadwal pemrosesan berikutnya", "Next processing window")
              : label}
          </strong>
          {ready && (
            <>
              <span>
                {new Date(s.nextProcessingAt!).toLocaleString(
                  locale === "id" ? "id-ID" : "en-GB",
                  {
                    timeZone: "Asia/Jakarta",
                    dateStyle: "medium",
                    timeStyle: "short",
                  },
                )}{" "}
                WIB
              </span>
              <small>
                {t(
                  "Waktu dana masuk rekening dapat berbeda.",
                  "Bank arrival time may differ.",
                )}
              </small>
            </>
          )}
          {!ready && (
            <small>
              {t(
                "Saldo tetap tercatat. Belum ada janji tanggal transfer.",
                "Your balance is recorded. No transfer date is confirmed.",
              )}
            </small>
          )}
        </div>
      </div>
      <div className="settlement-cards">
        <article>
          <CalendarDays size={22} />
          <span>{t("Pengantaran mendatang", "Upcoming deliveries")}</span>
          <strong>{money(s.expected)}</strong>
          <small>
            {t("Belum menjadi saldo tersedia", "Not yet available for payout")}
          </small>
        </article>
        <article className={BigInt(s.held) > 0n ? "settlement-held" : ""}>
          <ShieldAlert size={22} />
          <span>{t("Dana ditahan", "Held funds")}</span>
          <strong>{money(s.held)}</strong>
          {BigInt(s.held) > 0n && !!s.reportingVersion ? (
            <button className="settlement-link" type="button" onClick={onHolds}>
              {t("Lihat dana ditahan", "View held funds")}
              <ArrowUpRight size={16} />
            </button>
          ) : (
            <small>{t("Dalam peninjauan", "Under review")}</small>
          )}
        </article>
        <article>
          <Landmark size={22} />
          <span>{t("Sudah dicairkan", "Paid out")}</span>
          <strong>{money(s.paid)}</strong>
          <small>
            {t(
              "Sepanjang waktu · sistem pendapatan baru",
              "All time · delivery earnings system",
            )}
          </small>
        </article>
      </div>
      {BigInt(s.reserved) > 0n && (
        <p className="notice settlement-inline">
          <Clock3 size={20} />
          {t("Pencairan diproses", "Payout in progress")}{" "}
          <strong>{money(s.reserved)}</strong>
        </p>
      )}
      {BigInt(s.recovery) > 0n && (
        <p className="notice error settlement-inline">
          <ShieldAlert size={20} />
          {t("Dana yang perlu dipulihkan", "Recovery owed")}{" "}
          <strong>{money(s.recovery)}</strong>
          <span>
            {t(
              "Penyesuaian melebihi pendapatan yang tersisa. Hubungi Catera untuk rincian.",
              "Adjustments exceed remaining earnings. Contact Catera for details.",
            )}
          </span>
        </p>
      )}
      <details className="settlement-balance-details">
        <summary>{t("Rincian saldo", "Balance details")}</summary>
        <Facts
          rows={[
            [
              t(
                "Pendapatan tercatat setelah penyesuaian",
                "Recorded earnings after adjustments",
              ),
              money(s.earned),
            ],
            [t("Pencairan diproses", "Payout in progress"), money(s.reserved)],
            [
              t("Dana yang perlu dipulihkan", "Recovery owed"),
              money(s.recovery),
            ],
          ]}
        />
      </details>
    </section>
  );
}
export function ReportingUnavailable() {
  const { t } = useApp();
  return (
    <p className="notice">
      {t(
        "Grafik dan rincian pendapatan belum tersedia di lingkungan ini.",
        "Earnings charts and details are not available in this environment yet.",
      )}
    </p>
  );
}
export function SettlementUnavailableNotice() {
  const { t } = useApp();
  return (
    <section className="panel spaced">
      <h2>{t("Pendapatan & pencairan", "Earnings & payouts")}</h2>
      <p>
        {t(
          "Laporan pendapatan per pengantaran belum tersedia. Riwayat pembelian dan pencairan sebelumnya tetap tersedia di bawah.",
          "Delivery earnings reporting is not available yet. Your purchase history and previous payouts remain available below.",
        )}
      </p>
    </section>
  );
}
