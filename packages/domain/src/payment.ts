/**
 * The banks whose virtual accounts Catera creates through DOKU SNAP (one API for every bank, configured per bank).
 * The key is the bank's short name; the DOKU channel is `VA_CHANNELS[key]`.
 */
export const VA_CHANNELS = {
  BCA: "VIRTUAL_ACCOUNT_BCA",
  MANDIRI: "VIRTUAL_ACCOUNT_BANK_MANDIRI",
  BRI: "VIRTUAL_ACCOUNT_BRI",
  BNI: "VIRTUAL_ACCOUNT_BNI",
  BSI: "VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI",
  PERMATA: "VIRTUAL_ACCOUNT_BANK_PERMATA",
  CIMB: "VIRTUAL_ACCOUNT_BANK_CIMB",
} as const;
export type VaBank = keyof typeof VA_CHANNELS;
/**
 * E-wallets and paylater: the customer finishes on the provider's page, reached through a DOKU Checkout session locked
 * to that one method. The key is the env/config name; the value is DOKU's code.
 */
export const REDIRECT_CHANNELS = {
  SHOPEEPAY: "EMONEY_SHOPEE_PAY",
  DANA: "EMONEY_DANA",
  OVO: "EMONEY_OVO",
  LINKAJA: "EMONEY_LINKAJA",
  KREDIVO: "PEER_TO_PEER_KREDIVO",
  AKULAKU: "PEER_TO_PEER_AKULAKU",
  INDODANA: "PEER_TO_PEER_INDODANA",
} as const;
export type RedirectKey = keyof typeof REDIRECT_CHANNELS;
export type VaChannel = (typeof VA_CHANNELS)[VaBank];
export type RedirectChannel = (typeof REDIRECT_CHANNELS)[RedirectKey];
export type DirectPaymentMethod = "QRIS" | VaChannel | RedirectChannel;
/** Every direct method, in the order the server lists them. */
export const DIRECT_PAYMENT_METHODS: readonly DirectPaymentMethod[] = [
  "QRIS",
  ...Object.values(VA_CHANNELS),
  ...Object.values(REDIRECT_CHANNELS),
];
/** Paylater providers need the customer's contact and the order's line items in the checkout request. */
export const PAYLATER_CHANNELS: readonly RedirectChannel[] = [
  "PEER_TO_PEER_KREDIVO",
  "PEER_TO_PEER_AKULAKU",
  "PEER_TO_PEER_INDODANA",
];
export function directChannelKind(method: DirectPaymentMethod): "qris" | "va" | "redirect" {
  if (method === "QRIS") return "qris";
  return (Object.values(VA_CHANNELS) as string[]).includes(method) ? "va" : "redirect";
}
export function vaBankOf(method: DirectPaymentMethod): VaBank | null {
  const hit = (Object.keys(VA_CHANNELS) as VaBank[]).find((k) => VA_CHANNELS[k] === method);
  return hit ?? null;
}
export function redirectKeyOf(method: DirectPaymentMethod): RedirectKey | null {
  const hit = (Object.keys(REDIRECT_CHANNELS) as RedirectKey[]).find((k) => REDIRECT_CHANNELS[k] === method);
  return hit ?? null;
}
export type PaymentInstruction =
  | {
      kind: "virtual_account";
      accountNumber: string;
      accountName: string;
      bank: VaBank;
    }
  | { kind: "qris"; qrContent: string }
  /** Open `url` (DOKU's page for that one method) to finish on the e-wallet's or paylater's own page. */
  | { kind: "redirect"; url: string; channel: RedirectChannel };
export type PaymentView = {
  mode: "hosted" | "direct";
  availableMethods: DirectPaymentMethod[];
  selectedMethod: DirectPaymentMethod | null;
  status:
    | "choose_method"
    | "preparing"
    | "awaiting_payment"
    | "checking"
    | "failed"
    | "paid"
    | "expired";
  expiresAt: string;
  instructions: PaymentInstruction | null;
};
export type PaymentAvailability = {
  mode: "hosted" | "direct";
  availableMethods: DirectPaymentMethod[];
};

export type PaymentPhase =
  | "preparing"
  | "awaiting_payment"
  | "checking"
  | "paid"
  | "expired"
  | "booking_unresolved";
export type PaymentNextAction =
  | "prepare_payment"
  | "open_payment"
  | "check_status"
  | "view_calendar"
  | "choose_new_schedule"
  | "contact_support";
export type PaymentPresentation = {
  phase: PaymentPhase;
  action: PaymentNextAction;
  preventDuplicatePayment: boolean;
};

export function paymentPresentation(
  input: {
    checkoutState: string;
    expiresAt: string;
    payment?: Pick<PaymentView, "mode" | "status" | "selectedMethod"> | null;
    hasPaymentUrl?: boolean;
    hasSubscription?: boolean;
  },
  now = Date.now(),
): PaymentPresentation {
  if (input.checkoutState === "payment_exception")
    return {
      phase: "booking_unresolved",
      action: "contact_support",
      preventDuplicatePayment: true,
    };
  if (input.checkoutState === "paid")
    return input.hasSubscription
      ? {
          phase: "paid",
          action: "view_calendar",
          preventDuplicatePayment: true,
        }
      : {
          phase: "checking",
          action: "check_status",
          preventDuplicatePayment: true,
        };
  if (["failed", "expired"].includes(input.checkoutState))
    return {
      phase: "expired",
      action: "choose_new_schedule",
      preventDuplicatePayment: false,
    };
  const expired = Date.parse(input.expiresAt) <= now;
  if (input.payment?.mode === "direct") {
    if (
      expired ||
      ["checking", "paid", "expired"].includes(input.payment.status)
    )
      return {
        phase:
          input.payment.status === "expired" && !expired
            ? "expired"
            : "checking",
        action: "check_status",
        preventDuplicatePayment: true,
      };
    if (input.payment.status === "awaiting_payment")
      return {
        phase: "awaiting_payment",
        action: "check_status",
        preventDuplicatePayment: true,
      };
    if (input.payment.status === "failed")
      return {
        phase: "preparing",
        action: "contact_support",
        preventDuplicatePayment: true,
      };
    return {
      phase: "preparing",
      action: "prepare_payment",
      preventDuplicatePayment: false,
    };
  }
  if (expired)
    return {
      phase: "expired",
      action: "choose_new_schedule",
      preventDuplicatePayment: false,
    };
  if (input.hasPaymentUrl)
    return {
      phase: "awaiting_payment",
      action: "open_payment",
      preventDuplicatePayment: false,
    };
  return {
    phase: "preparing",
    action: "check_status",
    preventDuplicatePayment: true,
  };
}
