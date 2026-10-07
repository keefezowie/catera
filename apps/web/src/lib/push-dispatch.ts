import { rpc } from "@catera/backend";

const system = <T = unknown>(action: string, payload: unknown = {}) =>
  rpc<T>(null, null, "catera_v1_system", { action, payload }, true);
export const pushHeaders = () => ({
  "Content-Type": "application/json",
  ...(process.env.EXPO_ACCESS_TOKEN
    ? { Authorization: "Bearer " + process.env.EXPO_ACCESS_TOKEN }
    : {}),
});
type PushJob = { id: string; payload: Record<string, string> };

/** Jobs claimed at a time when the run has a time budget. */
const BUDGET_BATCH = 20;

/**
 * Claims due push jobs and sends them through Expo. The claim leases each job for
 * five minutes, so the timed worker, the daily job and an immediate dispatch after
 * a command never send the same push twice.
 *
 * With `deadlineMs`, jobs are claimed in batches of 20 and the run stops claiming and
 * sending once that many milliseconds have passed, well inside the platform's limit: a
 * job sent but never completed would be sent again once its lease ran out. Jobs claimed
 * but not yet sent stay leased and go out on a later run.
 */
export async function dispatchPushes(options: {
  limit: number;
  deadlineMs?: number;
}): Promise<{ sent: number }> {
  const started = Date.now();
  const budgeted = options.deadlineMs !== undefined;
  const spent = () => budgeted && Date.now() - started >= options.deadlineMs!;
  const size = budgeted ? Math.min(BUDGET_BATCH, options.limit) : options.limit;
  let claimed = 0;
  let sent = 0;
  while (claimed < options.limit && !spent()) {
    const ask = Math.min(size, options.limit - claimed);
    const jobs = await system<PushJob[]>("outbox.claimPush", { limit: ask });
    claimed += jobs.length;
    for (const job of jobs) {
      if (spent()) break;
      if (await sendJob(job)) sent++;
    }
    if (jobs.length < ask) break;
  }
  return { sent };
}

/** Sends one job to every device of its user; true once it is completed as sent. */
async function sendJob(job: PushJob): Promise<boolean> {
  try {
    if (!(await system<boolean>("notification.eligible", { id: job.id }))) {
      await system("outbox.complete", { id: job.id });
      return false;
    }
    const tokens = await system<string[]>("devices", {
      userId: job.payload.userId,
    });
    for (let offset = 0; offset < tokens.length; offset += 100) {
      const batch = tokens.slice(offset, offset + 100);
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: pushHeaders(),
        body: JSON.stringify(
          batch.map((to) => ({
            to,
            title: "Catera",
            body: job.payload.body,
            collapseId: job.id,
            data: { href: job.payload.href, notificationId: job.id },
          })),
        ),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("PUSH_SEND_FAILED");
      const result = await response.json();
      for (const [i, ticket] of (result.data || []).entries()) {
        if (ticket.status === "ok")
          await system("push.ticket", {
            id: ticket.id,
            jobId: job.id,
            token: batch[i],
          });
        else if (ticket.details?.error === "DeviceNotRegistered")
          await system("device.remove", { token: batch[i] });
        else throw new Error("PUSH_TICKET_FAILED");
      }
    }
    await system("outbox.complete", { id: job.id });
    return true;
  } catch (error) {
    await system("outbox.retry", {
      id: job.id,
      error: error instanceof Error ? error.message : "JOB_FAILED",
    });
    return false;
  }
}
