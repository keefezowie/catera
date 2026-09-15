import type { Locale } from "./index";
export type SettlementState = {
  expected: string;
  earned: string;
  held: string;
  reserved: string;
  paid: string;
  available: string;
  recovery: string;
  nextPayoutAt: string;
  entries: {
    id: string;
    kind: string;
    amount: string;
    created_at: string;
    allocation_id: string | null;
    day_id: string | null;
  }[];
  payouts: { id: string; amount: number; status: string; created_at: string }[];
  policy: {
    id: string;
    enabled: boolean;
    synthetic: boolean;
    minimumAmount: number;
    maximumAmount: number;
  } | null;
};
export function settlementCurrency(value: string, locale: Locale = "id") {
  return new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(BigInt(value));
}
