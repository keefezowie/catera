import {
  submitEarnedPayout,
  reconcileEarnedPayouts,
} from "@/lib/settlement-jobs";
import { stagingBucket, uploadStorage } from "@/lib/food-upload";
import {
  rpc,
  demoEnabled,
  createPaymentSession,
  attachPayment,
  reconcileDoku,
  createRefund,
  createPayout,
} from "@catera/backend";
import { jakartaDay, type Checkout } from "@catera/domain";
import { dispatchPushes, pushHeaders } from "@/lib/push-dispatch";
export const maxDuration = 300;
const system = <T = unknown>(action: string, payload: unknown = {}) =>
  rpc<T>(null, null, "catera_v1_system", { action, payload }, true);
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== "Bearer " + process.env.CRON_SECRET
  )
    return new Response("Unauthorized", { status: 401 });
  await system("maintenance");
  if (!demoEnabled()) {
    try {
      const expired = await system<string[]>("upload.expired");
      if (expired.length) {
        const { error } = await uploadStorage()
          .storage.from(stagingBucket)
          .remove(expired);
        if (error) console.warn("Staged food upload cleanup failed");
      }
    } catch {
      console.warn("Staged food upload cleanup unavailable");
    }
  }
  // Deliveries count as done unless reported; earnings follow before settlement.
  await system("delivery.autoDeliver", { today: jakartaDay(new Date()) });
  await system("settlement.run");
  const reconciliation = await reconcileEarnedPayouts();
  const dokuReconciliation = demoEnabled() ? null : await reconcileDoku();
  const jobs =
    await system<
      { id: string; kind: string; payload: Record<string, string> }[]
    >("outbox.claim");
  let done = 0;
  for (const job of jobs) {
    try {
      if (job.kind === "payment.create") {
        if (!demoEnabled()) {
          const c = await system<Checkout>("payment.lookup", {
            id: job.payload.checkoutId,
          });
          if (c.state === "pending" && c.payment_mode !== "direct" && !c.payment_url) {
            const data = await createPaymentSession(c);
            await attachPayment(c, data);
          }
        }
      } else if (job.kind === "refund.create") {
        const r = await system<{
          id: string;
          amount: number;
          state: string;
          payment: { provider_id: string };
          provider?: string | null;
        }>("refund.lookup", { id: job.payload.refundId });
        if (r.state === "requested") {
          const data = demoEnabled()
            ? { id: "demo-" + r.id, status: "SUCCEEDED" }
            : await createRefund(r);
          if (data.status !== "NEEDS_ATTENTION")
            await system("refund.update", {
              id: r.id,
              providerId: data.id,
              state:
                data.status === "SUCCEEDED"
                  ? "succeeded"
                  : data.status === "FAILED"
                    ? "failed"
                    : "pending",
            });
        }
      } else if (job.kind === "payout.create") {
        const p = await system<{
          id: string;
          amount: number;
          caterer_id: string;
          status: string;
          settlement_run_id: string | null;
          provider_id: string | null;
          recipient_request: Record<string, unknown> | null;
        }>("payout.lookup", { id: job.payload.payoutId });
        if (p.settlement_run_id) {
          await submitEarnedPayout(p);
        } else if (p.status === "approved") {
          const data = demoEnabled()
            ? { payout_id: "demo-" + p.id, status: "ACCEPTED" }
            : await createPayout(p);
          await system("payout.update", {
            id: p.id,
            providerId: data.payout_id,
            status: "pending",
          });
        }
      } else if (job.kind === "push") continue; // Pushes are sent by dispatchPushes; never complete one unsent.
      else if (job.kind === "split.reconcile") continue; // Remains visible until an explicit admin reconciliation.
      await system("outbox.complete", { id: job.id });
      done++;
    } catch (error) {
      await system("outbox.retry", {
        id: job.id,
        error: error instanceof Error ? error.message : "JOB_FAILED",
      });
    }
  }
  // Pushes have their own claim; the timed worker (/api/jobs/push) sends them as well.
  try {
    done += (await dispatchPushes({ limit: 100 })).sent;
  } catch {
    console.warn("Push dispatch unavailable; the timed push worker retries");
  }
  const tickets =
    await system<{ id: string; token: string }[]>("push.receipts");
  if (tickets.length) {
    const response = await fetch(
      "https://exp.host/--/api/v2/push/getReceipts",
      {
        method: "POST",
        headers: pushHeaders(),
        body: JSON.stringify({ ids: tickets.map((t) => t.id) }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.ok) {
      const result = await response.json();
      for (const [id, receipt] of Object.entries(result.data || {})) {
        const r = receipt as { status: string; details?: { error: string } };
        await system("push.checked", {
          id,
          remove: r.details?.error === "DeviceNotRegistered",
        });
      }
    }
  }
  return Response.json({
    processed: done,
    reconciliation,
    dokuReconciliation,
    health: await system("health"),
  });
}
