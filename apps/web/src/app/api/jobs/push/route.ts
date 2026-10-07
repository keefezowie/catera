import { rpc } from "@catera/backend";
import { dispatchPushes } from "@/lib/push-dispatch";
import { jakartaDay } from "@catera/domain";
export const maxDuration = 60;
/** Stop sending well before maxDuration: a push sent but not completed is sent again after its lease. */
const BUDGET_MS = 45_000;
const system = <T = unknown>(action: string, payload: unknown = {}) =>
  rpc<T>(null, null, "catera_v1_system", { action, payload }, true);
// Hour of the day in Asia/Jakarta (UTC+7, no daylight saving).
const jakartaHour = (now: Date) => (now.getUTCHours() + 7) % 24;

/** Every fifteen minutes: queue the timed reminders, then send what is due. */
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== "Bearer " + process.env.CRON_SECRET
  )
    return new Response("Unauthorized", { status: 401 });
  const now = new Date();
  const started = Date.now();
  const arrival = await system<{ queued: number }>("delivery.remindDue", {
    now: now.toISOString(),
  });
  const renewal = await system<{ queued: number }>(
    "subscription.remindRenewal",
    { today: jakartaDay(now), hour: jakartaHour(now) },
  );
  const { sent } = await dispatchPushes({
    limit: 200,
    deadlineMs: Math.max(0, BUDGET_MS - (Date.now() - started)),
  });
  return Response.json({ queued: arrival.queued + renewal.queued, sent });
}
