import { expect, it } from "vitest";
import { nextStartAfter, startDates } from "@catera/domain";

const offer = { id: "p-1", timezone: "Asia/Jakarta", cutoff: "17:00", weekdays: [1, 2, 3, 4, 5] };
const now = new Date("2026-10-08T03:00:00Z");
const plan = (ends_on: string, extra: Record<string, string> = {}) => ({
  package_id: "p-1",
  status: "active",
  ends_on,
  ...extra,
});

it("returns the first bookable day after the active plan", () => {
  expect(nextStartAfter(offer, [plan("2026-10-15")], now)).toEqual({
    endsOn: "2026-10-15",
    start: "2026-10-16",
  });
});

it("skips non-operating days", () => {
  expect(nextStartAfter(offer, [plan("2026-10-16")], now)).toEqual({
    endsOn: "2026-10-16",
    start: "2026-10-19",
  });
});

it("nextStartAfter finds a start after a long active plan", () => {
  expect(nextStartAfter(offer, [plan("2026-11-20")], now)).toEqual({
    endsOn: "2026-11-20",
    start: "2026-11-23",
  });
});

it("uses the latest end among active plans of this package", () => {
  expect(
    nextStartAfter(
      offer,
      [plan("2026-10-15"), plan("2026-10-22"), plan("2026-12-01", { status: "ended" }), plan("2026-12-01", { package_id: "p-2" })],
      now,
    ),
  ).toEqual({ endsOn: "2026-10-22", start: "2026-10-23" });
});

it("returns null without an active plan for this package", () => {
  expect(nextStartAfter(offer, [], now)).toBeNull();
  expect(nextStartAfter(offer, [plan("2026-10-15", { package_id: "p-2" })], now)).toBeNull();
  expect(nextStartAfter(offer, [plan("2026-10-15", { status: "ended" })], now)).toBeNull();
});

it("startDates lists bookable days soonest first, skipping closed ones", () => {
  // Thursday 8 Okt 10:00 Jakarta: Friday's cutoff (Thursday 17.00) is still open.
  expect(startDates(offer, now, 4)).toEqual(["2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14"]);
});

it("startDates drops a day once its cutoff has passed", () => {
  const late = new Date("2026-10-08T10:30:00Z");
  expect(startDates(offer, late, 2)).toEqual(["2026-10-12", "2026-10-13"]);
});

it("startDates stays within three weeks and honours the count", () => {
  expect(startDates(offer, now, 100)).toHaveLength(14);
  expect(startDates({ ...offer, weekdays: [] }, now, 3)).toEqual([]);
});
