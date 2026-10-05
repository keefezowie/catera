import { describe, expect, it } from "vitest";
import type { Delivery, Production, Snapshot } from "../src/lib/types";
import {
  batchBlocker,
  reviewBatch,
  reviewIsStale,
  remainingBatchRows,
  productionReadyIds,
  dailyGuidance,
} from "../src/components/operations-batch-model";

const delivery: Delivery = {
  id: "delivery-1",
  customer_id: "customer-1",
  grant_id: "grant-1",
  pattern_id: null,
  service_date: "2026-10-05",
  slot_id: "lunch",
  menu_id: "menu-1",
  menu_name: "Nasi sayur",
  selection_source: "selected",
  address: { line: "Jl. Data Sintetis 1", city: "Jakarta" },
  cutoff_at: "2026-10-04T14:00:00Z",
  status: "scheduled",
  version: 3,
  delivered_at: null,
};
const production: Production = {
  id: "production-1",
  service_date: delivery.service_date,
  slot_id: delivery.slot_id,
  revision: 1,
  entries: [
    {
      id: delivery.id,
      customer_id: delivery.customer_id,
      customer: "Pelanggan sintetis",
      menu_id: delivery.menu_id,
      menu: delivery.menu_name,
      address: delivery.address,
    },
  ],
  changes: [],
  incomplete: 0,
  reason: "cutoff",
  created_at: delivery.cutoff_at,
};
function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    role: "owner",
    customer_id: null,
    now: "2026-10-05T04:00:00Z",
    business: {
      id: "business-1",
      slug: "synthetic",
      name: "Dapur sintetis",
      version: 1,
      cutoff: "21:00",
      timezone: "Asia/Jakarta",
    },
    deliveries: [delivery],
    production: [production],
    customers: [
      {
        id: delivery.customer_id,
        name: "Pelanggan sintetis",
        email: "synthetic@example.test",
        phone: "",
        address: delivery.address,
        version: 1,
        user_id: null,
      },
    ],
    slots: [
      {
        id: delivery.slot_id,
        name: "Siang",
        start_time: "12:00",
        active: true,
      },
    ],
    patterns: [],
    grants: [],
    purchases: [],
    ledger: [],
    events: [],
    packages: [],
    menus: [],
    offerings: [],
    exceptions: [],
    invitations: [],
    memberships: [],
    ...overrides,
  };
}

describe("safe owner batch planning", () => {
  it("requires the latest frozen version to be complete and include the delivery", () => {
    expect(batchBlocker(snapshot(), delivery, "ready")).toBeNull();
    expect(batchBlocker(snapshot({ production: [] }), delivery, "ready")).toBe(
      "detailProductionNotFrozen",
    );
    const latest = {
      ...production,
      id: "production-2",
      revision: 2,
      incomplete: 1,
    };
    expect(
      batchBlocker(
        snapshot({ production: [production, latest] }),
        delivery,
        "ready",
      ),
    ).toBe("detailProductionIncomplete");
    expect(
      batchBlocker(
        snapshot({
          production: [production, { ...latest, incomplete: 0, entries: [] }],
        }),
        delivery,
        "ready",
      ),
    ).toBe("detailProductionMissingDelivery");
    expect(
      batchBlocker(snapshot(), { ...delivery, menu_id: null }, "ready"),
    ).toBe("menuMissing");
  });
  it("dispatches only ready deliveries and excludes failed, terminal, or already dispatched records", () => {
    expect(
      batchBlocker(
        snapshot(),
        { ...delivery, status: "ready" },
        "out_for_delivery",
      ),
    ).toBeNull();
    for (const status of [
      "scheduled",
      "failed",
      "delivered",
      "cancelled",
      "out_for_delivery",
    ]) {
      expect(
        batchBlocker(snapshot(), { ...delivery, status }, "out_for_delivery"),
      ).toBe("batchNeedsReady");
    }
  });
  it("freezes reviewed identities and blocks new delivery or production versions", () => {
    const [row] = reviewBatch(snapshot(), [delivery.id], "ready");
    expect(row.customer).toBe("Pelanggan sintetis");
    expect(row.productionId).toBe(production.id);
    expect(reviewIsStale(snapshot(), row, "ready")).toBe(false);
    expect(
      reviewIsStale(
        snapshot({ deliveries: [{ ...delivery, version: 4 }] }),
        row,
        "ready",
      ),
    ).toBe(true);
    expect(
      reviewIsStale(
        snapshot({
          production: [{ ...production, id: "production-2", revision: 2 }],
        }),
        row,
        "ready",
      ),
    ).toBe(true);
    expect(reviewIsStale(snapshot({ deliveries: [] }), row, "ready")).toBe(
      true,
    );
  });
  it("keeps only failed eligible records for retries with their original request keys", () => {
    const failed = { ...delivery, id: "delivery-2" };
    const excluded = { ...delivery, id: "delivery-3", status: "delivered" };
    const s = snapshot({
      deliveries: [delivery, failed, excluded],
      production: [
        {
          ...production,
          entries: [
            ...production.entries,
            { ...production.entries[0], id: failed.id },
          ],
        },
      ],
    });
    const rows = reviewBatch(s, [delivery.id, failed.id, excluded.id], "ready");
    const remaining = remainingBatchRows(rows, [
      { id: delivery.id, ok: true },
      { id: failed.id, ok: false, code: "SAVE_FAILED" },
    ]);
    expect(remaining.map((r) => r.delivery.id)).toEqual([failed.id]);
    expect(remaining[0].requestId).toBe(rows[1].requestId);
    expect(rows[2].blocker).toBe("batchNeedsScheduled");
  });
});

describe("frozen production handoffs", () => {
  it("offers readiness from the latest complete production and preserves its exact ID", () => {
    const s = snapshot();
    expect(productionReadyIds(s, production)).toEqual([delivery.id]);
    const guidance = dailyGuidance(s, [delivery]);
    expect(guidance.task).toBe("taskReadyReview");
    expect(guidance.readyIds).toEqual([delivery.id]);
    const rows = reviewBatch(s, guidance.readyIds, "ready");
    expect(rows[0].productionId).toBe(production.id);
  });
  it("keeps incomplete/missing production as prerequisites and excludes older revisions", () => {
    expect(dailyGuidance(snapshot({ production: [] }), [delivery]).task).toBe(
      "taskProduction",
    );
    expect(
      dailyGuidance(
        snapshot({ production: [{ ...production, incomplete: 1 }] }),
        [delivery],
      ).task,
    ).toBe("taskProductionIncomplete");
    const missing = { ...delivery, menu_id: null, menu_name: null };
    expect(
      dailyGuidance(snapshot({ production: [], deliveries: [missing] }), [
        missing,
      ]).task,
    ).toBe("taskMenus");
    expect(
      dailyGuidance(
        snapshot({
          production: [{ ...production, incomplete: 1 }],
          deliveries: [missing],
        }),
        [missing],
      ).task,
    ).toBe("taskProductionIncomplete");
    const latest = { ...production, id: "production-2", revision: 2 };
    const s = snapshot({ production: [production, latest] });
    expect(productionReadyIds(s, production)).toEqual([]);
    expect(productionReadyIds(s, latest)).toEqual([delivery.id]);
  });
  it("hands Ready records to reviewed dispatch and keeps completion individual", () => {
    const ready = { ...delivery, status: "ready" };
    const s = snapshot({ deliveries: [ready] });
    expect(dailyGuidance(s, [ready]).task).toBe("taskDispatchReview");
    expect(dailyGuidance(s, [ready]).dispatchIds).toEqual([ready.id]);
    const inTransit = { ...delivery, status: "out_for_delivery" };
    expect(
      dailyGuidance(snapshot({ deliveries: [inTransit] }), [inTransit]).task,
    ).toBe("taskDelivery");
    const delivered = { ...delivery, status: "delivered" };
    expect(
      dailyGuidance(snapshot({ deliveries: [delivered] }), [delivered]).task,
    ).toBe("taskComplete");
  });
});
