import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  ADDRESS_ID as A,
} from "../packages/backend/src/seed";
import {
  addDays,
  localDay,
  REDIRECT_CHANNELS,
  VA_CHANNELS,
  type Checkout,
  type DirectPaymentMethod,
} from "@catera/domain";
import {
  createPaymentSession,
  processDokuInbox,
  reconcileDoku,
  recordDokuPayment,
  type ProviderOperation,
  type System,
} from "../packages/backend/src/payment-provider";
import {
  directMethodReady,
  directRequest,
  directResult,
  directPaymentEvent,
  assertPaylaterCustomer,
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
  vi.spyOn(doku, "dokuToken").mockResolvedValue("token");
  const network = vi
    .spyOn(doku, "dokuSnap")
    .mockRejectedValue(new Error("socket closed"));
  await submitDirectPayment(c, sys);
  await submitDirectPayment(c, sys);
  expect(network).toHaveBeenCalledTimes(1);
  expect((await read(c.id)).payment?.status).toBe("checking");
});
it("keeps a payment retryable when DOKU's token fails before anything is sent", async () => {
  env();
  const c = await create();
  await prepare(c, "QRIS");
  const token = vi
    .spyOn(doku, "dokuToken")
    .mockRejectedValueOnce(new Error("DOKU_TOKEN_HTTP_503"));
  const snap = vi.spyOn(doku, "dokuSnap").mockRejectedValue(new Error("socket closed"));
  await expect(submitDirectPayment(c, sys)).rejects.toThrow("DOKU_TOKEN_HTTP_503");
  expect(snap).not.toHaveBeenCalled();
  expect((await read(c.id)).payment?.status).toBe("preparing");
  token.mockResolvedValue("token");
  await submitDirectPayment(c, sys);
  expect(snap).toHaveBeenCalledTimes(1);
  expect(snap.mock.calls[0][4]).toBe("token");
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
  await storeDirectEvent(notification, op, "va_notification", sys);
  await storeDirectEvent(notification, op, "va_notification", sys);
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
  expect(directPaymentEvent(data, op, "va_status")).toBeNull();
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
      "va_status",
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
    "va_notification",
    sys,
  );
  await processDokuInbox(sys);
  const view = await read(c.id);
  expect(view.state).toBe("payment_exception");
  expect(view.subscription_id).toBeNull();
});

const FX_ID = "11111111-1111-4111-8111-111111111111";
const fx = () =>
  ({
    id: FX_ID,
    expires_at: new Date(Date.now() + 900000).toISOString(),
    quote: { total: 10000 },
  }) as Checkout;
const channelOp = (
  channel: DirectPaymentMethod,
  patch: Partial<ProviderOperation> = {},
): ProviderOperation => ({
  ...operationFixture,
  payment_mode: "direct",
  state: "preparing",
  channel,
  entity_id: FX_ID,
  reference: doku.dokuInvoice(FX_ID),
  ...patch,
});
const wib = (ms: number) =>
  new Date(ms + 7 * 3600000)
    .toISOString()
    .slice(0, 19)
    .replace(/[-:T]/g, "");
const FLAGS = [
  "ENABLED",
  "CONTRACT_VERIFIED",
  "ROUTING_VERIFIED",
  "CALLBACK_VERIFIED",
];
function envAll() {
  env();
  vi.stubEnv("CATERA_PUBLIC_URL", "https://catera.example");
  for (const bank of Object.keys(VA_CHANNELS)) {
    vi.stubEnv(`DOKU_${bank}_PARTNER_SERVICE_ID`, "12345");
    vi.stubEnv(`DOKU_${bank}_CUSTOMER_PREFIX`, "6");
  }
  for (const key of [
    ...Object.keys(VA_CHANNELS),
    ...Object.keys(REDIRECT_CHANNELS),
  ])
    for (const f of FLAGS) vi.stubEnv(`DOKU_DIRECT_${key}_${f}`, "true");
}
const checkoutResponse = (
  c: Checkout,
  reference: string,
  host = "sandbox.doku.com",
) => ({
  response: {
    order: { invoice_number: reference },
    payment: {
      url: `https://${host}/checkout/link/abc`,
      token_id: "token-1",
      expired_date: wib(Date.parse(c.expires_at) - 60000),
    },
  },
});

it("readiness is per channel: four flags, bank config, and BRI keeps its env names", () => {
  envAll();
  for (const m of [
    ...Object.values(VA_CHANNELS),
    ...Object.values(REDIRECT_CHANNELS),
  ])
    expect(directMethodReady(m)).toBe(true);
  for (const [bank, m] of Object.entries(VA_CHANNELS)) {
    for (const f of FLAGS) {
      vi.stubEnv(`DOKU_DIRECT_${bank}_${f}`, "false");
      expect(directMethodReady(m)).toBe(false);
      vi.stubEnv(`DOKU_DIRECT_${bank}_${f}`, "true");
    }
    for (const k of ["PARTNER_SERVICE_ID", "CUSTOMER_PREFIX"]) {
      vi.stubEnv(`DOKU_${bank}_${k}`, "");
      expect(directMethodReady(m)).toBe(false);
      vi.stubEnv(`DOKU_${bank}_${k}`, "6");
    }
  }
  for (const [key, m] of Object.entries(REDIRECT_CHANNELS)) {
    vi.stubEnv(`DOKU_DIRECT_${key}_CALLBACK_VERIFIED`, "false");
    expect(directMethodReady(m)).toBe(false);
  }
  vi.stubEnv("DOKU_COLLECTION_ENABLED", "false");
  expect(directMethodReady("VIRTUAL_ACCOUNT_BCA")).toBe(false);
});
it("a channel is off unless its own flags are set", () => {
  env();
  expect(directMethodReady("VIRTUAL_ACCOUNT_BCA")).toBe(false);
  expect(directMethodReady("EMONEY_DANA")).toBe(false);
});

it("creates the VA for each bank with its own config and echoes its channel and bank", () => {
  envAll();
  for (const [bank, channel] of Object.entries(VA_CHANNELS)) {
    vi.stubEnv(`DOKU_${bank}_PARTNER_SERVICE_ID`, "777");
    vi.stubEnv(`DOKU_${bank}_CUSTOMER_PREFIX`, "9");
    const c = fx();
    const op = channelOp(channel);
    const request: any = directRequest(c, op);
    expect(request.additionalInfo.channel).toBe(channel);
    expect(request.partnerServiceId).toBe("     777");
    expect(request.customerNo).toBe("9");
    expect(request.trxId).toBe(op.reference);
    const res = {
      responseCode: "2002700",
      virtualAccountData: {
        partnerServiceId: request.partnerServiceId,
        customerNo: "90000001",
        virtualAccountNo: request.partnerServiceId + "90000001",
        virtualAccountName: "Catera",
        trxId: op.reference,
        totalAmount: { value: "10000.00", currency: "IDR" },
        expiredDate: request.expiredDate,
        virtualAccountTrxType: "C",
        additionalInfo: { channel },
      },
    };
    const full = { ...op, request };
    const out = directResult(res, c, full) as any;
    expect(out.instructions).toMatchObject({ kind: "virtual_account", bank });
    const other =
      channel === "VIRTUAL_ACCOUNT_BRI"
        ? "VIRTUAL_ACCOUNT_BCA"
        : "VIRTUAL_ACCOUNT_BRI";
    expect(() =>
      directResult(
        {
          ...res,
          virtualAccountData: {
            ...res.virtualAccountData,
            additionalInfo: { channel: other },
          },
        },
        c,
        full,
      ),
    ).toThrow("DOKU_INVALID_RESPONSE");
  }
});

it("matches a non-BRI VA notification and status to its own operation only", () => {
  const op = channelOp("VIRTUAL_ACCOUNT_BCA", {
    request: { partnerServiceId: "   12345", customerNo: "6" },
    result: {},
  });
  const va = {
    partnerServiceId: "   12345",
    customerNo: "600001",
    virtualAccountNo: "   12345600001",
    trxId: op.reference,
    paidAmount: { value: "10000.00", currency: "IDR" },
    paymentRequestId: "bca-paid",
    additionalInfo: { channel: "VIRTUAL_ACCOUNT_BCA" },
  };
  expect(directPaymentEvent(va, op, "va_notification")?.status).toBe("paid");
  expect(() =>
    directPaymentEvent(
      { ...va, additionalInfo: { channel: "VIRTUAL_ACCOUNT_BRI" } },
      op,
      "va_notification",
    ),
  ).toThrow("DOKU_PAYMENT_MISMATCH");
  expect(() =>
    directPaymentEvent(va, { ...op, channel: "QRIS" }, "va_notification"),
  ).toThrow("DOKU_PAYMENT_MISMATCH");
  const status = {
    virtualAccountData: { ...va, paymentFlagReason: { english: "Success" } },
  };
  expect(directPaymentEvent(status, op, "va_status")?.status).toBe("paid");
  expect(
    directPaymentEvent(
      {
        virtualAccountData: {
          ...status.virtualAccountData,
          paymentRequestId: undefined,
        },
      },
      op,
      "va_status",
    ),
  ).toBeNull();
});

it("builds a single-method Checkout request for a wallet with invoice = reference and no customer", () => {
  envAll();
  const c = fx();
  const op = channelOp("EMONEY_DANA");
  const body: any = directRequest(c, op);
  expect(body.payment.payment_method_types).toEqual(["EMONEY_DANA"]);
  expect(body.order.invoice_number).toBe(op.reference);
  expect(body.order.invoice_number).toBe(doku.dokuInvoice(c.id));
  expect(body.order.amount).toBe(10000);
  expect(body.additional_info.account.id).toBe("SAC-1234-1234567890123");
  expect(body).not.toHaveProperty("customer");
  expect(body).not.toHaveProperty("line_items");
  expect(() =>
    directRequest(c, { ...op, reference: "x".repeat(34) }),
  ).toThrow();
  expect(() =>
    directRequest(
      { ...c, expires_at: new Date(Date.now() + 30000).toISOString() },
      op,
    ),
  ).toThrow("PAYMENT_HOLD_TOO_SHORT");
});

it("adds customer and line items for paylater and refuses an incomplete customer", () => {
  envAll();
  const c = fx();
  const customer = {
    name: "Sari Dewi",
    phone: "081234567890",
    email: "sari@example.com",
    address: "Jl. Mawar 1",
    city: "Jakarta",
    postcode: "12345",
    packageName: "Paket Sehat",
  };
  for (const channel of Object.values(REDIRECT_CHANNELS).filter((m) =>
    m.startsWith("PEER"),
  )) {
    const body: any = directRequest(c, channelOp(channel), customer);
    expect(body.payment.payment_method_types).toEqual([channel]);
    expect(body.customer).toEqual({
      id: c.id,
      name: "Sari Dewi",
      phone: "6281234567890",
      email: "sari@example.com",
      address: "Jl. Mawar 1",
      postcode: "12345",
      city: "Jakarta",
      country: "ID",
    });
    expect(body.line_items).toEqual([
      { name: "Paket Sehat", price: 10000, quantity: 1 },
    ]);
    expect(
      body.line_items.reduce(
        (n: number, i: any) => n + i.price * i.quantity,
        0,
      ),
    ).toBe(body.order.amount);
  }
  const op = channelOp("PEER_TO_PEER_KREDIVO");
  for (const missing of ["name", "phone", "email"])
    expect(() =>
      directRequest(c, op, { ...customer, [missing]: null }),
    ).toThrow("PAYMENT_CUSTOMER_INCOMPLETE");
  expect(() => directRequest(c, op)).toThrow("PAYMENT_CUSTOMER_INCOMPLETE");
  const partial: any = directRequest(c, op, {
    ...customer,
    address: null,
    postcode: null,
    city: null,
    packageName: null,
  });
  expect(partial.customer).toMatchObject({ name: "Sari Dewi", country: "ID" });
  expect(partial.customer).not.toHaveProperty("address");
  expect(partial.line_items).toHaveLength(1);
});

it("validates the redirect attach result like the hosted path", () => {
  envAll();
  const c = fx();
  const op = channelOp("EMONEY_SHOPEE_PAY");
  const out: any = directResult(checkoutResponse(c, op.reference), c, op);
  expect(out.providerReference).toBe("token-1");
  expect(out.instructions).toEqual({
    kind: "redirect",
    url: "https://sandbox.doku.com/checkout/link/abc",
    channel: "EMONEY_SHOPEE_PAY",
  });
  expect(Date.parse(out.expiresAt)).toBeLessThanOrEqual(
    Date.parse(c.expires_at),
  );
  expect(() =>
    directResult(checkoutResponse(c, op.reference, "evil.example.com"), c, op),
  ).toThrow("DOKU_INVALID_CHECKOUT_URL");
  expect(() => directResult(checkoutResponse(c, "other"), c, op)).toThrow(
    "DOKU_INVALID_RESPONSE",
  );
});

it("submits a redirect payment through Checkout and attaches the URL", async () => {
  envAll();
  const c = fx();
  const op = channelOp("PEER_TO_PEER_AKULAKU");
  const calls: [string, any][] = [];
  const s: System = async (action: string, payload: any = {}) => {
    calls.push([action, payload]);
    if (action === "provider.operation") return op as any;
    if (action === "provider.payment.customer")
      return {
        name: "Sari Dewi",
        phone: "081234567890",
        email: "sari@example.com",
        address: null,
        city: null,
        postcode: null,
        packageName: "Paket Sehat",
      } as any;
    if (action === "provider.direct.submit")
      return { ...op, request: payload.request, submit: true } as any;
    return undefined as any;
  };
  const req = vi
    .spyOn(doku, "dokuRequest")
    .mockResolvedValue(checkoutResponse(c, op.reference));
  const snap = vi.spyOn(doku, "dokuSnap");
  await submitDirectPayment(c, s);
  expect(snap).not.toHaveBeenCalled();
  expect(req.mock.calls[0][0]).toBe("/checkout/v1/payment");
  expect((req.mock.calls[0][1] as any).customer.name).toBe("Sari Dewi");
  expect(calls.find((x) => x[0] === "provider.payment.customer")?.[1]).toEqual({
    id: c.id,
  });
  const attached = calls.find((x) => x[0] === "provider.direct.attached");
  expect(attached?.[1].result.instructions).toMatchObject({
    kind: "redirect",
    channel: "PEER_TO_PEER_AKULAKU",
  });
  calls.length = 0;
  const wallet = channelOp("EMONEY_OVO");
  const s2: System = async (action: string, payload: any = {}) => {
    calls.push([action, payload]);
    if (action === "provider.operation") return wallet as any;
    if (action === "provider.direct.submit")
      return { ...wallet, request: payload.request, submit: true } as any;
    return undefined as any;
  };
  req.mockResolvedValue(checkoutResponse(c, wallet.reference));
  await submitDirectPayment(c, s2);
  expect(calls.some((x) => x[0] === "provider.payment.customer")).toBe(false);
});

it("routes a redirect operation's notification through the hosted parser", async () => {
  envAll();
  const op = channelOp("EMONEY_DANA", { state: "pending" });
  const received: any[] = [];
  const s: System = async (action: string, payload: any = {}) => {
    if (action === "provider.operation") return op as any;
    if (action === "provider.inbox.receive") received.push(payload);
    return undefined as any;
  };
  const paid = {
    order: { invoice_number: op.reference, amount: 10000, currency: "IDR" },
    transaction: { status: "SUCCESS", original_request_id: "req-1" },
  };
  await recordDokuPayment(paid, s);
  expect(received[0].event).toMatchObject({
    status: "paid",
    paymentRequestId: "req-1",
    checkoutId: FX_ID,
  });
  await recordDokuPayment({ ...paid, transaction: { status: "EXPIRED" } }, s);
  expect(received[1].event.status).toBe("expired");
  await expect(
    recordDokuPayment({ ...paid, order: { ...paid.order, amount: 1 } }, s),
  ).rejects.toThrow("DOKU_PAYMENT_MISMATCH");
  await recordDokuPayment({ ...paid, transaction: { status: "FAILED" } }, s);
  expect(received).toHaveLength(2);
});

it("reconciles a redirect operation through the order status endpoint", async () => {
  envAll();
  const op = channelOp("EMONEY_LINKAJA", { state: "pending" });
  const received: any[] = [];
  const s: System = async (action: string, payload: any = {}) => {
    if (action === "provider.inbox.claim") return [] as any;
    if (action === "provider.pending")
      return (payload.kind === "payment" ? [op] : []) as any;
    if (action === "provider.operation") return op as any;
    if (action === "provider.inbox.receive") received.push(payload);
    return undefined as any;
  };
  const req = vi.spyOn(doku, "dokuRequest").mockResolvedValue({
    order: { invoice_number: op.reference, amount: 10000 },
    transaction: { status: "SUCCESS", original_request_id: "req-2" },
  });
  const snap = vi.spyOn(doku, "dokuSnap");
  const out = await reconcileDoku(s);
  expect(out.failed).toBe(0);
  expect(req).toHaveBeenCalledWith("/orders/v1/status/" + op.reference);
  expect(snap).not.toHaveBeenCalled();
  expect(received[0].event.status).toBe("paid");
});

it("hosted allow-list accepts DOKU's real codes and rejects junk", () => {
  envAll();
  const c = fx();
  for (const ok of [
    "EMONEY_SHOPEE_PAY",
    "PEER_TO_PEER_KREDIVO",
    "CREDIT_CARD",
    "ONLINE_TO_OFFLINE_ALFA",
    "QRIS",
  ]) {
    vi.stubEnv("DOKU_PAYMENT_METHODS", ok);
    expect(
      doku.checkoutBody(c, "SAC-1234-1234567890123").payment
        .payment_method_types,
    ).toEqual([ok]);
  }
  for (const bad of [
    "EMONEY",
    "emoney_dana",
    "DROP;TABLE",
    "VIRTUAL_ACCOUNT_bri",
    "PEER_TO_PEER_",
  ]) {
    vi.stubEnv("DOKU_PAYMENT_METHODS", bad);
    expect(() => doku.checkoutBody(c, "SAC-1234-1234567890123")).toThrow(
      "DOKU_CHANNEL_NOT_SUPPORTED",
    );
  }
});

it("normalises the paylater phone to DOKU's 62 format", () => {
  envAll();
  const c = fx();
  const op = channelOp("PEER_TO_PEER_KREDIVO");
  const base = { name: "S", email: "s@example.com", address: null, city: null, postcode: null, packageName: null };
  for (const [raw, want] of [
    ["081234567890", "6281234567890"],
    ["+6281234567890", "6281234567890"],
    ["+62 812-3456-7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
  ])
    expect((directRequest(c, op, { ...base, phone: raw }) as any).customer.phone).toBe(want);
});

it("refuses a paylater method before anything is locked when the customer is incomplete", async () => {
  const full = { name: "S", phone: "0812", email: "s@example.com" };
  const seen: string[] = [];
  const mk = (customer: any): System => async (action: string) => {
    seen.push(action);
    return customer as any;
  };
  await expect(assertPaylaterCustomer("PEER_TO_PEER_KREDIVO", "id", mk({ ...full, phone: null }))).rejects.toThrow(
    "PAYMENT_CUSTOMER_INCOMPLETE",
  );
  await expect(assertPaylaterCustomer("PEER_TO_PEER_AKULAKU", "id", mk(null))).rejects.toThrow(
    "PAYMENT_CUSTOMER_INCOMPLETE",
  );
  await expect(assertPaylaterCustomer("PEER_TO_PEER_INDODANA", "id", mk({ ...full, email: "" }))).rejects.toThrow(
    "PAYMENT_CUSTOMER_INCOMPLETE",
  );
  seen.length = 0;
  await assertPaylaterCustomer("PEER_TO_PEER_INDODANA", "id", mk(full));
  expect(seen).toEqual(["provider.payment.customer"]);
  seen.length = 0;
  await assertPaylaterCustomer("EMONEY_DANA", "id", mk(null));
  await assertPaylaterCustomer("QRIS", "id", mk(null));
  expect(seen).toEqual([]);
});

it("posts the full paylater request to DOKU but stores only the customer id", async () => {
  envAll();
  const c = fx();
  const op = channelOp("PEER_TO_PEER_KREDIVO");
  const stored: any[] = [];
  const s: System = async (action: string, payload: any = {}) => {
    if (action === "provider.operation") return op as any;
    if (action === "provider.payment.customer")
      return { name: "Sari Dewi", phone: "081234567890", email: "sari@example.com", address: "Jl. Mawar 1", city: "Jakarta", postcode: null, packageName: "Paket" } as any;
    if (action === "provider.direct.submit") {
      stored.push(payload.request);
      return { ...op, request: payload.request, submit: true } as any;
    }
    return undefined as any;
  };
  const req = vi.spyOn(doku, "dokuRequest").mockResolvedValue(checkoutResponse(c, op.reference));
  await submitDirectPayment(c, s);
  expect(stored[0].customer).toEqual({ id: c.id });
  expect(stored[0].line_items).toHaveLength(1);
  expect(stored[0].order.amount).toBe(10000);
  expect(JSON.stringify(stored[0])).not.toContain("Sari");
  expect((req.mock.calls[0][1] as any).customer).toMatchObject({ name: "Sari Dewi", phone: "6281234567890", email: "sari@example.com" });
  expect(req.mock.calls[0][2]).toBe(op.id);
  req.mockClear();
  const retry: System = async (action: string, payload: any = {}) =>
    action === "provider.operation"
      ? (op as any)
      : action === "provider.direct.submit"
        ? ({ ...op, request: payload.request, submit: false } as any)
        : action === "provider.payment.customer"
          ? ({ name: "Sari Dewi", phone: "0812", email: "a@b.c" } as any)
          : (undefined as any);
  await submitDirectPayment(c, retry);
  expect(req).not.toHaveBeenCalled();
});

it("rejects a redirect notification that names another method", () => {
  envAll();
  const op = channelOp("EMONEY_DANA", { state: "pending" });
  const body = (channel?: unknown) => ({
    order: { invoice_number: op.reference, amount: 10000, currency: "IDR" },
    transaction: { status: "SUCCESS", original_request_id: "r1" },
    ...(channel === undefined ? {} : { channel }),
  });
  expect(directPaymentEvent(body({ id: "EMONEY_DANA" }), op, "redirect_notification")?.status).toBe("paid");
  expect(directPaymentEvent(body(), op, "redirect_notification")?.status).toBe("paid");
  expect(directPaymentEvent(body({ id: "SOMETHING_NEW" }), op, "redirect_notification")?.status).toBe("paid");
  expect(() => directPaymentEvent(body({ id: "EMONEY_OVO" }), op, "redirect_notification")).toThrow("DOKU_PAYMENT_MISMATCH");
  expect(() => directPaymentEvent(body({ id: "PEER_TO_PEER_KREDIVO" }), op, "redirect_status")).toThrow("DOKU_PAYMENT_MISMATCH");
  // the hosted path has no expected channel and ignores channel.id
  expect(doku.dokuPaymentEvent(body({ id: "EMONEY_OVO" }), { entity_id: "x", reference: op.reference, amount: 10000 })?.status).toBe("paid");
});
