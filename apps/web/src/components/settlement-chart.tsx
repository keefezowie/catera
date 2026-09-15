"use client";
import { useEffect, useId, useRef, useState } from "react";
import { settlementCurrency, type SettlementReport } from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { ErrorNotice, Loading } from "./ui";

export function SettlementChart({ catererId }: { catererId: string }) {
  const { t } = useApp();
  const [days, setDays] = useState<7 | 30>(30);
  return (
    <section
      className="panel settlement-chart"
      aria-label={t("Grafik pendapatan", "Earnings chart")}
    >
      <div className="settlement-heading">
        <h3>{t("Pendapatan tercatat", "Earnings credited")}</h3>
        <div
          className="settlement-range"
          role="group"
          aria-label={t("Rentang grafik", "Chart range")}
        >
          {([7, 30] as const).map((n) => (
            <button
              type="button"
              key={n}
              aria-pressed={days === n}
              onClick={() => setDays(n)}
            >
              {n} {t("hari", "days")}
            </button>
          ))}
        </div>
      </div>
      <ChartData
        key={`${catererId}-${days}`}
        catererId={catererId}
        days={days}
      />
    </section>
  );
}
function ChartData({ catererId, days }: { catererId: string; days: 7 | 30 }) {
  const { t } = useApp();
  const state = useResource(`settlement-report:${catererId}:${days}`, () =>
    api.settlementReport(catererId, days),
  );
  if (state.loading) return <Loading />;
  if (state.error)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  if (!state.data) return null;
  if ("unavailable" in state.data)
    return (
      <p className="notice">
        {t("Grafik belum tersedia.", "Chart reporting is not available yet.")}
      </p>
    );
  return <EarningsBars report={state.data} />;
}
export function EarningsBars({ report }: { report: SettlementReport }) {
  const { t, locale } = useApp();
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(760);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setChartWidth(Math.max(230, Math.round(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [selected, setSelected] = useState(report.days.length - 1);
  const money = (v: string) => settlementCurrency(v, locale);
  const dayLabel = (date: string, year = false) =>
    new Date(date + "T12:00:00+07:00").toLocaleDateString(
      locale === "id" ? "id-ID" : "en-GB",
      {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "short",
        ...(year ? { year: "numeric" as const } : {}),
      },
    );
  const values = report.days.flatMap((d) => [
    BigInt(d.credits),
    BigInt(d.adjustments),
  ]);
  const max = values.reduce((a, b) => (a > b ? a : b), 1n),
    min = values.reduce((a, b) => (a < b ? a : b), 0n);
  const y = (v: bigint) =>
    24 + Number(((max - v) * 20000n) / (max - min)) / 100;
  const zero = y(0n),
    step = (chartWidth - 65) / report.days.length;
  const chosen = report.days[selected];
  return (
    <>
      <p className="small muted">
        {dayLabel(report.from, true)} – {dayLabel(report.to, true)} ·{" "}
        {t("Tanggal pencatatan", "Recorded date")} · WIB
      </p>
      <div className="settlement-chart-totals">
        <div>
          <span>
            <i className="credit-key" />
            {t("Pengantaran selesai", "Delivery earnings")}
          </span>
          <strong>{money(report.credits)}</strong>
        </div>
        <div>
          <span>
            <i className="adjustment-key" />
            {t("Penyesuaian saldo", "Balance adjustments")}
          </span>
          <strong>{money(report.adjustments)}</strong>
        </div>
      </div>
      <svg
        className="settlement-bars"
        ref={svg}
        viewBox={`0 0 ${chartWidth} 260`}
        aria-label={t(
          "Pendapatan dan penyesuaian per hari. Pilih hari untuk nilai tepat.",
          "Daily earnings and adjustments. Select a day for exact values.",
        )}
        role="group"
      >
        <text x="0" y="18" className="settlement-axis">
          IDR
        </text>
        <text x="0" y="40" className="settlement-axis">
          {new Intl.NumberFormat(locale, {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(max)}
        </text>
        <line
          x1="55"
          x2={chartWidth - 5}
          y1={zero}
          y2={zero}
          className="settlement-baseline"
        />
        <text x="0" y={Math.max(62, zero + 4)} className="settlement-axis">
          0
        </text>
        {min < 0n && (
          <text x="0" y="235" className="settlement-axis">
            {new Intl.NumberFormat(locale, {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(min)}
          </text>
        )}
        {report.days.map((d, i) => {
          const x = 58 + i * step;
          const width = Math.max(0.8, step * 0.31);
          return (
            <g
              key={d.date}
              id={`${id}-${i}`}
              role="button"
              tabIndex={i === selected ? 0 : -1}
              aria-pressed={selected === i}
              aria-label={`${dayLabel(d.date)}: ${t("Pendapatan", "Earnings")} ${money(d.credits)}, ${t("penyesuaian", "adjustments")} ${money(d.adjustments)}`}
              onFocus={() => setSelected(i)}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => {
                let next = i;
                if (e.key === "ArrowRight")
                  next = Math.min(i + 1, report.days.length - 1);
                else if (e.key === "ArrowLeft") next = Math.max(i - 1, 0);
                else if (e.key === "Home") next = 0;
                else if (e.key === "End") next = report.days.length - 1;
                else if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                setSelected(next);
                document.getElementById(`${id}-${next}`)?.focus();
              }}
            >
              <rect
                x={x - 2}
                y="22"
                width={step - 1}
                height="205"
                rx="3"
                className={
                  selected === i ? "settlement-day selected" : "settlement-day"
                }
              />
              {[d.credits, d.adjustments].map((v, j) => {
                const value = BigInt(v);
                return (
                  <rect
                    key={j}
                    x={x + j * (width + 1)}
                    y={value >= 0n ? y(value) : zero}
                    width={width}
                    height={Math.max(
                      value === 0n ? 1 : 2,
                      Math.abs(y(value) - zero),
                    )}
                    className={
                      j === 0 ? "settlement-credit" : "settlement-adjustment"
                    }
                  />
                );
              })}
              {(i === 0 ||
                i === report.days.length - 1 ||
                i === Math.floor(report.days.length / 2)) && (
                <text
                  x={x}
                  y="250"
                  className="settlement-axis"
                  textAnchor={i === report.days.length - 1 ? "end" : "start"}
                >
                  {dayLabel(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {chosen && (
        <div className="settlement-chart-selection" aria-live="polite">
          <div className="settlement-day-controls">
            <button
              type="button"
              aria-label={t("Hari sebelumnya", "Previous day")}
              disabled={selected === 0}
              onClick={() => setSelected(selected - 1)}
            >
              ‹
            </button>
            <strong>{dayLabel(chosen.date)}</strong>
            <button
              type="button"
              aria-label={t("Hari berikutnya", "Next day")}
              disabled={selected === report.days.length - 1}
              onClick={() => setSelected(selected + 1)}
            >
              ›
            </button>
          </div>
          <span>
            {t("Pendapatan", "Earnings")}: {money(chosen.credits)}
          </span>
          <span>
            {t("Penyesuaian", "Adjustments")}: {money(chosen.adjustments)}
          </span>
        </div>
      )}
      <details>
        <summary>{t("Lihat data", "View data")}</summary>
        <div className="table-wrap">
          <table className="record-table">
            <caption className="sr-only">
              {t("Pendapatan harian", "Daily earnings")}
            </caption>
            <thead>
              <tr>
                <th>{t("Tanggal", "Date")}</th>
                <th>{t("Pendapatan", "Earnings")}</th>
                <th>{t("Penyesuaian", "Adjustments")}</th>
              </tr>
            </thead>
            <tbody>
              {report.days.map((d) => (
                <tr key={d.date}>
                  <th scope="row">{dayLabel(d.date)}</th>
                  <td>{money(d.credits)}</td>
                  <td>{money(d.adjustments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
