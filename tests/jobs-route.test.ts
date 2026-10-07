import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@catera/backend", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  demoEnabled: () => true,
  rpc: state.rpc,
}));
vi.mock("../apps/web/src/lib/settlement-jobs", () => ({
  submitEarnedPayout: vi.fn(),
  reconcileEarnedPayouts: async () => null,
}));
import { GET } from "../apps/web/src/app/api/jobs/route";

const calls = () => state.rpc.mock.calls.map((c) => [c[3].action, c[3].payload]);
function system(handlers: Record<string, unknown>) {
  state.rpc.mockImplementation(async (_id, _token, _name, args) => {
    const handler = handlers[args.action];
    if (handler instanceof Error) throw handler;
    return handler;
  });
}
const request = () =>
  new Request("https://catera.test/api/jobs", { headers: { authorization: "Bearer synthetic-cron-secret" } });
beforeEach(() => {
  vi.restoreAllMocks();
  state.rpc.mockReset();
  process.env.CRON_SECRET = "synthetic-cron-secret";
});

it("never completes or retries a push row that an older database hands to the generic claim", async () => {
  system({
    "outbox.claim": [{ id: "push-1", kind: "push", payload: { userId: "u", body: "x", href: "/" } }],
    "outbox.claimPush": [],
    "push.receipts": [],
    health: { failedJobs: 0 },
  });
  const response = await GET(request());
  expect(response.status).toBe(200);
  const actions = calls().map(([a]) => a);
  expect(actions).not.toContain("outbox.complete");
  expect(actions).not.toContain("outbox.retry");
});

it("still returns the health payload when push dispatch fails", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  system({
    "outbox.claim": [],
    "outbox.claimPush": new Error("DATABASE_DOWN"),
    "push.receipts": [],
    health: { failedJobs: 0 },
  });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ health: { failedJobs: 0 }, processed: 0 });
  expect(calls().map(([a]) => a)).toContain("push.receipts");
  expect(warn).toHaveBeenCalled();
});
