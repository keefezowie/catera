import {
  createPayout,
  payoutRequest,
  payoutEvent,
  lookupPayout,
  rpc,
  demoEnabled,
} from "@catera/backend";
type Payout = {
  id: string;
  amount: number;
  caterer_id: string;
  provider_id: string | null;
  status: string;
  settlement_run_id: string | null;
  recipient_request: Record<string, unknown> | null;
};
const system = <T = unknown>(action: string, payload: unknown = {}) =>
  rpc<T>(null, null, "catera_v1_system", { action, payload }, true);
export async function submitEarnedPayout(p: Payout) {
  if (!["approved", "submitting"].includes(p.status)) return;
  const request =
    p.recipient_request ??
    (demoEnabled()
      ? {
          reference_id: p.id,
          payout_details: { source_amount: p.amount },
          recipient: { synthetic: true },
        }
      : payoutRequest(p));
  const ready = await system<Payout | null>("payout.prepare", {
    id: p.id,
    request,
  });
  if (!ready) return;
  const data = demoEnabled()
    ? {
        reference_id: p.id,
        payout_id: "po-demo-" + p.id,
        source_amount: p.amount,
        source_currency: "IDR",
        status: "SUCCEEDED",
      }
    : await createPayout(ready);
  await system(
    "payout.event",
    payoutEvent(
      {
        ...data,
        reference_id: p.id,
        source_amount: data.source_amount ?? p.amount,
        source_currency: data.source_currency ?? "IDR",
      },
      "create:" + p.id + ":" + data.status + ":" + (data.updated ?? ""),
    ),
  );
}
export async function reconcileEarnedPayouts() {
  if (demoEnabled()) return;
  const pending = await system<Payout[]>("settlement.pending");
  let failures = 0;
  for (const p of pending) {
    if (!p.provider_id) continue;
    try {
      const data = await lookupPayout(p.provider_id);
      if (
        data.reference_id !== p.id ||
        data.business_id !== process.env.XENDIT_BUSINESS_ID
      )
        throw new Error("PAYOUT_MISMATCH");
      await system(
        "payout.event",
        payoutEvent(
          data,
          "lookup:" + p.id + ":" + data.status + ":" + data.updated,
        ),
      );
    } catch {
      failures++; /* Reserved funds remain unavailable until provider verification succeeds. */
    }
  }
  return { checked: pending.length, failures };
}
