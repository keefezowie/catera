import { describe, expect, it } from "vitest";
import { paymentPresentation, type PaymentView } from "@catera/domain";

const future = "2099-01-01T00:00:00.000Z";

describe("payment presentation", () => {
  it("gives each confirmed state exactly one safe next action", () => {
    expect(
      paymentPresentation({
        checkoutState: "pending",
        expiresAt: future,
        payment: {
          mode: "direct",
          status: "awaiting_payment",
          selectedMethod: "QRIS",
        },
      }),
    ).toMatchObject({ phase: "awaiting_payment", action: "check_status" });
    expect(
      paymentPresentation({
        checkoutState: "paid",
        expiresAt: future,
        hasSubscription: true,
      }),
    ).toMatchObject({ phase: "paid", action: "view_calendar" });
    expect(
      paymentPresentation({ checkoutState: "expired", expiresAt: future }),
    ).toMatchObject({ phase: "expired", action: "choose_new_schedule" });
  });

  it("never encourages duplicate payment while status is uncertain", () => {
    for (const status of ["checking", "expired"] as const) {
      expect(
        paymentPresentation({
          checkoutState: "pending",
          expiresAt: future,
          payment: { mode: "direct", status, selectedMethod: "QRIS" },
        }),
      ).toMatchObject({
        action: "check_status",
        preventDuplicatePayment: true,
      });
    }
    expect(
      paymentPresentation({
        checkoutState: "payment_exception",
        expiresAt: future,
      }),
    ).toEqual({
      phase: "booking_unresolved",
      action: "contact_support",
      preventDuplicatePayment: true,
    });
  });

  it.each([
    {
      detail: "a hosted payment link remains",
      expiresAt: future,
      hasPaymentUrl: true,
    },
    {
      detail: "the old payment deadline has passed",
      expiresAt: "2000-01-01T00:00:00.000Z",
      hasPaymentUrl: true,
    },
    {
      detail: "direct instructions still report awaiting payment",
      expiresAt: future,
      payment: {
        mode: "direct",
        status: "awaiting_payment",
        selectedMethod: "QRIS",
      } satisfies Pick<PaymentView, "mode" | "status" | "selectedMethod">,
    },
  ])(
    "checks the booking after payment when $detail",
    ({ detail, ...input }) => {
      expect(
        paymentPresentation({
          ...input,
          checkoutState: "paid",
          hasSubscription: false,
        }),
      ).toEqual({
        phase: "checking",
        action: "check_status",
        preventDuplicatePayment: true,
      });
    },
  );
});
