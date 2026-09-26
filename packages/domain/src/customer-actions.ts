import type { CustomerActionItem, Locale } from "./index";

export type CustomerActionPresentation = {
  title: string;
  action: string;
  tone: "urgent" | "attention" | "informative";
};

const copy = (
  locale: Locale,
  id: [string, string, CustomerActionPresentation["tone"]],
  en: [string, string, CustomerActionPresentation["tone"]],
): CustomerActionPresentation => {
  const [title, action, tone] = locale === "id" ? id : en;
  return { title, action, tone };
};

export function customerActionPresentation(
  item: CustomerActionItem,
  locale: Locale,
): CustomerActionPresentation {
  switch (item.status) {
    case "selection_due":
      return copy(
        locale,
        ["Pilih menu sebelum batas waktu", "Pilih menu", "urgent"],
        ["Choose your menu before cutoff", "Choose menu", "urgent"],
      );
    case "choose_method":
      return copy(
        locale,
        ["Pilih cara pembayaran", "Lanjutkan pembayaran", "attention"],
        ["Choose a payment method", "Continue payment", "attention"],
      );
    case "awaiting_payment":
      return copy(
        locale,
        ["Selesaikan pembayaran", "Lihat instruksi", "urgent"],
        ["Complete your payment", "View instructions", "urgent"],
      );
    case "checking_payment":
      return copy(
        locale,
        ["Status pembayaran sedang diperiksa", "Periksa status", "informative"],
        ["Your payment status is being checked", "Check status", "informative"],
      );
    case "payment_exception":
      return copy(
        locale,
        [
          "Pembayaran diterima, pemesanan perlu ditinjau",
          "Lihat pesanan",
          "urgent",
        ],
        ["Payment received, booking needs review", "View order", "urgent"],
      );
    case "responded":
      return copy(
        locale,
        ["Katerer sudah menanggapi kendala", "Lihat tanggapan", "attention"],
        ["The caterer responded to your issue", "View response", "attention"],
      );
    case "escalated":
      return copy(
        locale,
        ["Catera sedang meninjau kendala", "Lihat perkembangan", "informative"],
        ["Catera is reviewing your issue", "View progress", "informative"],
      );
    default:
      return copy(
        locale,
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
