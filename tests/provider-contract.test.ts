import { it, expect, vi, afterEach } from "vitest";
import {
  createPaymentSession,
  verifyCallback,
  createRefund,
  createPayout,
  assertEarnedCollection,
  payoutRequest,
  payoutEvent,
} from "../packages/backend/src/payments";
import { assertSameOrigin } from "../apps/web/src/lib/request-origin";
import type { Checkout } from "@catera/domain";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("same-origin writes use the browser host, without accepting a foreign site", () => {
  expect(() =>
    assertSameOrigin(
      new Request("http://localhost:3000/api/v1/quote", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
  ).not.toThrow();
  expect(() =>
    assertSameOrigin(
      new Request("https://catera.example/api/v1/quote", {
        headers: { host: "catera.example", origin: "https://foreign.example" },
      }),
    ),
  ).toThrow("FORBIDDEN");
  vi.stubEnv("CATERA_PUBLIC_URL", "https://catera.example");
  expect(() =>
    assertSameOrigin(
      new Request("http://localhost/api/v1/quote", {
        headers: { origin: "https://catera.example" },
      }),
    ),
  ).not.toThrow();
});
it("payment adapter preserves amount, deadline, idempotency and safe return IDs", async () => {
  vi.stubEnv("XENDIT_SECRET_KEY", "fictional-contract-key");
  vi.stubEnv("CATERA_PUBLIC_URL", "https://catera.example");
  const fetch = vi.fn().mockResolvedValue(
    Response.json({
      payment_session_id: "session-1",
      payment_link_url: "https://checkout.xendit.test/session-1",
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const c = {
    terms_accepted_at: new Date().toISOString(),
    terms_version: "purchase-2026-09-20",
    id: crypto.randomUUID(),
    expires_at: new Date(Date.now() + 900000).toISOString(),
    quote: {
      total: 132500,
      offer: { catererId: "caterer-1", name: "Paket sintetis" },
    },
  } as Checkout;
  expect(await createPaymentSession(c)).toEqual({
    providerId: "session-1",
    url: "https://checkout.xendit.test/session-1",
  });
  const [url, request] = fetch.mock.calls[0];
  const payload = JSON.parse(request.body);
  expect(url).toBe("https://api.xendit.co/sessions");
  expect(request.headers["idempotency-key"]).toBe(c.id);
  expect(payload).toMatchObject({
    amount: 132500,
    currency: "IDR",
    expires_at: c.expires_at,
    success_return_url: "https://catera.example/return/" + c.id,
  });
  await expect(
    createPaymentSession({
      ...c,
      expires_at: new Date(Date.now() + 300000).toISOString(),
    }),
  ).rejects.toThrow("PAYMENT_HOLD_TOO_SHORT");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("provider callbacks require the configured token and financial requests use provider IDs", async () => {
  vi.stubEnv("XENDIT_WEBHOOK_TOKEN", "fictional-token");
  expect(verifyCallback(null)).toBe(false);
  expect(verifyCallback("another-token")).toBe(false);
  expect(verifyCallback("fictional-token")).toBe(true);
  vi.stubEnv("XENDIT_SECRET_KEY", "fictional-key");
  const fetch = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(Response.json({ id: "refund-id" })),
    );
  vi.stubGlobal("fetch", fetch);
  await createRefund({
    id: "refund-1",
    amount: 10000,
    payment: { provider_id: "payment-request-1" },
  });
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    payment_request_id: "payment-request-1",
    amount: 10000,
    reference_id: "refund-1",
  });
  await expect(
    createPayout({ id: "payout-1", amount: 10000, caterer_id: "unknown" }),
  ).rejects.toThrow("PAYOUT_RECIPIENT_NOT_CONFIGURED");
});

it("earned settlement refuses seller split routing and retains the captured payout request on retry", async () => {
  vi.stubEnv("CATERA_CONTROLLED_COLLECTION", "false");
  expect(() => assertEarnedCollection("seller")).toThrow(
    "SETTLEMENT_NOT_CONFIGURED",
  );
  vi.stubEnv("CATERA_CONTROLLED_COLLECTION", "true");
  vi.stubEnv(
    "CATERA_XENDIT_ROUTING_JSON",
    JSON.stringify({ seller: { accountId: "synthetic-account" } }),
  );
  expect(() => assertEarnedCollection("seller")).toThrow(
    "SETTLEMENT_NOT_CONFIGURED",
  );
  vi.stubEnv("CATERA_XENDIT_ROUTING_JSON", "{}");
  expect(() => assertEarnedCollection("seller")).not.toThrow();
  const p = { id: "payout-synthetic", amount: 15000, caterer_id: "seller" };
  vi.stubEnv(
    "CATERA_PAYOUT_RECIPIENTS_JSON",
    JSON.stringify({
      seller: {
        recipient: {
          type: "BANK_ACCOUNT",
          account_details: { account_number: "synthetic" },
        },
        purposeCode: "OTHER",
        minimumAmount: 10000,
        maximumAmount: 20000,
      },
    }),
  );
  const request = payoutRequest(p);
  expect(() => payoutRequest({ ...p, amount: 25000 })).toThrow(
    "PAYOUT_CHANNEL_LIMIT",
  );
  vi.stubEnv("CATERA_PAYOUT_RECIPIENTS_JSON", "{}");
  vi.stubEnv("XENDIT_SECRET_KEY", "fictional-key");
  const fetch = vi
    .fn()
    .mockImplementation(async () =>
      Response.json({ payout_id: "po-synthetic", status: "ACCEPTED" }),
    );
  vi.stubGlobal("fetch", fetch);
  await createPayout({ ...p, recipient_request: request });
  await createPayout({ ...p, recipient_request: request });
  expect(fetch.mock.calls[0][0]).toBe("https://api.xendit.co/v3/payouts");
  expect(fetch.mock.calls[0][1].headers["idempotency-key"]).toBe(p.id);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(request);
  expect(
    payoutEvent(
      {
        reference_id: p.id,
        payout_id: "po-synthetic",
        source_amount: 15000,
        source_currency: "IDR",
        status: "REVERSED",
      },
      "event",
    ),
  ).toMatchObject({ id: p.id, status: "reversed", amount: 15000 });
  expect(() => payoutEvent({ status: "UNKNOWN" }, "event")).toThrow(
    "INVALID_STATE",
  );
});
