import { router } from "expo-router";
import { HANDOFF_WAIT_MS, pushAfterClose, sheetGone } from "../src/today/handoff";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  sheetGone();
  jest.useRealTimers();
});

describe("the hand-off from a tab sheet to a root-stack sheet", () => {
  it("closes the sheet first and pushes only once the sheet has gone", () => {
    pushAfterClose("/pindah-tanggal/d-1?meal=lunch&date=2026-10-08");
    expect(router.back).toHaveBeenCalledTimes(1);
    // Still dismissing: nothing is pushed, however long the platform takes within the wait.
    jest.advanceTimersByTime(HANDOFF_WAIT_MS - 1);
    expect(router.push).not.toHaveBeenCalled();
    sheetGone();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/pindah-tanggal/d-1?meal=lunch&date=2026-10-08");
    // One-shot: the timer and a second report change nothing.
    sheetGone();
    jest.advanceTimersByTime(HANDOFF_WAIT_MS * 2);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("opens anyway after the wait when the sheet never reports", () => {
    pushAfterClose("/pindah-tanggal/d-2");
    jest.advanceTimersByTime(HANDOFF_WAIT_MS);
    expect(router.push).toHaveBeenCalledWith("/pindah-tanggal/d-2");
    sheetGone();
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("a newer hand-off replaces the one still waiting", () => {
    pushAfterClose("/pindah-tanggal/d-1");
    pushAfterClose("/pindah-tanggal/d-3");
    sheetGone();
    jest.advanceTimersByTime(HANDOFF_WAIT_MS);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/pindah-tanggal/d-3");
  });
});
