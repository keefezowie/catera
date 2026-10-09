import { describe, expect, it } from "vitest";
import { jakartaClock, journeyCaption, mealJourney, type DeliveryMeal } from "@catera/domain";

const meal = (over: Partial<DeliveryMeal> = {}): DeliveryMeal => ({ meal: "lunch", status: "scheduled", ...over });

describe("mealJourney", () => {
  it("follows the fulfilment status, not the clock", () => {
    expect(mealJourney(meal()).stage).toBe("scheduled");
    expect(mealJourney(meal({ status: "preparing" })).stage).toBe("preparing");
    expect(mealJourney(meal({ status: "out_for_delivery" })).stage).toBe("out_for_delivery");
    expect(mealJourney(meal({ status: "delivered" })).stage).toBe("delivered");
  });

  it("carries the timestamps and who recorded the arrival", () => {
    const j = mealJourney(
      meal({
        status: "delivered",
        cooking_started_at: "2026-10-09T01:10:00Z",
        departed_at: "2026-10-09T03:42:00Z",
        confirmed_at: "2026-10-09T04:30:00Z",
        confirmed_by: "customer",
      }),
    );
    expect(j).toEqual({
      stage: "delivered",
      cookingAt: "2026-10-09T01:10:00Z",
      departedAt: "2026-10-09T03:42:00Z",
      arrivedAt: "2026-10-09T04:30:00Z",
      arrivedBy: "customer",
      issue: false,
    });
  });

  it("has no arrival before the meal is delivered", () => {
    const j = mealJourney(meal({ status: "out_for_delivery", confirmed_at: "2026-10-09T04:30:00Z", confirmed_by: "auto" }));
    expect(j.arrivedAt).toBeNull();
    expect(j.arrivedBy).toBeNull();
  });

  it("keeps the stage its timestamps imply when the meal is marked a problem", () => {
    const departed = mealJourney(meal({ status: "issue", departed_at: "2026-10-09T03:42:00Z" }));
    expect(departed).toMatchObject({ stage: "out_for_delivery", issue: true });
    const cooking = mealJourney(meal({ status: "issue", cooking_started_at: "2026-10-09T01:10:00Z" }));
    expect(cooking).toMatchObject({ stage: "preparing", issue: true });
    expect(mealJourney(meal({ status: "issue" }))).toMatchObject({ stage: "scheduled", issue: true });
  });
});

describe("jakartaClock", () => {
  it("reads HH.MM in Jakarta and nothing from a missing or unreadable time", () => {
    expect(jakartaClock("2026-10-09T01:10:00Z")).toBe("08.10");
    expect(jakartaClock("2026-10-09T17:05:00Z")).toBe("00.05");
    expect(jakartaClock(null)).toBeNull();
    expect(jakartaClock(undefined)).toBeNull();
    expect(jakartaClock("nonsense")).toBeNull();
  });
});

describe("journeyCaption", () => {
  const caption = (m: Partial<DeliveryMeal>, locale: "id" | "en") => journeyCaption(mealJourney(meal(m)), locale);

  it.each([
    ["scheduled", {}, "Terjadwal", "Scheduled"],
    [
      "preparing with a start time",
      { status: "preparing", cooking_started_at: "2026-10-09T01:10:00Z" },
      "Dimasak 08.10",
      "Cooking since 08.10",
    ],
    ["preparing without a start time", { status: "preparing" }, "Dimasak", "Cooking"],
    [
      "out for delivery with a departure",
      { status: "out_for_delivery", departed_at: "2026-10-09T03:42:00Z" },
      "Berangkat 10.42",
      "Left at 10.42",
    ],
    ["out for delivery without a departure", { status: "out_for_delivery" }, "Sedang diantar", "On the way"],
    ["delivered by the system", { status: "delivered", confirmed_by: "auto" }, "Tercatat sampai", "Recorded as arrived"],
    ["delivered by the customer", { status: "delivered", confirmed_by: "customer" }, "Sampai", "Arrived"],
    ["delivered by the caterer", { status: "delivered", confirmed_by: "caterer" }, "Sampai", "Arrived"],
  ] as [string, Partial<DeliveryMeal>, string, string][])("%s", (_name, m, id, en) => {
    expect(caption(m, "id")).toBe(id);
    expect(caption(m, "en")).toBe(en);
  });

  it("says nothing for a meal marked a problem", () => {
    const m = { status: "issue", departed_at: "2026-10-09T03:42:00Z" };
    expect(caption(m, "id")).toBeNull();
    expect(caption(m, "en")).toBeNull();
  });

  it("falls back to the plain caption for an unreadable time", () => {
    expect(caption({ status: "preparing", cooking_started_at: "nonsense" }, "id")).toBe("Dimasak");
  });
});
