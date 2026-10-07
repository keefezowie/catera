import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rpc: vi.fn(), after: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  after: state.after,
}));
vi.mock("../apps/web/src/lib/auth", () => ({
  session: async () => ({
    id: "synthetic-user",
    token: "synthetic-token",
    actor: { role: "owner", catererId: "10000000-0000-4000-8000-000000000001" },
  }),
  supabase: vi.fn(),
  demoToken: vi.fn(),
}));
vi.mock("@catera/backend", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  demoEnabled: () => false,
  rpc: state.rpc,
}));
import { dispatchPushes } from "../apps/web/src/lib/push-dispatch";
import { GET as pushJobs } from "../apps/web/src/app/api/jobs/push/route";

const systemCalls = () =>
  state.rpc.mock.calls
    .filter((c) => c[2] === "catera_v1_system")
    .map((c) => [c[3].action, c[3].payload]);
const job = { id: "job-1", payload: { userId: "u1", body: "Halo", href: "/today" } };
function system(handlers: Record<string, unknown>) {
  state.rpc.mockImplementation(async (_id, _token, _name, args) => {
    const handler = handlers[args.action];
    if (handler instanceof Error) throw handler;
    return typeof handler === "function" ? handler(args.payload) : handler;
  });
}
beforeEach(() => {
  vi.restoreAllMocks();
  state.rpc.mockReset();
  state.after.mockReset();
});

it("claims push jobs only, sends them and completes them", async () => {
  system({
    "outbox.claimPush": [job],
    "notification.eligible": true,
    devices: ["ExponentPushToken[a]"],
    "push.ticket": null,
    "outbox.complete": null,
  });
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ data: [{ status: "ok", id: "t1" }] }));
  expect(await dispatchPushes({ limit: 7 })).toEqual({ sent: 1 });
  expect(systemCalls()[0]).toEqual(["outbox.claimPush", { limit: 7 }]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual([
    {
      to: "ExponentPushToken[a]",
      title: "Catera",
      body: "Halo",
      collapseId: "job-1",
      data: { href: "/today", notificationId: "job-1" },
    },
  ]);
  expect(systemCalls()).toContainEqual(["push.ticket", { id: "t1", jobId: "job-1", token: "ExponentPushToken[a]" }]);
  expect(systemCalls()).toContainEqual(["outbox.complete", { id: "job-1" }]);
});

it("completes an ineligible push without sending, and retries a failed send", async () => {
  system({
    "outbox.claimPush": [job, { ...job, id: "job-2" }],
    "notification.eligible": (p: { id: string }) => p.id === "job-2",
    devices: ["ExponentPushToken[a]"],
    "outbox.complete": null,
    "outbox.retry": null,
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 503 }));
  expect(await dispatchPushes({ limit: 10 })).toEqual({ sent: 0 });
  expect(systemCalls()).toContainEqual(["outbox.complete", { id: "job-1" }]);
  expect(systemCalls()).toContainEqual(["outbox.retry", { id: "job-2", error: "PUSH_SEND_FAILED" }]);
});

it("removes unregistered devices", async () => {
  system({
    "outbox.claimPush": [job],
    "notification.eligible": true,
    devices: ["ExponentPushToken[gone]"],
    "device.remove": null,
    "outbox.complete": null,
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] }),
  );
  expect(await dispatchPushes({ limit: 10 })).toEqual({ sent: 1 });
  expect(systemCalls()).toContainEqual(["device.remove", { token: "ExponentPushToken[gone]" }]);
});

it("GET /api/jobs/push queues both reminders then sends", async () => {
  process.env.CRON_SECRET = "synthetic-cron-secret";
  system({
    "delivery.remindDue": { queued: 2 },
    "subscription.remindRenewal": { queued: 1 },
    "outbox.claimPush": [],
  });
  const response = await pushJobs(
    new Request("https://catera.test/api/jobs/push", {
      headers: { authorization: "Bearer synthetic-cron-secret" },
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ queued: 3, sent: 0 });
  const [due, renewal, claim] = systemCalls();
  expect(due[0]).toBe("delivery.remindDue");
  const now = new Date((due[1] as { now: string }).now);
  expect(Number.isNaN(now.valueOf())).toBe(false);
  expect(renewal[0]).toBe("subscription.remindRenewal");
  const jakarta = new Date(now.getTime() + 7 * 3600_000);
  expect(renewal[1]).toEqual({
    today: jakarta.toISOString().slice(0, 10),
    hour: jakarta.getUTCHours(),
  });
  // Claimed in small batches so the run can stop on its time budget.
  expect(claim).toEqual(["outbox.claimPush", { limit: 20 }]);
  delete process.env.CRON_SECRET;
});

// Each send moves the frozen clock on; only Date is faked so promises keep resolving.
function clockedQueue(perJobMs: number) {
  let next = 0;
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-07T03:00:00Z") });
  system({
    "outbox.claimPush": (p: { limit: number }) =>
      Array.from({ length: p.limit }, () => ({ ...job, id: "job-" + ++next })),
    "notification.eligible": true,
    devices: ["ExponentPushToken[a]"],
    "push.ticket": null,
    "outbox.complete": () => void vi.setSystemTime(Date.now() + perJobMs),
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    Response.json({ data: [{ status: "ok", id: "t" }] }),
  );
}

it("stops claiming and sending once the time budget is spent, leaving the rest leased", async () => {
  try {
    clockedQueue(1000);
    // 20 + 20 sends take 40 s; the third batch is claimed at 40 s and stopped at 45 s.
    expect(await dispatchPushes({ limit: 200, deadlineMs: 45_000 })).toEqual({ sent: 45 });
    const claims = systemCalls().filter(([action]) => action === "outbox.claimPush");
    expect(claims).toEqual([
      ["outbox.claimPush", { limit: 20 }],
      ["outbox.claimPush", { limit: 20 }],
      ["outbox.claimPush", { limit: 20 }],
    ]);
    // The 15 claimed but unsent jobs are not retried or completed: their lease hands them on.
    expect(systemCalls().filter(([action]) => action === "outbox.complete")).toHaveLength(45);
    expect(systemCalls().some(([action]) => action === "outbox.retry")).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it("keeps one claim of the whole limit without a time budget", async () => {
  try {
    clockedQueue(10_000);
    expect(await dispatchPushes({ limit: 7 })).toEqual({ sent: 7 });
    expect(systemCalls().filter(([action]) => action === "outbox.claimPush")).toEqual([
      ["outbox.claimPush", { limit: 7 }],
    ]);
  } finally {
    vi.useRealTimers();
  }
});

it("GET /api/jobs/push counts the reminder queries against its 45 s budget", async () => {
  process.env.CRON_SECRET = "synthetic-cron-secret";
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-07T03:00:00Z") });
  try {
    system({
      "delivery.remindDue": () => (vi.setSystemTime(Date.now() + 50_000), { queued: 0 }),
      "subscription.remindRenewal": { queued: 0 },
      "outbox.claimPush": [job],
    });
    const response = await pushJobs(
      new Request("https://catera.test/api/jobs/push", {
        headers: { authorization: "Bearer synthetic-cron-secret" },
      }),
    );
    expect(await response.json()).toEqual({ queued: 0, sent: 0 });
    // Nothing is claimed once the budget is gone; the next run picks the queue up.
    expect(systemCalls().map(([action]) => action)).toEqual([
      "delivery.remindDue",
      "subscription.remindRenewal",
    ]);
  } finally {
    vi.useRealTimers();
    delete process.env.CRON_SECRET;
  }
});

// The commands route, with an empty push queue so nothing reaches Expo.
const command = (action: string) =>
  new Request("https://catera.test/api/v1/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload: {}, requestId: crypto.randomUUID() }),
  });
const context = { params: Promise.resolve({ path: ["commands"] }) };

// Runs the callbacks the route handed to after(), the way the platform does once the response is sent.
const runAfter = async () => {
  for (const [callback] of state.after.mock.calls.splice(0)) await callback();
};

it("sends pushes after the response of a command that notifies the customer", async () => {
  const { POST } = await import("../apps/web/src/app/api/v1/[...path]/route");
  for (const action of ["delivery.depart", "customer.followup", "deliveryIssue.respond", "deliveryIssue.resolve"]) {
    state.rpc.mockReset();
    system({ [action]: { moved: 1 }, "outbox.claimPush": [] });
    const response = await POST(command(action), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { moved: 1 } });
    // Nothing but the command ran before the response; the push work is deferred.
    expect(state.rpc.mock.calls.map((c) => c[3].action)).toEqual([action]);
    expect(state.after).toHaveBeenCalledTimes(1);
    await runAfter();
    expect(state.rpc.mock.calls.map((c) => c[3].action)).toEqual([action, "outbox.claimPush"]);
    expect(state.rpc.mock.calls[1][3].payload).toEqual({ limit: 20 });
  }
});

it("returns the command response without waiting for a hanging push dispatch", async () => {
  const { POST } = await import("../apps/web/src/app/api/v1/[...path]/route");
  state.rpc.mockImplementation(async (_id, _token, _name, args) =>
    args.action === "outbox.claimPush" ? new Promise(() => {}) : { moved: 2 },
  );
  const response = await POST(command("delivery.depart"), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { moved: 2 } });
  expect(state.after).toHaveBeenCalledTimes(1);
  // The scheduled work is the only thing that can hang, and the platform owns it.
  const hanging = runAfter();
  const settled = await Promise.race([hanging.then(() => "done"), new Promise((r) => setTimeout(() => r("pending"), 50))]);
  expect(settled).toBe("pending");
});

it("never fails the command when the deferred push fails, and ignores other commands", async () => {
  const { POST } = await import("../apps/web/src/app/api/v1/[...path]/route");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  state.rpc.mockImplementation(async (_id, _token, name) => {
    if (name === "catera_v1_command") return { moved: 3 };
    throw new Error("DATABASE_DOWN");
  });
  const response = await POST(command("delivery.depart"), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: { moved: 3 } });
  await runAfter();
  expect(warn).toHaveBeenCalledOnce();
  state.rpc.mockClear();
  state.rpc.mockResolvedValue({ id: "x" });
  await POST(command("address.delete"), context);
  expect(state.after).not.toHaveBeenCalled();
  expect(state.rpc.mock.calls.map((c) => c[2])).toEqual(["catera_v1_command"]);
});

it("passes NOT_ALLOWED from a refused command to the app instead of REQUEST_FAILED", async () => {
  const { POST } = await import("../apps/web/src/app/api/v1/[...path]/route");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  state.rpc.mockRejectedValue(new Error("NOT_ALLOWED"));
  const response = await POST(command("delivery.confirm"), context);
  // A business refusal, answered like CUTOFF or INVALID_STATE.
  expect(response.status).toBe(400);
  expect((await response.json()).error.code).toBe("NOT_ALLOWED");
  expect(state.after).not.toHaveBeenCalled();
});
