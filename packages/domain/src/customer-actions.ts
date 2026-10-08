import { addDays, localDay } from "./dates";
import type { CustomerActionItem, Locale } from "./index";

export type CustomerActionPresentation = {
  title: string;
  action: string;
  tone: "urgent" | "attention" | "informative";
  nextActor: "customer" | "caterer" | "catera" | "system";
};

const nextActor: Record<
  CustomerActionItem["status"],
  CustomerActionPresentation["nextActor"]
> = {
  selection_due: "customer",
  choose_method: "customer",
  awaiting_payment: "customer",
  responded: "customer",
  checking_payment: "system",
  open: "caterer",
  escalated: "catera",
  payment_exception: "catera",
  expired: "customer",
};

export type CustomerActionGroup = "review" | "urgent" | "updates" | "later";

export function groupCustomerActions(
  items: CustomerActionItem[],
  today = localDay(),
): Record<CustomerActionGroup, CustomerActionItem[]> {
  const groups: Record<CustomerActionGroup, CustomerActionItem[]> = {
    review: [],
    urgent: [],
    updates: [],
    later: [],
  };
  const tomorrow = addDays(today, 1);
  // Keep the feed's authoritative ordering within each presentation group.
  for (const item of items) {
    const group =
      item.status === "payment_exception"
        ? "review"
        : nextActor[item.status] !== "customer"
          ? "updates"
          : item.status === "selection_due" &&
              item.dueAt &&
              localDay(new Date(item.dueAt)) > tomorrow
            ? "later"
            : "urgent";
    groups[group].push(item);
  }
  return groups;
}

const copy = (
  locale: Locale,
  actor: CustomerActionPresentation["nextActor"],
  id: [string, string, CustomerActionPresentation["tone"]],
  en: [string, string, CustomerActionPresentation["tone"]],
): CustomerActionPresentation => {
  const [title, action, tone] = locale === "id" ? id : en;
  return { title, action, tone, nextActor: actor };
};

export function customerActionPresentation(
  item: CustomerActionItem,
  locale: Locale,
): CustomerActionPresentation {
  switch (item.status) {
    case "selection_due":
      return copy(
        locale,
        nextActor[item.status],
        ["Pilih menu sebelum batas waktu", "Pilih menu", "urgent"],
        ["Choose your menu before cutoff", "Choose menu", "urgent"],
      );
    case "choose_method":
      return copy(
        locale,
        nextActor[item.status],
        ["Pilih cara pembayaran", "Lanjutkan pembayaran", "attention"],
        ["Choose a payment method", "Continue payment", "attention"],
      );
    case "awaiting_payment":
      return copy(
        locale,
        nextActor[item.status],
        ["Selesaikan pembayaran", "Lihat instruksi", "urgent"],
        ["Complete your payment", "View instructions", "urgent"],
      );
    case "checking_payment":
      return copy(
        locale,
        nextActor[item.status],
        ["Status pembayaran sedang diperiksa", "Periksa status", "informative"],
        ["Your payment status is being checked", "Check status", "informative"],
      );
    case "payment_exception":
      return copy(
        locale,
        nextActor[item.status],
        [
          "Pembayaran diterima, pemesanan perlu ditinjau",
          "Lihat pesanan",
          "urgent",
        ],
        ["Payment received, booking needs review", "View order", "urgent"],
      );
    case "expired":
      return copy(
        locale,
        nextActor[item.status],
        ["Waktu pembayaran habis", "Bayar lagi", "attention"],
        ["Payment time ran out", "Pay again", "attention"],
      );
    case "responded":
      return copy(
        locale,
        nextActor[item.status],
        ["Katerer sudah menanggapi kendala", "Lihat tanggapan", "attention"],
        ["The caterer responded to your issue", "View response", "attention"],
      );
    case "escalated":
      return copy(
        locale,
        nextActor[item.status],
        ["Catera sedang meninjau kendala", "Lihat perkembangan", "informative"],
        ["Catera is reviewing your issue", "View progress", "informative"],
      );
    default:
      return copy(
        locale,
        nextActor[item.status],
        [
          "Kendala pengantaran menunggu tanggapan",
          "Lihat kendala",
          "attention",
        ],
        ["A delivery issue is awaiting a response", "View issue", "attention"],
      );
  }
}

export function compareCustomerActions(
  left: CustomerActionItem,
  right: CustomerActionItem,
) {
  return (
    left.priority - right.priority ||
    (left.dueAt ?? left.serviceDate ?? "9999").localeCompare(
      right.dueAt ?? right.serviceDate ?? "9999",
    ) ||
    left.id.localeCompare(right.id)
  );
}
