import type { Locale } from "./index";
export type SettlementState = {
  reportingVersion?: number;
  payoutReadiness?:
    | "not_configured"
    | "synthetic"
    | "seller_disabled"
    | "dispatch_disabled"
    | "ready";
  nextProcessingAt?: string | null;
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
  payouts: {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    failure_code?: string | null;
  }[];
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

export type SettlementUnavailable = {
  unavailable: true;
  reason: "not_installed";
};
export type SettlementResponse = SettlementState | SettlementUnavailable;
export type SettlementCursor = { at: string; id: string };
export type SettlementReport = {
  from: string;
  to: string;
  timezone: "Asia/Jakarta";
  credits: string;
  adjustments: string;
  days: { date: string; credits: string; adjustments: string }[];
};
export type SettlementHistoryKind = "payouts" | "entries" | "holds";
export type SettlementHistoryItem = {
  id: string;
  created_at: string;
  amount: string;
  status?: string;
  kind?: string;
  synthetic?: boolean;
  checkout_id?: string;
  package_name?: string | null;
  allocation_id?: string | null;
  day_id?: string | null;
  allocation_hold?: boolean;
  refund_review?: boolean;
  cases?: { id: string; status: string }[];
};
export type SettlementPage = {
  items: SettlementHistoryItem[];
  nextCursor: SettlementCursor | null;
};
export type SettlementPayout = SettlementPage & {
  id: string;
  amount: string;
  status: string;
  created_at: string;
  reference: string;
  synthetic: boolean;
  failureCode: string | null;
  events: { status: string; recordedAt: string }[];
};
export type SettlementReportingUnavailable = {
  unavailable: true;
  reason: "reporting_not_installed";
};
export type SettlementControls =
  { multiCycle: boolean; automaticPayouts: boolean } | SettlementUnavailable;
