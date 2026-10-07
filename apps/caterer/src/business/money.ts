import type { SettlementState } from "@catera/domain";

type Key = "expected" | "earned" | "held" | "available" | "reserved" | "paid" | "recovery";

/** The seven money states in the order money moves, each with a plain one-line explanation. */
export const moneyStates: { key: Key; label: [string, string]; hint: [string, string] }[] = [
  { key: "expected", label: ["Akan diterima", "Coming in"], hint: ["Dari pengantaran yang belum terjadi.", "From deliveries that haven't happened yet."] },
  { key: "earned", label: ["Sudah diperoleh", "Earned"], hint: ["Pengantaran selesai, menunggu jadwal pencairan.", "Delivered, waiting for the payout schedule."] },
  { key: "held", label: ["Ditahan sementara", "On hold"], hint: ["Ada keluhan pelanggan yang sedang ditinjau.", "A customer issue is being reviewed."] },
  { key: "available", label: ["Siap dicairkan", "Ready to pay out"], hint: ["Ikut pencairan berikutnya ke rekening Anda.", "Goes out in the next payout to your account."] },
  { key: "reserved", label: ["Sedang dikirim", "Being sent"], hint: ["Sedang dikirim ke rekening Anda.", "On its way to your bank account."] },
  { key: "paid", label: ["Sudah dicairkan", "Paid out"], hint: ["Sudah masuk ke rekening Anda.", "Already in your bank account."] },
  { key: "recovery", label: ["Potongan", "Deductions"], hint: ["Pengembalian dana pelanggan, dipotong dari pencairan berikutnya.", "Customer refunds, taken from the next payout."] },
];

export const moneyAmount = (s: SettlementState, key: Key) => s[key];
