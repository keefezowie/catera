import type { Delivery, SettlementState } from "./index";
export type DeliveryChangeResult = {
  id: string;
  delivery: Delivery;
  subscription: { id: string; starts_on: string; ends_on: string };
};
export type PayoutDestination = {
  id: string;
  catererId: string;
  version: number;
  bank: string;
  holder: string;
  maskedAccount: string;
  recipientType: "INDIVIDUAL" | "BUSINESS";
  status: "submitted" | "approved" | "rejected";
  active: boolean;
  reason: string | null;
  createdAt: string;
  caterer?: string;
};
export type PayoutSetup = {
  active: PayoutDestination | null;
  latest: PayoutDestination | null;
  settlement: SettlementState;
  providerReady: boolean;
  dispatchEnabled: boolean;
  legacyDestination?: {
    bank: string;
    maskedAccount: string;
    holder: string;
  } | null;
};
export type AccountRequest = {
  id: string;
  user_id: string;
  name: string;
  kind: "help" | "deletion";
  body: string;
  status: "open" | "resolved";
  resolution: string | null;
  created_at: string;
};
