"use client";
import { settlementCurrency } from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { Loading, ErrorNotice, Facts, Status } from "./ui";
export function SellerSettlement({ catererId }: { catererId: string }) {
  const { t, locale, actor } = useApp();
  const state = useResource("settlement:" + catererId, () =>
    api.settlement(catererId),
  );
  if (!state.data)
    return state.error ? (
      <ErrorNotice message={state.error} retry={state.reload} />
    ) : (
      <Loading />
    );
  const s = state.data;
  return (
    <section className="panel spaced">
      <h2>{t("Pendapatan & pencairan", "Earnings & payouts")}</h2>
      <p>
        {t(
          "Pendapatan masuk setelah seluruh pengantaran hari itu selesai. Untuk paket siang + malam, kedua makanan harus terkirim.",
          "Earnings are credited after the complete delivery day. Lunch + dinner packages require both meals to be delivered.",
        )}
      </p>
      <Facts
        rows={[
          [
            t("Pengantaran mendatang", "Future deliveries"),
            settlementCurrency(s.expected, locale),
          ],
          [
            t("Tersedia untuk pencairan", "Available for payout"),
            settlementCurrency(s.available, locale),
          ],
          [
            t("Ditahan untuk peninjauan", "Held for review"),
            settlementCurrency(s.held, locale),
          ],
          [
            t("Pencairan diproses", "Payout in progress"),
            settlementCurrency(s.reserved, locale),
          ],
          [
            t("Sudah dicairkan", "Paid to bank"),
            settlementCurrency(s.paid, locale),
          ],
          [
            t("Pengembalian yang perlu dipulihkan", "Recovery due"),
            settlementCurrency(s.recovery, locale),
          ],
          [
            t("Jadwal berikutnya", "Next scheduled payout"),
            new Date(s.nextPayoutAt).toLocaleString(
              locale === "id" ? "id-ID" : "en-GB",
              { timeZone: "Asia/Jakarta" },
            ) + " WIB",
          ],
        ]}
      />
      <p className="small muted">
        {t(
          "Setiap Senin pukul 09.00 WIB, setelah konfigurasi pencairan disetujui. Saldo ini tidak dapat digunakan untuk berbelanja.",
          "Every Monday at 09:00 WIB, once payout configuration is approved. This balance cannot be spent on purchases.",
        )}
      </p>
      {!s.policy?.enabled && (
        <p className="notice">
          {t(
            "Pencairan otomatis belum diaktifkan.",
            "Automatic payouts are not enabled.",
          )}
        </p>
      )}
      <h3>{t("Riwayat pencairan", "Payout history")}</h3>
      {s.payouts.map((p) => (
        <div className="queue-row" key={p.id}>
          <strong>{settlementCurrency(String(p.amount), locale)}</strong>
          <Status status={p.status === "pending" ? "processing" : p.status} />
          <small>{new Date(p.created_at).toLocaleDateString(locale)}</small>
        </div>
      ))}
      {!s.payouts.length && (
        <p>{t("Belum ada pencairan.", "No payouts yet.")}</p>
      )}
      <details>
        <summary>
          {t("Rincian pendapatan terbaru", "Recent earnings entries")}
        </summary>
        {s.entries.map((e) => (
          <div className="queue-row" key={e.id}>
            <span>
              {e.kind === "earned"
                ? t("Pengantaran selesai", "Delivery completed")
                : e.kind === "recovery"
                  ? t("Pemulihan dana", "Recovery")
                  : t("Penyesuaian pengembalian", "Refund adjustment")}
            </span>
            <strong>{settlementCurrency(e.amount, locale)}</strong>
            <small>
              {new Date(e.created_at).toLocaleDateString(locale)}
              {actor?.role === "platform_admin" && e.allocation_id && (
                <code>{e.allocation_id}</code>
              )}
            </small>
          </div>
        ))}
      </details>
    </section>
  );
}
