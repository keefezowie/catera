"use client";
import {
  currency,
  purchaseCommitment,
  purchasedCycles,
  type Quote,
} from "@catera/domain";
import { useApp } from "./context";
import { Facts } from "./ui";
export function PurchasePriceBreakdown({ quote: q }: { quote: Quote }) {
  const { t, locale } = useApp();
  const commitment = purchaseCommitment({ offer: q.offer, quote: q });
  const rows: [string, string][] = [
    [
      t("Harga dasar / porsi / hari", "Base price / portion / day"),
      currency(
        q.trial ? (q.offer.trialPrice ?? q.offer.price) : q.offer.price,
        locale,
      ),
    ],
    [
      t("Durasi paket", "Package duration"),
      `${purchasedCycles(q)} ${t("periode", "cycles")} · ${q.dates.length} ${t("hari pengantaran", "delivery days")}`,
    ],
    [t("Porsi per waktu makan", "Portions per meal"), String(q.portions)],
    [
      t("Total porsi makan", "Total meal portions"),
      String(commitment.totalMealPortions),
    ],
    [t("Subtotal paket", "Package subtotal"), currency(q.subtotal, locale)],
  ];
  if (q.discount)
    rows.push([
      t("Diskon jumlah porsi", "Portion discount") + ` (${q.discountPercent}%)`,
      "− " + currency(q.discount, locale),
    ]);
  if (q.durationDiscount)
    rows.push([
      t("Diskon durasi paket", "Multi-cycle discount") +
        ` (${q.durationDiscountPercent}%)`,
      "− " + currency(q.durationDiscount, locale),
    ]);
  if (q.promotion)
    rows.push([
      t("Promosi saat pembelian", "Promotion at purchase"),
      "− " + currency(q.promotion, locale),
    ]);
  rows.push(
    [t("Pengantaran", "Delivery"), t("Termasuk", "Included")],
    [
      t("Biaya layanan", "Service fee"),
      currency(commitment.serviceFee ?? 0, locale),
    ],
    [
      t("Dibayar penuh di awal", "Paid in full upfront"),
      currency(commitment.finalPayable ?? q.total, locale),
    ],
  );
  return <Facts rows={rows} />;
}
export function PurchaseSchedule({ quote: q }: { quote: Quote }) {
  const { t, locale } = useApp();
  const format = (date: string) =>
    new Date(date + "T12:00:00Z").toLocaleDateString(
      locale === "id" ? "id-ID" : "en-GB",
      { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
    );
  const size = q.trial ? 1 : (q.daysPerCycle ?? q.dates.length);
  const groups = Array.from(
    { length: Math.ceil(q.dates.length / size) },
    (_, i) => q.dates.slice(i * size, (i + 1) * size),
  );
  return (
    <div className="purchase-schedule">
      <p className="purchase-period">
        <strong>
          {format(q.dates[0])} → {format(q.dates.at(-1)!)}
        </strong>{" "}
        · {q.dates.length} {t("hari pengantaran", "delivery days")}
      </p>
      <Facts
        rows={[
          [t("Pengantaran pertama", "First delivery"), format(q.dates[0])],
          [t("Pengantaran terakhir", "Last delivery"), format(q.dates.at(-1)!)],
        ]}
      />
      {groups.map((dates, index) => (
        <details key={index} open={index === 0}>
          <summary>
            {t("Periode", "Cycle")} {index + 1} · {format(dates[0])} →{" "}
            {format(dates.at(-1)!)}
          </summary>
          <div
            className="schedule-preview"
            tabIndex={0}
            role="region"
            aria-label={`${t("Jadwal periode", "Cycle schedule")} ${index + 1}`}
          >
            {dates.map((date, i) => (
              <div key={date}>
                <span>{index * size + i + 1}</span>
                <strong>
                  {new Date(date + "T12:00:00Z").toLocaleDateString(
                    locale === "id" ? "id-ID" : "en-GB",
                    {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    },
                  )}
                </strong>
                <span>
                  {q.portions} {t("porsi", "portions")}
                </span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
