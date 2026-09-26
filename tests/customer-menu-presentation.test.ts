import { describe, expect, it } from "vitest";
import { customerMenuPresentation } from "@catera/domain";

describe("customer menu presentation", () => {
  it("marks public dishes as examples available after payment", () => {
    expect(
      customerMenuPresentation({ surface: "package", activeOptionCount: 4 }),
    ).toEqual({ state: "available_after_payment", example: true });
    expect(
      customerMenuPresentation({ surface: "package", activeOptionCount: 0 }),
    ).toEqual({ state: "not_announced", example: false });
  });

  it("keeps saved, due, missed-cutoff, and unannounced states distinct", () => {
    const base = {
      surface: "delivery" as const,
      hasSavedMenu: false,
      editable: true,
      selectionStatus: "pending" as const,
      activeOptionCount: 3,
    };
    expect(customerMenuPresentation(base).state).toBe("selection_due");
    expect(
      customerMenuPresentation({ ...base, hasSavedMenu: true }).state,
    ).toBe("saved");
    expect(customerMenuPresentation({ ...base, editable: false }).state).toBe(
      "caterer_choice",
    );
    expect(
      customerMenuPresentation({ ...base, activeOptionCount: 0 }).state,
    ).toBe("not_announced");
  });
});
