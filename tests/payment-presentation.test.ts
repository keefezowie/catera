import { describe, expect, it } from "vitest";
import { paymentPresentation } from "@catera/domain";

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
});
