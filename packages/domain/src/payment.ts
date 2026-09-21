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
