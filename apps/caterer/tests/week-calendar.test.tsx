import { countOn, covers, monthGrid, settleTarget, validDay, weekOf, weekStart, windowHeight } from "../src/today/WeekStrip";

describe("weekOf: Monday to Sunday around a day", () => {
  it.each([
    ["Monday", "2026-10-05", "2026-10-05"],
    ["Wednesday", "2026-10-07", "2026-10-05"],
    ["Sunday", "2026-10-11", "2026-10-05"],
    ["a Sunday across a month boundary", "2026-11-01", "2026-10-26"],
    ["a Wednesday across a year boundary", "2025-12-31", "2025-12-29"],
    ["a Monday on a leap day", "2028-02-29", "2028-02-28"],
  ])("%s %s starts on %s", (_name, day, monday) => {
    expect(weekStart(day)).toBe(monday);
    expect(weekOf(day)).toHaveLength(7);
    expect(weekOf(day)[0]).toBe(monday);
  });
  it("runs Senin to Minggu, across the month", () => {
    expect(weekOf("2026-11-01")).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
  });
});

describe("monthGrid: the month as Monday-first weeks with the neighbours' days", () => {
  it("is 4 weeks for a February that starts on a Monday", () => {
    // Feb 2027 starts on Monday the 1st and has 28 days.
    const grid = monthGrid("2027-02");
    expect(grid).toHaveLength(4);
    expect(grid[0][0]).toBe("2027-02-01");
    expect(grid[3][6]).toBe("2027-02-28");
  });
  it("is 5 weeks for October 2026, padded by September and November", () => {
    const grid = monthGrid("2026-10");
    expect(grid).toHaveLength(5);
    expect(grid[0][0]).toBe("2026-09-28");
    expect(grid[4][6]).toBe("2026-11-01");
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
  it("is 6 weeks for a 31-day month that starts on a Saturday", () => {
    // May 2027 starts on Saturday.
    const grid = monthGrid("2027-05");
    expect(grid).toHaveLength(6);
    expect(grid[0][0]).toBe("2027-04-26");
    expect(grid[5][6]).toBe("2027-06-06");
  });
});

describe("settleTarget: where a released drag ends", () => {
  it("opens past half way and closes before it", () => {
    expect(settleTarget(0.6, 0)).toBe(1);
    expect(settleTarget(0.4, 0)).toBe(0);
  });
  it("follows a fling over the halfway rule", () => {
    expect(settleTarget(0.2, 0.8)).toBe(1);
    expect(settleTarget(0.8, -0.8)).toBe(0);
  });
});

describe("validDay", () => {
  it("accepts a real date and nothing else", () => {
    expect(validDay("2026-11-20")).toBe(true);
    expect(validDay("2026-02-30")).toBe(false);
    expect(validDay("not a date")).toBe(false);
    expect(validDay(undefined)).toBe(false);
  });
});

describe("windowHeight: the clipped window between one row and the whole month", () => {
  it("is one 56dp row at 0 and every row plus its 4dp gaps at 1", () => {
    expect(windowHeight(0, 5)).toBe(56);
    expect(windowHeight(1, 4)).toBe(4 * 56 + 3 * 4);
    expect(windowHeight(1, 5)).toBe(5 * 56 + 4 * 4);
    expect(windowHeight(1, 6)).toBe(6 * 56 + 5 * 4);
  });
  it("unfolds in between, and follows a month that changes its rows", () => {
    expect(windowHeight(0.5, 5)).toBe((56 + 296) / 2);
    expect(windowHeight(1, 5.5)).toBe((296 + 356) / 2);
  });
});

describe("countOn: a count only speaks for the days it was read for", () => {
  const range = { from: "2026-10-05", to: "2026-10-11" };
  it("is the count inside the range, and 0 for a quiet day", () => {
    expect(countOn({ "2026-10-09": 28 }, range, "2026-10-09")).toBe(28);
    expect(countOn({ "2026-10-09": 28 }, range, "2026-10-10")).toBe(0);
  });
  it("is unknown outside the range and while nothing is loaded", () => {
    expect(countOn({ "2026-10-09": 28 }, range, "2026-10-12")).toBeNull();
    expect(countOn({ "2026-10-09": 28 }, range, "2026-10-04")).toBeNull();
    expect(countOn(null, range, "2026-10-09")).toBeNull();
  });
});

describe("covers", () => {
  it("holds a range that sits inside another, and no other", () => {
    const month = { from: "2026-09-28", to: "2026-11-01" };
    expect(covers(month, { from: "2026-10-19", to: "2026-10-25" })).toBe(true);
    expect(covers(month, month)).toBe(true);
    expect(covers(month, { from: "2026-10-26", to: "2026-11-01" })).toBe(true);
    expect(covers(month, { from: "2026-11-02", to: "2026-11-08" })).toBe(false);
    expect(covers({ from: "2026-10-05", to: "2026-10-11" }, month)).toBe(false);
  });
});
