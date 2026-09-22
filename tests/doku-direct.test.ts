import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  ADDRESS_ID as A,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout } from "@catera/domain";
import {
  createPaymentSession,
  processDokuInbox,
  type ProviderOperation,
  type System,
} from "../packages/backend/src/payment-provider";
import {
  directMethodReady,
  directRequest,
  directResult,
  directPaymentEvent,
  storeDirectEvent,
  submitDirectPayment,
  validateQr,
} from "../packages/backend/src/doku-direct";
import * as doku from "../packages/backend/src/doku";
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const sys: System = (action, payload = {}) =>
  localRpc(db, null, "catera_v1_system", [action, payload], true);
const cmd = <T = Checkout>(
  action: string,
  payload: unknown,
  actor: string = U.customer,
) =>
  localRpc<T>(db, actor, "catera_v1_command", [
    action,
    payload,
    crypto.randomUUID(),
  ]);
const read = (id: string, actor: string = U.customer) =>
  localRpc<Checkout>(db, actor, "catera_v1_read", ["checkout", { id }]);
const operationFixture: ProviderOperation = {
  id: "operation",
  entity_id: "checkout",
  kind: "payment",
  provider: "doku",
  environment: "sandbox",
  merchant: "MCH-direct-test",
  reference: "ref",
  amount: 10000,
  request: {},
  result: {},
  state: "pending",
  lease_token: "lease",
};
let sequence = 1;
const create = () =>
  cmd("checkout.create", {
    acceptedTerms: true,
    packageId: P[0],
    addressId: A,
    portions: 1,
    startDate: addDays(localDay(), sequence++ * 20),
    trial: false,
  });
function env() {
  for (const [k, v] of Object.entries({
    DOKU_ENVIRONMENT: "sandbox",
    DOKU_CLIENT_ID: "MCH-direct-test",
    DOKU_SECRET_KEY: "synthetic-secret",
    DOKU_PRIVATE_KEY: "synthetic",
    CATERA_CONTROLLED_COLLECTION: "true",
    DOKU_COLLECTION_ENABLED: "true",
    DOKU_COLLECTION_PROFILE_ID: "SAC-1234-1234567890123",
    DOKU_BRI_PARTNER_SERVICE_ID: "12345",
    DOKU_BRI_CUSTOMER_PREFIX: "6",
    DOKU_QRIS_MERCHANT_ID: "123456",
    DOKU_QRIS_TERMINAL_ID: "CATERA",
    DOKU_QRIS_POSTAL_CODE: "12345",
  }))
    vi.stubEnv(k, v);
  for (const prefix of ["DOKU_DIRECT_BRI", "DOKU_DIRECT_QRIS"])
    for (const flag of [
      "ENABLED",
      "CONTRACT_VERIFIED",
      "ROUTING_VERIFIED",
      "CALLBACK_VERIFIED",
    ])
      vi.stubEnv(`${prefix}_${flag}`, "true");
}
export function syntheticQr(total: number) {
  const a = String(total);
  const text = `000201010212530336054${String(a.length).padStart(2, "0")}${a}5802ID5906Catera6007Jakarta6304`;
  let crc = 0xffff;
  for (const b of Buffer.from(text)) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return text + crc.toString(16).toUpperCase().padStart(4, "0");
}
async function prepare(
  c: Checkout,
  method: "VIRTUAL_ACCOUNT_BRI" | "QRIS" = "VIRTUAL_ACCOUNT_BRI",
) {
  await cmd("checkout.payment.start", { id: c.id, method });
  return sys<ProviderOperation>("provider.operation", {
    id: c.id,
    kind: "payment",
  });
}
function briResponse(c: Checkout, op: ProviderOperation) {
  const partnerServiceId = "   12345",
    customerNo = "60000001";
  return {
    responseCode: "2002700",
    virtualAccountData: {
      partnerServiceId,
      customerNo,
      virtualAccountNo: partnerServiceId + customerNo,
      virtualAccountName: "Catera",
      trxId: op.reference,
      totalAmount: { value: `${c.quote.total}.00`, currency: "IDR" },
      expiredDate: new Date(Date.parse(c.expires_at) - 30000).toISOString(),
      virtualAccountTrxType: "C",
      additionalInfo: { channel: "VIRTUAL_ACCOUNT_BRI" },
    },
  };
}
beforeAll(async () => {
  db = await createDemoDatabase(true);
  await sys("provider.configure", {
    provider: "doku",
    environment: "sandbox",
    merchant: "MCH-direct-test",
    reason: "Direct synthetic verification",
  });
  await sys("provider.direct.configure", {
    mode: "direct",
    methods: ["VIRTUAL_ACCOUNT_BRI", "QRIS"],
    reason: "Local synthetic contract fixtures only",
  });
});
afterAll(async () => db?.close());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("requires every channel gate and never enables production", () => {
  env();
  expect(directMethodReady("QRIS")).toBe(true);
  vi.stubEnv("DOKU_DIRECT_QRIS_ROUTING_VERIFIED", "false");
  expect(directMethodReady("QRIS")).toBe(false);
  expect(directMethodReady("VIRTUAL_ACCOUNT_BRI")).toBe(true);
  vi.stubEnv("DOKU_ENVIRONMENT", "production");
  expect(directMethodReady("VIRTUAL_ACCOUNT_BRI")).toBe(false);
});
it("routes both direct methods to the collection profile and rejects malformed routing", () => {
  env();
  const c = {
    expires_at: new Date(Date.now() + 900000).toISOString(),
    quote: { total: 10000 },
  } as Checkout;
  for (const channel of ["VIRTUAL_ACCOUNT_BRI", "QRIS"] as const) {
    const request = directRequest(c, { ...operationFixture, channel });
    expect(request.additionalInfo.account).toEqual({
      id: "SAC-1234-1234567890123",
    });
    expect(
      "expiredDate" in request ? request.expiredDate : request.validityPeriod,
    ).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  }
  vi.stubEnv("DOKU_COLLECTION_PROFILE_ID", "invalid");
  expect(() =>
    directRequest(c, { ...operationFixture, channel: "VIRTUAL_ACCOUNT_BRI" }),
  ).toThrow("DOKU_COLLECTION_PROFILE_REQUIRED");
});
it("blocks reservations when no methods are available", async () => {
  const before = (await db.query("select count(*) n from v1.reservations"))
    .rows;
  await sys("provider.direct.configure", {
    mode: "direct",
    methods: [],
    reason: "No verified channels",
  });
  await expect(create()).rejects.toThrow("PAYMENT_UNAVAILABLE");
  expect(
    (await db.query("select count(*) n from v1.reservations")).rows,
  ).toEqual(before);
  await sys("provider.direct.configure", {
    mode: "direct",
    methods: ["VIRTUAL_ACCOUNT_BRI", "QRIS"],
    reason: "Restore synthetic channels",
  });
});
it("locks selection, rejects other owners and legacy dispatch, and exposes only safe instructions", async () => {
  env();
  const c = await create();
  expect(c.payment_mode).toBe("direct");
  await expect(
    cmd("checkout.payment.start", { id: c.id, method: "QRIS" }, U.owner),
  ).rejects.toThrow("NOT_FOUND");
  let op = await prepare(c);
  await expect(
    cmd("checkout.payment.start", { id: c.id, method: "QRIS" }),
  ).rejects.toThrow("PAYMENT_METHOD_LOCKED");
  await expect(createPaymentSession(c, sys)).rejects.toThrow(
    "DIRECT_PAYMENT_REQUIRED",
  );
  await expect(sys("provider.payment.claim", { id: c.id })).rejects.toThrow(
    "DIRECT_PAYMENT_REQUIRED",
  );
  await expect(read(c.id, U.owner)).rejects.toThrow("NOT_FOUND");
  const request = directRequest(c, op);
  op = await sys("provider.direct.submit", { id: c.id, request });
  const duplicate = await sys<ProviderOperation>("provider.direct.submit", {
    id: c.id,
    request,
  });
  expect(duplicate.submit).toBe(false);
  const result = directResult(briResponse(c, op), c, op);
  await sys("provider.direct.attached", { id: c.id, result });
  const view = await read(c.id);
  expect(view.payment?.instructions?.kind).toBe("virtual_account");
  expect(view.payment_url).toBeNull();
  expect(JSON.stringify(view.payment)).not.toContain("partnerServiceId");
  expect((await read(c.id)).payment).toEqual(view.payment);
  await db.query(
    "update v1.checkouts set expires_at=now()-interval '1 second' where id=$1",
    [c.id],
  );
  expect((await read(c.id)).payment?.instructions).toBeNull();
});
it("validates fixed amount, channel, reference, VA identity and deadline", async () => {
  env();
  const c = await create();
  let op = await prepare(c);
  op = { ...op, request: directRequest(c, op) };
  const response = briResponse(c, op);
  expect(
    directResult(
      {
        ...response,
        virtualAccountData: {
          ...response.virtualAccountData,
          additionalInfo: {},
        },
      },
      c,
      op,
    ).instructions.kind,
  ).toBe("virtual_account");
  expect(directResult(response, c, op).instructions.kind).toBe(
    "virtual_account",
  );
  for (const patch of [
    { totalAmount: { value: "1.00", currency: "IDR" } },
    { trxId: "other" },
    { virtualAccountTrxType: "O" },
    { partnerServiceId: "   99999" },
    { expiredDate: new Date(Date.parse(c.expires_at) + 60000).toISOString() },
  ])
    expect(() =>
      directResult(
        {
          ...response,
          virtualAccountData: { ...response.virtualAccountData, ...patch },
        },
        c,
        op,
      ),
    ).toThrow();
});
it("validates QR amount, dynamic mode, currency and checksum before displaying it", async () => {
  env();
  const c = await create();
  const raw = await prepare(c, "QRIS");
  const op = { ...raw, request: directRequest(c, raw) };
  const data = {
    responseCode: "2004700",
    partnerReferenceNo: op.reference,
    referenceNo: "qris-provider-test",
    terminalId: "CATERA",
    qrContent: syntheticQr(op.amount),
    additionalInfo: { validityPeriod: op.request.validityPeriod },
  };
  expect(directResult(data, c, op).instructions.kind).toBe("qris");
  expect(() => validateQr(data.qrContent, op.amount + 1)).toThrow();
  expect(() =>
    validateQr(data.qrContent.slice(0, -4) + "0000", op.amount),
  ).toThrow();
  expect(() =>
    directResult({ ...data, partnerReferenceNo: "other" }, c, op),
  ).toThrow();
  expect(() => directResult({ ...data, additionalInfo: {} }, c, op)).toThrow();
});
it("does not resubmit an uncertain provider creation", async () => {
  env();
  const c = await create();
  await prepare(c);
  const network = vi
    .spyOn(doku, "dokuSnap")
    .mockRejectedValue(new Error("socket closed"));
  await submitDirectPayment(c, sys);
  await submitDirectPayment(c, sys);
  expect(network).toHaveBeenCalledTimes(1);
  expect((await read(c.id)).payment?.status).toBe("checking");
});
it("deduplicates callback-before-response and atomically activates exactly once", async () => {
  env();
  const c = await create();
  let op = await prepare(c);
  op = await sys("provider.direct.submit", {
    id: c.id,
    request: directRequest(c, op),
  });
  const response = briResponse(c, op);
  const notification = {
    ...response.virtualAccountData,
    paidAmount: response.virtualAccountData.totalAmount,
    paymentRequestId: "bri-paid-test",
  };
  await storeDirectEvent(notification, op, "bri_notification", sys);
  await storeDirectEvent(notification, op, "bri_notification", sys);
  await processDokuInbox(sys);
  await sys("provider.direct.attached", {
    id: c.id,
    result: directResult(response, c, op),
  });
  await processDokuInbox(sys);
  const saved = await read(c.id);
  expect(saved.state).toBe("paid");
  expect(saved.subscription_id).toBeTruthy();
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from v1.allocations where checkout_id=$1",
        [c.id],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await sys<ProviderOperation>("provider.operation", {
        id: c.id,
        kind: "payment",
      })
    ).state,
  ).toBe("succeeded");
});
it("enforces a one-minute inquiry claim and preserves existing instructions after rollback", async () => {
  env();
  const c = await create();
  let op = await prepare(c, "QRIS");
  op = await sys("provider.direct.submit", {
    id: c.id,
    request: directRequest(c, op),
  });
  expect(await sys("provider.direct.refresh", { id: c.id })).toBeNull();
  await db.query(
    "update v1.provider_operations set lease_until=null,polled_at=now()-interval '2 minutes' where id=$1",
    [op.id],
  );
  expect(await sys("provider.direct.refresh", { id: c.id })).toBeTruthy();
  expect(await sys("provider.direct.refresh", { id: c.id })).toBeNull();
  const result = directResult(
    {
      responseCode: "2004700",
      partnerReferenceNo: op.reference,
      referenceNo: "qris-ref",
      terminalId: "CATERA",
      qrContent: syntheticQr(op.amount),
      additionalInfo: { validityPeriod: op.request.validityPeriod },
    },
    c,
    op,
  );
  await sys("provider.direct.attached", { id: c.id, result });
  await sys("provider.direct.configure", {
    mode: "direct",
    methods: [],
    reason: "Rollback new creation",
  });
  const view = await read(c.id);
  expect(view.payment?.availableMethods).toEqual([]);
  expect(view.payment?.instructions?.kind).toBe("qris");
});
it("rejects forged QRIS references and treats pending status as unconfirmed", () => {
  const op = {
    ...operationFixture,
    channel: "QRIS",
    reference: "ref",
    amount: 10000,
    request: { merchantId: "123" },
    result: { providerReference: "qr-ref" },
  } as ProviderOperation;
  const pending = {
    originalPartnerReferenceNo: "ref",
    originalReferenceNo: "qr-ref",
    serviceCode: "47",
    latestTransactionStatus: "03",
  };
  expect(directPaymentEvent(pending, op, "qris_status")).toBeNull();
  expect(() =>
    directPaymentEvent(
      { ...pending, originalReferenceNo: "forged" },
      op,
      "qris_status",
    ),
  ).toThrow();
  expect(() =>
    directPaymentEvent(
      {
        order: { invoice_number: "ref", amount: 10000 },
        channel: { id: "WRONG_CHANNEL" },
        service: { id: "QRIS" },
        acquirer: { id: "DOKU" },
        customer: { doku_id: "other" },
      },
      op,
      "qris_notification",
    ),
  ).toThrow();
});
it("normalizes successful QRIS notifications and inquiry to the same durable event", () => {
  const op = {
    ...operationFixture,
    entity_id: "checkout",
    channel: "QRIS",
    reference: "ref",
    amount: 10000,
    request: { merchantId: "123" },
    result: { providerReference: "qr-ref" },
  } as ProviderOperation;
  const notification = {
    order: { invoice_number: "ref", amount: 10000 },
    channel: { id: "QRIS_DOKU" },
    service: { id: "QRIS" },
    acquirer: { id: "DOKU" },
    transaction: { status: "SUCCESS" },
    emoney_payment: { approval_code: "approval-test" },
  };
  const inquiry = {
    responseCode: "2005100",
    originalPartnerReferenceNo: "ref",
    originalReferenceNo: "qr-ref",
    serviceCode: "47",
    latestTransactionStatus: "00",
    amount: { value: "10000.00", currency: "IDR" },
    additionalInfo: { approvalCode: "approval-test" },
  };
  expect(directPaymentEvent(notification, op, "qris_notification")).toEqual(
    directPaymentEvent(inquiry, op, "qris_status"),
  );
  expect(
    directPaymentEvent(
      { ...inquiry, amount: { value: 10000, currency: "IDR" } },
      op,
      "qris_status",
    ),
  ).toEqual(directPaymentEvent(notification, op, "qris_notification"));
  for (const value of [9999, 10000.5, null, true, "1e4"]) {
    expect(() =>
      directPaymentEvent(
        { ...inquiry, amount: { value, currency: "IDR" } },
        op,
        "qris_status",
      ),
    ).toThrow("DOKU_PAYMENT_MISMATCH");
  }
  expect(
    directPaymentEvent(
      { ...notification, acquirer: { id: "93600899" } },
      op,
      "qris_notification",
    ),
  ).toEqual(directPaymentEvent(inquiry, op, "qris_status"));
  expect(() =>
    directPaymentEvent(
      { ...notification, acquirer: { id: "93600014" } },
      op,
      "qris_notification",
    ),
  ).toThrow("DOKU_PAYMENT_MISMATCH");
  expect(() =>
    directPaymentEvent(
      { ...notification, order: { invoice_number: "ref", amount: 9999 } },
      op,
      "qris_notification",
    ),
  ).toThrow();
  expect(() =>
    directPaymentEvent(
      { ...inquiry, amount: { value: "10000.00", currency: "USD" } },
      op,
      "qris_status",
    ),
  ).toThrow();
});
it("does not infer BRI payment from the pending response's amount", () => {
  const op = {
    ...operationFixture,
    entity_id: "checkout",
    channel: "VIRTUAL_ACCOUNT_BRI",
    reference: "ref",
    amount: 10000,
    request: { partnerServiceId: "   12345", customerNo: "6" },
    result: {},
  } as ProviderOperation;
  const va = {
    partnerServiceId: "   12345",
    customerNo: "600001",
    virtualAccountNo: "   12345600001",
    paidAmount: { value: "10000.00", currency: "IDR" },
    paymentFlagReason: { english: "Pending" },
  };
  const data = { virtualAccountData: va, additionalInfo: { trxId: "ref" } };
  expect(directPaymentEvent(data, op, "bri_status")).toBeNull();
  expect(
    directPaymentEvent(
      {
        ...data,
        virtualAccountData: {
          ...va,
          paymentRequestId: "paid",
          paymentFlagReason: { english: "Success" },
        },
      },
      op,
      "bri_status",
    )?.status,
  ).toBe("paid");
});
it("verifies the exact SNAP callback path and rejects body tampering and another merchant", () => {
  env();
  const path = "/api/webhooks/doku/direct/bri",
    raw = JSON.stringify({
      trxId: "test",
      paidAmount: { value: "10000.00", currency: "IDR" },
    });
  const timestamp = new Date().toISOString(),
    token = "synthetic-callback-token";
  const headers = new Headers({
    "x-partner-id": "MCH-direct-test",
    "x-timestamp": timestamp,
    authorization: `Bearer ${token}`,
    "x-signature": doku.snapSignature(
      "synthetic-secret",
      path,
      token,
      timestamp,
      raw,
    ),
  });
  expect(doku.verifyDokuSnapNotification(headers, path, raw)).toBe(true);
  expect(doku.verifyDokuSnapNotification(headers, path + "/other", raw)).toBe(
    false,
  );
  expect(
    doku.verifyDokuSnapNotification(
      headers,
      path,
      raw.replace("10000", "10001"),
    ),
  ).toBe(false);
  headers.set("x-partner-id", "other");
  expect(doku.verifyDokuSnapNotification(headers, path, raw)).toBe(false);
});
it("routes late direct payment on an unavailable package to review without activation", async () => {
  env();
  await sys("provider.direct.configure", {
    mode: "direct",
    methods: ["VIRTUAL_ACCOUNT_BRI"],
    reason: "Synthetic late payment test",
  });
  const c = await create();
  let op = await prepare(c);
  op = await sys("provider.direct.submit", {
    id: c.id,
    request: directRequest(c, op),
  });
  const response = briResponse(c, op);
  await db.query(
    "update v1.checkouts set expires_at=now()-interval '1 minute' where id=$1",
    [c.id],
  );
  await db.query("update v1.packages set status='retired' where id=$1", [P[0]]);
  await storeDirectEvent(
    {
      ...response.virtualAccountData,
      paidAmount: response.virtualAccountData.totalAmount,
      paymentRequestId: "late-direct",
    },
    op,
    "bri_notification",
    sys,
  );
  await processDokuInbox(sys);
  const view = await read(c.id);
  expect(view.state).toBe("payment_exception");
  expect(view.subscription_id).toBeNull();
});
