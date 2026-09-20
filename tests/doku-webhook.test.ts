import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  record: vi.fn(),
  process: vi.fn(),
  after: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@catera/backend", () => ({
  verifyDokuNotification: mocks.verify,
  recordDokuPayment: mocks.record,
  processDokuInbox: mocks.process,
}));
import { POST } from "../apps/web/src/app/api/webhooks/doku/payment/route";
afterEach(() => vi.resetAllMocks());
const request = () =>
  new Request("https://sandbox.example/api/webhooks/doku/payment", {
    method: "POST",
    body: JSON.stringify({ order: { invoice_number: "test" } }),
  });
it("persists a verified callback before scheduling activation after acknowledgement", async () => {
  mocks.verify.mockReturnValue(true);
  mocks.record.mockResolvedValue(undefined);
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(mocks.record.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.after.mock.invocationCallOrder[0],
  );
  expect(mocks.process).not.toHaveBeenCalled();
  await mocks.after.mock.calls[0][0]();
  expect(mocks.process).toHaveBeenCalledOnce();
});
it("does not acknowledge a callback that could not be durably recorded", async () => {
  mocks.verify.mockReturnValue(true);
  mocks.record.mockRejectedValue(new Error("Database unavailable"));
  expect((await POST(request())).status).toBe(503);
  expect(mocks.after).not.toHaveBeenCalled();
});
it("rejects unsigned callbacks without writing or scheduling work", async () => {
  mocks.verify.mockReturnValue(false);
  expect((await POST(request())).status).toBe(401);
  expect(mocks.record).not.toHaveBeenCalled();
  expect(mocks.after).not.toHaveBeenCalled();
});
