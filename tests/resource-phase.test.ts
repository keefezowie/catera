import { describe, expect, it } from "vitest";
import { resourcePhase } from "@catera/domain";

describe("resource phases", () => {
  it("distinguishes first load, retained refresh, and stale-data failure", () => {
    expect(resourcePhase({ hasData: false, loading: true })).toBe(
      "initial_loading",
    );
    expect(resourcePhase({ hasData: true, loading: true })).toBe("refreshing");
    expect(resourcePhase({ hasData: true, error: true })).toBe("stale_error");
    expect(resourcePhase({ hasData: false, error: true })).toBe(
      "recoverable_error",
    );
  });

  it("separates empty filters and action outcomes", () => {
    expect(resourcePhase({ hasData: true, empty: true })).toBe("empty");
    expect(resourcePhase({ hasData: true, empty: true, filtered: true })).toBe(
      "filtered_empty",
    );
    expect(resourcePhase({ hasData: true, actionPending: true })).toBe(
      "action_pending",
    );
    expect(resourcePhase({ hasData: true, conflict: true })).toBe("conflict");
    expect(resourcePhase({ hasData: true, terminal: true })).toBe("terminal");
    expect(resourcePhase({ hasData: true })).toBe("ready");
  });
});
