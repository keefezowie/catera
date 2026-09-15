import { describe, it, expect, vi } from "vitest";
import {
  readSettlementResource,
  readSettlementReporting,
} from "../apps/web/src/lib/settlement-read";
import type { Actor } from "@catera/domain";
const owner: Actor = {
  id: "owner",
  role: "owner",
  name: "Synthetic owner",
  catererId: "seller",
};
describe("settlement rollout compatibility", () => {
  it("returns an explicit unavailable state for the older dispatcher, not a zero balance", async () => {
    const read = vi.fn().mockRejectedValue(new Error("NOT_FOUND"));
    expect(
      await readSettlementResource(owner, "seller-settlement", "seller", read),
    ).toEqual({ unavailable: true, reason: "not_installed" });
  });
  it("returns the installed ledger unchanged", async () => {
    const state = { available: "0", earned: "0", policy: null };
    expect(
      await readSettlementResource(
        owner,
        "seller-settlement",
        "seller",
        async () => state,
      ),
    ).toBe(state);
  });
  it.each([
    "FORBIDDEN",
    "UNAUTHORIZED",
    "NOT_CONFIGURED",
    "connection failed",
    "NOT_FOUND: damaged record",
  ])("does not mask %s", async (message) => {
    await expect(
      readSettlementResource(owner, "seller-settlement", "seller", async () => {
        throw new Error(message);
      }),
    ).rejects.toThrow(message);
  });
  it.each([
    null,
    { ...owner, role: "customer" as const },
    { ...owner, role: "staff" as const },
    { ...owner, catererId: "other" },
  ])("checks tenant and owner authorization before fallback", async (actor) => {
    const read = vi.fn();
    await expect(
      readSettlementResource(actor, "seller-settlement", "seller", read),
    ).rejects.toThrow(actor ? "FORBIDDEN" : "UNAUTHORIZED");
    expect(read).not.toHaveBeenCalled();
  });
  it("restricts rollout controls to administrators, including the older schema", async () => {
    const read = vi.fn().mockRejectedValue(new Error("NOT_FOUND"));
    await expect(
      readSettlementResource(owner, "settlement-controls", undefined, read),
    ).rejects.toThrow("FORBIDDEN");
    expect(
      await readSettlementResource(
        { ...owner, role: "platform_admin" },
        "settlement-controls",
        undefined,
        read,
      ),
    ).toEqual({ unavailable: true, reason: "not_installed" });
  });
});

// Capability probing must not reinterpret a missing payout as a missing migration.
describe("reporting capability detection", () => {
  it("returns an explicit unavailable response for an older overview", async () => {
    const read = vi.fn();
    expect(
      await readSettlementReporting(
        owner,
        "seller",
        async () => ({ available: "0" }) as any,
        read,
      ),
    ).toEqual({ unavailable: true, reason: "reporting_not_installed" });
    expect(read).not.toHaveBeenCalled();
  });
  it("preserves a genuine missing payout", async () => {
    await expect(
      readSettlementReporting(
        owner,
        "seller",
        async () => ({ reportingVersion: 1 }) as any,
        async () => {
          throw new Error("NOT_FOUND");
        },
      ),
    ).rejects.toThrow("NOT_FOUND");
  });
  it("checks authorization before probing reporting", async () => {
    const overview = vi.fn();
    await expect(
      readSettlementReporting(
        { ...owner, catererId: "another" },
        "seller",
        overview,
        vi.fn(),
      ),
    ).rejects.toThrow("FORBIDDEN");
    expect(overview).not.toHaveBeenCalled();
  });
});
