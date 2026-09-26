export type DirectPaymentMethod = "VIRTUAL_ACCOUNT_BRI" | "QRIS";
export type PaymentInstruction =
  | {
      kind: "virtual_account";
      accountNumber: string;
      accountName: string;
      bank: "BRI";
    }
  | { kind: "qris"; qrContent: string };
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
  if (input.checkoutState === "paid" && input.hasSubscription)
    return {
      phase: "paid",
      action: "view_calendar",
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
