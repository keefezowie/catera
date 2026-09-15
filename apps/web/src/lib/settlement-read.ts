import type { Actor, SettlementUnavailable } from "@catera/domain";
import type {
  SettlementResponse,
  SettlementReportingUnavailable,
} from "@catera/domain";

/** Probe the overview capability first: a missing payout must remain NOT_FOUND. */
export async function readSettlementReporting<T>(
  actor: Actor | null,
  catererId: string,
  overview: () => Promise<SettlementResponse>,
  read: () => Promise<T>,
): Promise<T | SettlementReportingUnavailable> {
  const state = await readSettlementResource(
    actor,
    "seller-settlement",
    catererId,
    overview,
  );
  if ("unavailable" in state || !state.reportingVersion)
    return { unavailable: true, reason: "reporting_not_installed" };
  return read();
}

/** Older V1 read dispatchers reject these resources before the settlement migration.
 * Never reinterpret errors from purchases, authorization, or other resources.
 */
export async function readSettlementResource<T>(
  actor: Actor | null,
  resource: "seller-settlement" | "settlement-controls",
  catererId: string | undefined,
  read: () => Promise<T>,
): Promise<T | SettlementUnavailable> {
  if (!actor) throw new Error("UNAUTHORIZED");
  if (
    actor.role !== "platform_admin" &&
    (resource === "settlement-controls" ||
      actor.role !== "owner" ||
      !catererId ||
      actor.catererId !== catererId)
  )
    throw new Error("FORBIDDEN");
  try {
    return await read();
  } catch (error) {
    // Installed settlement reads return an object even with no earnings/policy.
    // NOT_FOUND is the older dispatcher's unsupported-resource response.
    if (error instanceof Error && error.message === "NOT_FOUND")
      return { unavailable: true, reason: "not_installed" };
    throw error;
  }
}
