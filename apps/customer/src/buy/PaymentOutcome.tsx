import type { ReactNode } from "react";
import { router } from "expo-router";
import { currency, paymentPresentation, type Checkout, type Locale } from "@catera/domain";
import { Button, colors, Screen, Text } from "@catera/mobile-ui";

export type Stage = "pay" | "checking" | "paid" | "expired" | "failed" | "review" | "refunded";
/** Nothing left to poll for: the provider has answered one way or the other. */
export const FINAL: Stage[] = ["paid", "expired", "failed", "review", "refunded"];

/** Where this checkout stands, from the server state and the provider deadline. */
export function stageOf(c: Checkout, now: number): Stage {
  if (c.state === "refunded" || c.state === "partially_refunded") return "refunded";
  // A direct payment whose hold ended before any payment instructions were shown (no method,
  // still preparing, never answered, or failed) cannot have been paid: it ran out, as Riwayat
  // pembayaran says. Once a QR or VA number was shown the outcome is unknown, so it keeps checking.
  if (
    c.state === "pending" &&
    c.payment?.mode === "direct" &&
    Date.parse(c.payment.expiresAt || c.expires_at) <= now &&
    !["awaiting_payment", "paid"].includes(c.payment.status)
  )
    return "expired";
  const p = paymentPresentation(
    {
      checkoutState: c.state,
      expiresAt: c.payment?.expiresAt || c.expires_at,
      payment: c.payment,
      hasPaymentUrl: !!c.payment_url,
      hasSubscription: !!c.subscription_id,
    },
    now,
  );
  if (p.phase === "paid") return "paid";
  if (p.phase === "booking_unresolved") return "review";
  // The provider says expired but the checkout still holds the days: keep checking, never sell again.
  if (p.phase === "expired") return p.preventDuplicatePayment ? "checking" : c.state === "failed" ? "failed" : "expired";
  return p.phase === "checking" ? "checking" : "pay";
}

/** The choices a new checkout starts from when an unpaid one ran out. */
export type PayAgain = {
  packageId: string;
  renewedFrom?: string | null;
  trial: boolean;
  portions: number;
  cycles?: number;
  addressId?: string;
};

/** Bayar lagi: a new checkout with the same choices, from Perpanjang for a renewal, else Beli
 * (a trial stays a trial). Bayar and Riwayat pembayaran both go here. */
export function payAgainHref(p: PayAgain): string {
  const choices = new URLSearchParams({
    ...(p.trial ? { trial: "1" } : {}),
    portions: String(p.portions),
    ...(p.trial ? {} : { cycles: String(p.cycles ?? 1) }),
    ...(p.addressId ? { addressId: p.addressId } : {}),
  }).toString();
  return `${p.renewedFrom ? `/renew/${encodeURIComponent(p.renewedFrom)}` : `/beli/${encodeURIComponent(p.packageId)}`}?${choices}`;
}

/** Every Bayar state other than paying now: one sentence and the one next step. */
export function PaymentOutcome({
  checkout: c,
  stage,
  header,
  help,
  busy,
  error,
  onCheck,
  locale,
  t,
}: {
  checkout: Checkout;
  stage: Exclude<Stage, "pay">;
  header: ReactNode;
  help: ReactNode;
  busy: boolean;
  error: string;
  onCheck: () => void;
  locale: Locale;
  t: (id: string, en: string) => string;
}) {
  const message: Record<Exclude<Stage, "pay">, [string, string]> = {
    checking: [
      t("Memeriksa pembayaran", "Checking payment"),
      t("Jangan bayar lagi. Status diperiksa langsung dari bank.", "Don't pay again. The status is checked with the bank."),
    ],
    paid: [t("Pembayaran diterima", "Payment received"), t("Jadwal antar Anda sudah tersimpan.", "Your deliveries are booked.")],
    expired: [t("Waktu habis. Jadwal dicek ulang saat membayar lagi.", "Time's up. The schedule is checked again when you pay."), ""],
    failed: [t("Pembayaran gagal. Jadwal dicek ulang saat membayar lagi.", "Payment failed. The schedule is checked again when you pay."), ""],
    review: [
      t("Pembayaran sedang ditinjau", "Payment under review"),
      t(
        "Pembayaran diterima, tetapi jadwal belum terkonfirmasi. Tim Catera membantu menyelesaikannya. Jangan bayar lagi.",
        "Payment arrived but the schedule isn't confirmed yet. Catera will sort it out. Don't pay again.",
      ),
    ],
    refunded: [
      c.state === "refunded"
        ? t("Pembayaran dikembalikan", "Payment refunded")
        : t("Sebagian pembayaran dikembalikan", "Payment partly refunded"),
      t("Lihat rinciannya di Bantuan dan laporan.", "See the details in Help and reports."),
    ],
  };
  const [title, body] = message[stage];
  const q = c.quote;
  const again = payAgainHref({
    packageId: q.packageId,
    renewedFrom: q.renewedFrom,
    trial: q.trial,
    portions: q.portions,
    cycles: q.cycles,
    addressId: q.address?.id,
  });
  return (
    <Screen>
      {header}
      <Text variant="title">{title}</Text>
      {body ? <Text>{body}</Text> : null}
      <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
        {c.quote.offer.name} · {currency(c.quote.total, locale)}
      </Text>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {stage === "checking" ? <Button label={t("Cek status", "Check status")} disabled={busy} onPress={onCheck} /> : null}
      {stage === "paid" && c.quote.offer.menuSelectionMode === "customer" && c.subscription_id ? (
        <Button
          variant="secondary"
          label={t("Pilih menu", "Choose menus")}
          onPress={() => router.replace(`/subscriptions/${encodeURIComponent(c.subscription_id!)}/menu` as never)}
        />
      ) : null}
      {stage === "paid" ? <Button label={t("Ke Beranda", "Go to Home")} onPress={() => router.replace("/" as never)} /> : null}
      {stage === "expired" || stage === "failed" ? (
        <Button label={t("Bayar lagi", "Pay again")} onPress={() => router.replace(again as never)} />
      ) : null}
      {stage !== "paid" ? help : null}
    </Screen>
  );
}
