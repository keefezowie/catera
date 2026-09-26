import { describe, expect, it } from "vitest";
import {
  availabilityReasonCounts,
  availabilityReasonLabel,
  earliestAvailable,
  type DeliveryAvailability,
} from "@catera/domain";

const rows: DeliveryAvailability[] = [
  { date: "2026-09-28", available: false, reason: "CUTOFF", remaining: 0 },
  {
    date: "2026-09-29",
    available: false,
    reason: "CAPACITY",
    remaining: 1,
  },
  { date: "2026-09-30", available: true, reason: null, remaining: 8 },
];

describe("delivery availability presentation", () => {
  it("finds the earliest eligible replacement without guessing", () => {
    expect(earliestAvailable(rows)).toBe("2026-09-30");
    expect(earliestAvailable(rows.slice(0, 2))).toBeNull();
  });

  it("explains unavailable dates in Indonesian and English", () => {
    expect(availabilityReasonLabel("CAPACITY", "id")).toBe(
      "Kapasitas tidak mencukupi",
    );
    expect(availabilityReasonLabel("CUTOFF", "en")).toBe(
      "Change cutoff has passed",
    );
    expect(availabilityReasonCounts(rows)).toEqual({ CUTOFF: 1, CAPACITY: 1 });
  });
});
