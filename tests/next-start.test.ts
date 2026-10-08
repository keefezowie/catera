import { expect, it } from "vitest";
import { nextStartAfter } from "@catera/domain";

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
