"use client";
import { useState } from "react";
import { ChevronRight, Landmark, Package, ShieldAlert } from "lucide-react";
import {
  settlementCurrency,
  type SettlementCursor,
  type SettlementHistoryKind,
  type SettlementHistoryItem,
  type SettlementState,
} from "@catera/domain";
import { api, useApp, useResource } from "./context";
import { Dialog, ErrorNotice, Loading, Status } from "./ui";

function useLabels() {
  const { t, locale, actor } = useApp();
  return {
    t,
    locale,
    actor,
    money: (v: string) => settlementCurrency(v, locale),
    date: (v: string) =>
      new Date(v).toLocaleString(locale === "id" ? "id-ID" : "en-GB", {
        timeZone: "Asia/Jakarta",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " WIB",
    kind: (v?: string) =>
      v === "earned"
        ? t("Pengantaran selesai", "Delivery completed")
        : v === "recovery"
          ? t("Pemulihan dana", "Recovery")
          : v === "debt_offset"
            ? t("Pengimbangan saldo", "Balance offset")
            : v === "entitlement_reduction"
              ? t(
                  "Penyesuaian hak pengantaran",
                  "Delivery entitlement adjustment",
                )
              : t("Penyesuaian pengembalian", "Refund adjustment"),
  };
}
export function SettlementHistory({
  catererId,
  kind,
  reporting,
  fallback,
  onPayout,
}: {
  catererId: string;
  kind: SettlementHistoryKind;
  reporting: boolean;
  fallback?: SettlementState;
  onPayout?: (id: string) => void;
}) {
  const { t } = useApp();
  const [cursors, setCursors] = useState<(SettlementCursor | undefined)[]>([
    undefined,
  ]);
  const cursor = cursors[cursors.length - 1];
  if (!reporting && fallback) {
    const items: SettlementHistoryItem[] =
      kind === "payouts"
        ? fallback.payouts.map((p) => ({ ...p, amount: String(p.amount) }))
        : fallback.entries;
    return (
      <div>
        {items.map((item) => (
          <HistoryRow key={item.id} item={item} kind={kind} />
        ))}
        {!items.length && (
          <p className="quiet-empty">
            {t("Belum ada aktivitas.", "No activity yet.")}
          </p>
        )}
      </div>
    );
  }
  return (
    <HistoryPage
      key={JSON.stringify(cursor)}
      catererId={catererId}
      kind={kind}
      cursor={cursor}
      onNext={(next) => setCursors([...cursors, next])}
      onPrevious={
        cursors.length > 1 ? () => setCursors(cursors.slice(0, -1)) : undefined
      }
      onPayout={onPayout}
    />
  );
}
function HistoryPage({
  catererId,
  kind,
  cursor,
  onNext,
  onPrevious,
  onPayout,
}: {
  catererId: string;
  kind: SettlementHistoryKind;
  cursor?: SettlementCursor;
  onNext: (c: SettlementCursor) => void;
  onPrevious?: () => void;
  onPayout?: (id: string) => void;
}) {
  const { t } = useApp();
  const state = useResource(
    `settlement-history:${catererId}:${kind}:${JSON.stringify(cursor)}`,
    () => api.settlementHistory(catererId, kind, cursor),
  );
  if (state.loading) return <Loading />;
  if (state.error)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  if (!state.data) return null;
  if ("unavailable" in state.data)
    return (
      <p>{t("Rincian belum tersedia.", "Details are not available yet.")}</p>
    );
  const s = state.data;
  return (
    <>
      <div className="settlement-records">
        {s.items.map((item) => (
          <HistoryRow
            key={item.id}
            item={item}
            kind={kind}
            onPayout={onPayout}
          />
        ))}
        {!s.items.length && (
          <p className="quiet-empty">
            {kind === "holds"
              ? t("Tidak ada dana ditahan.", "No held funds.")
              : t("Belum ada aktivitas.", "No activity yet.")}
          </p>
        )}
      </div>
      <Pager
        previous={onPrevious}
        next={s.nextCursor ? () => onNext(s.nextCursor!) : undefined}
      />
    </>
  );
}
function HistoryRow({
  item,
  kind,
  onPayout,
}: {
  item: SettlementHistoryItem;
  kind: SettlementHistoryKind;
  onPayout?: (id: string) => void;
}) {
  const { t, date, money, actor, kind: label } = useLabels();
  const clickable = kind === "payouts" && onPayout;
  const content = (
    <>
      <span className="settlement-row-icon">
        {kind === "payouts" ? (
          <Landmark size={20} />
        ) : kind === "holds" ? (
          <ShieldAlert size={20} />
        ) : (
          <Package size={20} />
        )}
      </span>
      <span className="settlement-row-main">
        <strong>
          {kind === "payouts"
            ? t("Pencairan ke bank", "Bank payout")
            : item.package_name || label(item.kind)}
        </strong>
        <small>
          {kind === "entries" ? label(item.kind) + " · " : ""}
          {date(item.created_at)}
        </small>
        {item.synthetic && <small>{t("Data simulasi", "Demo data")}</small>}
        {kind === "holds" && (
          <>
            <small>
              {item.allocation_hold &&
                t("Dana ditahan untuk peninjauan. ", "Funds held for review. ")}
              {item.refund_review &&
                t(
                  "Pengembalian sedang direkonsiliasi. ",
                  "Refund reconciliation in progress. ",
                )}
              {!!item.cases?.length &&
                t(
                  "Ada kasus bantuan yang belum selesai.",
                  "An unresolved support case is open.",
                )}
            </small>
            {item.cases?.map((c) => (
              <a
                key={c.id}
                href={`${actor?.role === "platform_admin" ? "/admin/support" : "/seller/support"}?case=${c.id}`}
              >
                {t("Lihat kasus", "View case")} · {c.id.slice(0, 8)}
              </a>
            ))}
          </>
        )}
      </span>
      <span className="settlement-row-value">
        <strong>{money(item.amount)}</strong>
        {item.status && (
          <Status
            status={item.status === "pending" ? "processing" : item.status}
          />
        )}
      </span>
      {clickable && <ChevronRight size={18} />}
    </>
  );
  return clickable ? (
    <button
      type="button"
      className="settlement-row settlement-row-button"
      onClick={() => onPayout(item.id)}
    >
      {content}
    </button>
  ) : (
    <div className="settlement-row">{content}</div>
  );
}
function Pager({
  previous,
  next,
}: {
  previous?: () => void;
  next?: () => void;
}) {
  const { t } = useApp();
  return previous || next ? (
    <nav
      className="settlement-pagination"
      aria-label={t("Halaman riwayat", "History pages")}
    >
      <button
        type="button"
        className="button secondary small"
        disabled={!previous}
        onClick={previous}
      >
        {t("Sebelumnya", "Previous")}
      </button>
      <button
        type="button"
        className="button secondary small"
        disabled={!next}
        onClick={next}
      >
        {t("Berikutnya", "Next")}
      </button>
    </nav>
  ) : null;
}
export function SettlementDetail({
  catererId,
  selection,
  onClose,
}: {
  catererId: string;
  selection: string;
  onClose: () => void;
}) {
  const { t } = useApp();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        selection === "holds"
          ? t("Dana ditahan", "Held funds")
          : t("Rincian pencairan", "Payout details")
      }
      size="form"
    >
      {selection === "holds" ? (
        <SettlementHistory catererId={catererId} kind="holds" reporting />
      ) : (
        <PayoutDetail catererId={catererId} payoutId={selection} />
      )}
    </Dialog>
  );
}
function PayoutDetail({
  catererId,
  payoutId,
}: {
  catererId: string;
  payoutId: string;
}) {
  const [cursors, setCursors] = useState<(SettlementCursor | undefined)[]>([
    undefined,
  ]);
  const cursor = cursors[cursors.length - 1];
  return (
    <PayoutPage
      key={JSON.stringify(cursor)}
      catererId={catererId}
      payoutId={payoutId}
      cursor={cursor}
      previous={
        cursors.length > 1 ? () => setCursors(cursors.slice(0, -1)) : undefined
      }
      next={(c) => setCursors([...cursors, c])}
    />
  );
}
function PayoutPage({
  catererId,
  payoutId,
  cursor,
  previous,
  next,
}: {
  catererId: string;
  payoutId: string;
  cursor?: SettlementCursor;
  previous?: () => void;
  next: (c: SettlementCursor) => void;
}) {
  const { t, date, money } = useLabels();
  const state = useResource(
    `settlement-payout:${catererId}:${payoutId}:${JSON.stringify(cursor)}`,
    () => api.settlementPayout(catererId, payoutId, cursor),
  );
  if (state.loading) return <Loading />;
  if (state.error)
    return <ErrorNotice message={state.error} retry={state.reload} />;
  if (!state.data) return null;
  if ("unavailable" in state.data)
    return (
      <p>{t("Rincian belum tersedia.", "Details are not available yet.")}</p>
    );
  const p = state.data;
  const failed = ["failed", "rejected", "reversed", "cancelled"].includes(
    p.status,
  );
  return (
    <div className="settlement-detail">
      {p.synthetic && (
        <span className="settlement-demo">
          {t(
            "Data simulasi · tidak ada transfer nyata",
            "Demo data · no real transfer",
          )}
        </span>
      )}
      <strong className="settlement-detail-amount">{money(p.amount)}</strong>
      <Status status={p.status === "pending" ? "processing" : p.status} />
      <p className="small">
        {t("Dibuat", "Created")}: {date(p.created_at)}
      </p>
      <p className="small">
        {t("Referensi", "Reference")}:{" "}
        <span className="settlement-reference">{p.reference}</span>
      </p>
      {failed && (
        <p className="notice error">
          {p.status === "reversed"
            ? t(
                "Pencairan dibalik. Hubungi Catera dengan referensi ini untuk tindak lanjut.",
                "This payout was reversed. Contact Catera with this reference for follow-up.",
              )
            : p.status === "cancelled"
              ? t(
                  "Pencairan dibatalkan sebelum selesai. Periksa saldo dan dana ditahan.",
                  "This payout was cancelled before completion. Check your balance and held funds.",
                )
              : t(
                  "Pencairan tidak berhasil. Hubungi Catera dengan referensi ini untuk peninjauan.",
                  "This payout did not succeed. Contact Catera with this reference for review.",
                )}
        </p>
      )}
      <h3>{t("Status yang tercatat", "Recorded status history")}</h3>
      {p.events.length ? (
        <ol className="settlement-timeline">
          {p.events.map((e, i) => (
            <li key={`${e.recordedAt}-${i}`}>
              <Status
                status={e.status === "pending" ? "processing" : e.status}
              />
              <small>{date(e.recordedAt)}</small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">
          {t(
            "Riwayat perubahan status belum tersedia.",
            "Status changes were not recorded for this payout.",
          )}
        </p>
      )}
      <h3>{t("Pembelian dalam pencairan", "Included purchases")}</h3>
      {p.items.map((item) => (
        <div className="settlement-allocation" key={item.id}>
          <span>
            <strong>{item.package_name || t("Pembelian", "Purchase")}</strong>
            <small>{item.checkout_id}</small>
          </span>
          <strong>{money(item.amount)}</strong>
        </div>
      ))}
      {!p.items.length && (
        <p>
          {t("Tidak ada rincian pembelian.", "No purchase details available.")}
        </p>
      )}
      <Pager
        previous={previous}
        next={p.nextCursor ? () => next(p.nextCursor!) : undefined}
      />
    </div>
  );
}
