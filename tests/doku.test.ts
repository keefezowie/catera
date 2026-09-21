import { beforeAll, afterAll, afterEach, it, expect, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  ADDRESS_ID as A,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout } from "@catera/domain";
import {
  checkoutBody,
  checkoutResult,
  dokuInvoice,
  dokuPaymentEvent,
  nonSnapSignature,
  verifyDokuNotification,
  refundBlocker,
  dokuConfig,
  dokuSnap,
} from "../packages/backend/src/doku";
import {
  createPaymentSession,
  recordDokuPayment,
  processDokuInbox,
  createRefund,
  validateInquiry,
  type System,
} from "../packages/backend/src/payment-provider";
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const sys: System = (action, payload = {}) =>
  localRpc(db, null, "catera_v1_system", [action, payload], true);
const cmd = (action: string, payload: unknown) =>
  localRpc<Checkout>(db, U.customer, "catera_v1_command", [
    action,
    payload,
    crypto.randomUUID(),
  ]);
const config = {
  provider: "doku",
  environment: "sandbox",
  merchant: "MCH-test",
  reason: "Synthetic integration test",
};
let sequence = 2;
const checkout = () =>
  cmd("checkout.create", { acceptedTerms: true, ...({
    packageId: P[0],
    addressId: A,
    portions: 1,
    startDate: addDays(localDay(), sequence++ * 30),
    trial: false,
  }) });
function env() {
  vi.stubEnv("DOKU_ENVIRONMENT", "sandbox");
  vi.stubEnv("DOKU_CLIENT_ID", "MCH-test");
  vi.stubEnv("DOKU_SECRET_KEY", "synthetic-secret");
  vi.stubEnv("DOKU_COLLECTION_ENABLED", "true");
  vi.stubEnv("DOKU_ROUTING_VERIFIED", "true");
  vi.stubEnv("CATERA_CONTROLLED_COLLECTION", "true");
  vi.stubEnv("CATERA_PUBLIC_URL", "https://catera.example");
  vi.stubEnv("DOKU_COLLECTION_PROFILE_ID", "SAC-1234-1234567890123");
}
beforeAll(async () => {
  db = await createDemoDatabase(true);
  await sys("provider.configure", config);
});
afterAll(async () => {
  await db?.close();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("uses second-precision timestamps accepted by the live DOKU SNAP gateway", async () => {
  env();
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  vi.stubEnv(
    "DOKU_PRIVATE_KEY",
    keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  );
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          responseCode: "2007300",
          accessToken: "synthetic-token",
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ responseCode: "2001100", accounts: [] })),
    );
  vi.stubGlobal("fetch", fetch);
  await dokuSnap(
    "/sub-account/v2.0/balance-inquiries",
    { profileId: "MCH-test" },
    "12345",
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const [, options] of fetch.mock.calls)
    expect(options.headers["X-TIMESTAMP"]).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    );
});
it("sandbox identity and checkout deadline cannot silently become production", async () => {
  env();
  const c = await checkout();
  expect(c.provider).toBe("doku");
  const body = checkoutBody(c, "SAC-1234-1234567890123");
  expect(body.additional_info.account.id).toBe("SAC-1234-1234567890123");
  expect(body.additional_info.override_notification_url).toBe(
    "https://catera.example/api/webhooks/doku/payment",
  );
  expect(body).not.toHaveProperty("additionalInfo");
  expect(
    checkoutBody(c, "SAC-1234-1234567890123").payment.payment_due_date,
  ).toBeLessThanOrEqual(14);
  expect(() =>
    checkoutBody(
      { ...c, expires_at: new Date(Date.now() + 30000).toISOString() },
      "SAC-1234-1234567890123",
    ),
  ).toThrow("PAYMENT_HOLD_TOO_SHORT");
  vi.stubEnv("DOKU_ENVIRONMENT", "production");
  expect(dokuConfig).toThrow("DOKU_SANDBOX_REQUIRED");
  await expect(
    db.query("update v1.checkouts set provider='xendit' where id=$1", [c.id]),
  ).rejects.toThrow("IMMUTABLE_PROVIDER");
});
it("verifies actual notification bytes, merchant and callback path, including delayed valid retries", () => {
  env();
  const raw = '{"order":{"amount":10000}}',
    path = "/api/webhooks/doku/payment";
  const timestamp = "2026-01-01T00:00:00Z";
  const signature = nonSnapSignature(
    "synthetic-secret",
    "MCH-test",
    "notification",
    timestamp,
    path,
    raw,
  );
  const headers = new Headers({
    "client-id": "MCH-test",
    "request-id": "notification",
    "request-timestamp": timestamp,
    signature,
  });
  expect(verifyDokuNotification(headers, path, raw)).toBe(true);
  expect(verifyDokuNotification(headers, path, raw + " ")).toBe(false);
  expect(verifyDokuNotification(headers, "/other", raw)).toBe(false);
  headers.set("client-id", "other");
  expect(verifyDokuNotification(headers, path, raw)).toBe(false);
});
it("claims one checkout before submission, accepts an early callback and deduplicates activation", async () => {
  env();
  const c = await checkout(),
    reference = dokuInvoice(c.id);
  const claims = await Promise.all(
    [1, 2].map(() =>
      sys<any>("provider.payment.claim", {
        id: c.id,
        reference,
        merchant: config.merchant,
        request: {},
      }),
    ),
  );
  expect(claims.filter((x) => x.submit)).toHaveLength(1);
  const data = {
    order: { invoice_number: reference, amount: c.quote.total },
    transaction: { status: "SUCCESS", original_request_id: "trx-" + c.id },
  };
  await recordDokuPayment(data, sys);
  await recordDokuPayment(data, sys);
  expect((await processDokuInbox(sys)).failed).toBe(0);
  expect(
    (
      await db.query<any>(
        "select state,subscription_id from v1.checkouts where id=$1",
        [c.id],
      )
    ).rows[0],
  ).toMatchObject({ state: "paid" });
  expect(
    (
      await db.query<any>(
        "select count(*)::int n from v1.allocations where checkout_id=$1",
        [c.id],
      )
    ).rows[0].n,
  ).toBe(1);
  await recordDokuPayment({ ...data, transaction: { status: "EXPIRED" } }, sys);
  await processDokuInbox(sys);
  expect(
    (await db.query<any>("select state from v1.checkouts where id=$1", [c.id]))
      .rows[0].state,
  ).toBe("paid");
  await expect(sys("payment.event", { checkoutId: c.id })).rejects.toThrow(
    "PROVIDER_EVENT_ROUTE_REQUIRED",
  );
});
it("does not turn failed attempts into failed orders or accept amount mismatches", () => {
  const op = { entity_id: "id", reference: "invoice", amount: 10000 };
  expect(
    dokuPaymentEvent(
      {
        order: { invoice_number: "invoice", amount: 10000 },
        transaction: { status: "FAILED" },
      },
      op,
    ),
  ).toBeNull();
  expect(() =>
    dokuPaymentEvent(
      {
        order: { invoice_number: "invoice", amount: 9999 },
        transaction: { status: "SUCCESS" },
      },
      op,
    ),
  ).toThrow("DOKU_PAYMENT_MISMATCH");
});
it("never recreates checkout after a network timeout or changing the default provider", async () => {
  env();
  const c = await checkout();
  const fetch = vi.fn().mockRejectedValue(new Error("socket closed"));
  vi.stubGlobal("fetch", fetch);
  await expect(createPaymentSession(c, sys)).rejects.toThrow("socket closed");
  await sys("provider.configure", {
    provider: "xendit",
    environment: "legacy",
    merchant: "",
    reason: "Test rollback",
  });
  await expect(createPaymentSession(c, sys)).rejects.toThrow(
    "DOKU_PAYMENT_RECONCILIATION_REQUIRED",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  await sys("provider.configure", config);
});
it("persists a successful hosted checkout and reuses its URL without another network submission", async () => {
  env();
  const c = await checkout();
  const expiry = new Date(Date.now() + 5 * 60000);
  const wib = new Date(expiry.getTime() + 7 * 3600000)
    .toISOString()
    .slice(0, 19)
    .replace(/[-T:]/g, "");
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        response: {
          payment: {
            url: "https://sandbox.doku.com/checkout/test",
            token_id: "synthetic-token",
            expired_date: wib,
          },
        },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  const result = await createPaymentSession(c, sys);
  expect(result).toEqual({
    providerId: dokuInvoice(c.id),
    url: "https://sandbox.doku.com/checkout/test",
  });
  expect(await createPaymentSession(c, sys)).toEqual(result);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe(
    "https://api-sandbox.doku.com/checkout/v1/payment",
  );
  const stored = (
    await db.query<any>(
      "select payment_url,state from v1.checkouts where id=$1",
      [c.id],
    )
  ).rows[0];
  expect(stored).toEqual({ payment_url: result.url, state: "pending" });
});
it("rejects production redirect URLs and provider deadlines beyond the reserved schedule", () => {
  const data = {
    response: {
      payment: {
        url: "https://api.doku.com/pay",
        token_id: "id",
        expired_date: "20990101000000",
      },
    },
  };
  expect(() =>
    checkoutResult(data, new Date(Date.now() + 900000).toISOString()),
  ).toThrow("DOKU_INVALID_CHECKOUT_URL");
  data.response.payment.url = "https://sandbox.doku.com/pay";
  expect(() =>
    checkoutResult(data, new Date(Date.now() + 900000).toISOString()),
  ).toThrow("DOKU_EXPIRY_MISMATCH");
  data.response.payment.url = "https://staging.doku.com/checkout-link-v2/id";
  const deadline = new Date(Date.now() + 900000).toISOString();
  data.response.payment.expired_date = new Date(
    Date.now() + 600000 + 7 * 3600000,
  )
    .toISOString()
    .slice(0, 19)
    .replace(/[-T:]/g, "");
  expect(checkoutResult(data, deadline).url).toBe(data.response.payment.url);
  data.response.payment.url = "https://staging.doku.com.attacker.example/pay";
  expect(() => checkoutResult(data, deadline)).toThrow(
    "DOKU_INVALID_CHECKOUT_URL",
  );
});
it("keeps hosted refunds gated rather than inventing a payment or silently adjusting amounts", async () => {
  expect(refundBlocker(9999)).toBe("DOKU_REFUND_AMOUNT_UNSUPPORTED");
  expect(refundBlocker(25000001)).toBe("DOKU_REFUND_AMOUNT_UNSUPPORTED");
  expect(refundBlocker(10000)).toBe("DOKU_REFUND_SERVICE_CONTRACT_REQUIRED");
  const call = vi.fn().mockResolvedValue({});
  expect(
    await createRefund(
      {
        id: "refund",
        amount: 10000,
        payment: { provider_id: "payment" },
        provider: "doku",
      },
      call as System,
    ),
  ).toEqual({ id: null, status: "NEEDS_ATTENTION" });
  expect(call).toHaveBeenCalledWith("provider.refund.block", {
    id: "refund",
    reason: "DOKU_REFUND_SERVICE_CONTRACT_REQUIRED",
  });
});
it("payout inquiry refuses a changed bank destination or beneficiary identity", () => {
  const request = {
    partnerReferenceNo: "ref",
    fromAccount: "123",
    beneficiaryBankCode: "BIC",
    beneficiaryAccountNumber: "123456",
    amount: { value: "10000.00", currency: "IDR" },
  };
  const data = {
    ...request,
    referenceNo: "provider-ref",
    beneficiaryAccountName: "TEST SELLER",
  };
  expect(() => validateInquiry(data, request, "Test Seller")).not.toThrow();
  expect(() =>
    validateInquiry(
      { ...data, beneficiaryAccountNumber: "other" },
      request,
      "Test Seller",
    ),
  ).toThrow("DOKU_PAYOUT_MISMATCH");
  expect(() => validateInquiry(data, request, "OTHER SELLER")).toThrow(
    "DOKU_BENEFICIARY_REVIEW_REQUIRED",
  );
});
