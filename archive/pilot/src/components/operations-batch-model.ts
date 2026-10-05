import type { Delivery, Production, Snapshot } from "@/lib/types";

export type BatchTarget = "ready" | "out_for_delivery";
export function latestProduction(s: Snapshot, d: Delivery) {
  return s.production
    .filter((p) => p.service_date === d.service_date && p.slot_id === d.slot_id)
    .reduce<(typeof s.production)[number] | undefined>(
      (latest, p) => (!latest || p.revision > latest.revision ? p : latest),
      undefined,
    );
}
export function batchBlocker(
  s: Snapshot,
  d: Delivery,
  target: BatchTarget,
): string | null {
  if (target === "out_for_delivery")
    return d.status === "ready" ? null : "batchNeedsReady";
  if (d.status !== "scheduled") return "batchNeedsScheduled";
  if (!d.menu_id) return "menuMissing";
  const version = latestProduction(s, d);
  if (!version) return "detailProductionNotFrozen";
  if (version.incomplete > 0) return "detailProductionIncomplete";
  if (!version.entries.some((e) => e.id === d.id))
    return "detailProductionMissingDelivery";
  return null;
}
export type BatchReviewRow = {
  delivery: Delivery;
  customer: string;
  slot: string;
  productionId?: string;
  revision?: number;
  blocker: string | null;
  requestId: string;
};
export function reviewBatch(
  s: Snapshot,
  ids: string[],
  target: BatchTarget,
): BatchReviewRow[] {
  return ids.flatMap((id) => {
    const delivery = s.deliveries.find((d) => d.id === id);
    if (!delivery) return [];
    const production = latestProduction(s, delivery);
    return [
      {
        delivery,
        customer:
          s.customers.find((c) => c.id === delivery.customer_id)?.name || "",
        slot: s.slots.find((slot) => slot.id === delivery.slot_id)?.name || "",
        productionId: production?.id,
        revision: production?.revision,
        blocker: batchBlocker(s, delivery, target),
        requestId: crypto.randomUUID(),
      },
    ];
  });
}
export function reviewIsStale(
  s: Snapshot,
  row: BatchReviewRow,
  target: BatchTarget,
) {
  const current = s.deliveries.find((d) => d.id === row.delivery.id);
  return (
    !current ||
    current.version !== row.delivery.version ||
    !!batchBlocker(s, current, target) ||
    (target === "ready" &&
      latestProduction(s, current)?.id !== row.productionId)
  );
}

export type BatchResult = {
  id: string;
  ok: boolean;
  code?: string;
  unknown?: boolean;
};
export function remainingBatchRows(
  rows: BatchReviewRow[],
  results: BatchResult[],
) {
  return rows.filter(
    (row) =>
      !row.blocker &&
      !results.some((result) => result.id === row.delivery.id && result.ok),
  );
}

/** Only the latest complete frozen version can supply a readiness handoff. */
export function productionReadyIds(
  s: Snapshot,
  production: Production,
): string[] {
  if (production.incomplete) return [];
  return s.deliveries
    .filter(
      (d) =>
        d.service_date === production.service_date &&
        d.slot_id === production.slot_id &&
        latestProduction(s, d)?.id === production.id &&
        !batchBlocker(s, d, "ready"),
    )
    .map((d) => d.id);
}

export function dailyGuidance(s: Snapshot, active: Delivery[]) {
  const failed = active.filter((d) => d.status === "failed").length;
  const scheduled = active.filter((d) => d.status === "scheduled");
  const missing = scheduled.filter((d) => !d.menu_id).length;
  const readyIds = scheduled
    .filter((d) => !batchBlocker(s, d, "ready"))
    .map((d) => d.id);
  const blocked = scheduled.filter(
    (d) => !!d.menu_id && !!batchBlocker(s, d, "ready"),
  );
  const incomplete = scheduled.filter((d) => {
    const production = latestProduction(s, d);
    return (
      production &&
      (production.incomplete > 0 ||
        !production.entries.some((entry) => entry.id === d.id))
    );
  }).length;
  const dispatchIds = active
    .filter((d) => d.status === "ready")
    .map((d) => d.id);
  const inTransit = active.filter(
    (d) => d.status === "out_for_delivery",
  ).length;
  const task = failed
    ? "taskFailed"
    : incomplete
      ? "taskProductionIncomplete"
      : missing
        ? "taskMenus"
        : blocked.length
          ? "taskProduction"
          : readyIds.length
            ? "taskReadyReview"
            : dispatchIds.length
              ? "taskDispatchReview"
              : inTransit
                ? "taskDelivery"
                : "taskComplete";
  const stage = failed
    ? "delivery"
    : incomplete
      ? "production"
      : missing
        ? "schedule"
        : blocked.length
          ? "production"
          : "delivery";
  const count =
    failed ||
    incomplete ||
    missing ||
    blocked.length ||
    readyIds.length ||
    dispatchIds.length ||
    inTransit;
  return {
    task,
    stage,
    count,
    readyIds,
    dispatchIds,
    failed,
    missing,
    blocked: scheduled.length - readyIds.length,
  };
}
