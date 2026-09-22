import type {
  Checkout,
  DirectPaymentMethod,
  PaymentAvailability,
} from "@catera/domain";
import { assertDokuIdentity, dokuSnap } from "./doku";
import type { ProviderOperation, System } from "./payment-provider";

export const directPaths = {
  VIRTUAL_ACCOUNT_BRI:
    "/virtual-accounts/bi-snap-va/v1.1/transfer-va/create-va",
  QRIS: "/snap-adapter/b2b/v1.0/qr/qr-mpm-generate",
} as const;
const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error("PAYMENT_UNAVAILABLE");
  return value;
};
export function directMethodReady(method: DirectPaymentMethod) {
  const prefix = method === "QRIS" ? "DOKU_DIRECT_QRIS" : "DOKU_DIRECT_BRI";
  const keys =
    method === "QRIS"
      ? [
          "DOKU_QRIS_MERCHANT_ID",
          "DOKU_QRIS_TERMINAL_ID",
          "DOKU_QRIS_POSTAL_CODE",
        ]
      : ["DOKU_BRI_PARTNER_SERVICE_ID", "DOKU_BRI_CUSTOMER_PREFIX"];
  return (
    process.env.DOKU_ENVIRONMENT === "sandbox" &&
    process.env.CATERA_CONTROLLED_COLLECTION === "true" &&
    process.env.DOKU_COLLECTION_ENABLED === "true" &&
    [
      "ENABLED",
      "CONTRACT_VERIFIED",
      "ROUTING_VERIFIED",
      "CALLBACK_VERIFIED",
    ].every((k) => process.env[`${prefix}_${k}`] === "true") &&
    [
      "DOKU_CLIENT_ID",
      "DOKU_SECRET_KEY",
      "DOKU_PRIVATE_KEY",
      "DOKU_COLLECTION_PROFILE_ID",
      ...keys,
    ].every((k) => !!process.env[k])
  );
}
export function filterPaymentAvailability<T extends PaymentAvailability>(
  view: T,
): T {
  return {
    ...view,
    availableMethods: view.availableMethods.filter(directMethodReady),
  };
}
export function enrichDirectCheckout(c: Checkout): Checkout {
  return c.payment
    ? { ...c, payment: filterPaymentAvailability(c.payment) }
    : c;
}
const amount = (value: number) => ({ value: `${value}.00`, currency: "IDR" });
function checkAmount(value: any, expected: number) {
  if (
    !value ||
    value.currency !== "IDR" ||
    // QRIS inquiry returns an integer JSON number in the verified sandbox
    // contract; SNAP VA responses use a decimal string.
    !(typeof value.value === "number"
      ? Number.isSafeInteger(value.value)
      : typeof value.value === "string" && /^\d+\.00$/.test(value.value)) ||
    Number(value.value) !== expected
  )
    throw new Error("DOKU_PAYMENT_MISMATCH");
}
function expiry(value: unknown, deadline: string) {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    Date.parse(value) > Date.parse(deadline) ||
    Date.parse(value) <= Date.now()
  )
    throw new Error("DOKU_EXPIRY_MISMATCH");
  return new Date(value).toISOString();
}
export function directRequest(c: Checkout, op: ProviderOperation) {
  if (Date.parse(c.expires_at) - Date.now() < 60000)
    throw new Error("PAYMENT_HOLD_TOO_SHORT");
  const expiresAt = new Date(
    Math.floor((Date.parse(c.expires_at) - 30000) / 1000) * 1000,
  )
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  // Direct API uses camelCase additionalInfo (Checkout uses additional_info).
  // DOKU silently accepts invalid routing IDs, so reject malformed IDs locally;
  // activation still requires independent collection balance evidence.
  const profileId = required("DOKU_COLLECTION_PROFILE_ID");
  if (!/^SAC-\d+-\d+$/.test(profileId))
    throw new Error("DOKU_COLLECTION_PROFILE_REQUIRED");
  const account = { id: profileId };
  if (op.channel === "VIRTUAL_ACCOUNT_BRI") {
    const partnerServiceId = required("DOKU_BRI_PARTNER_SERVICE_ID").padStart(
      8,
      " ",
    );
    const customerNo = required("DOKU_BRI_CUSTOMER_PREFIX");
    if (
      !/^\s*\d{1,8}$/.test(partnerServiceId) ||
      !/^\d{1,20}$/.test(customerNo)
    )
      throw new Error("PAYMENT_UNAVAILABLE");
    return {
      partnerServiceId,
      customerNo,
      virtualAccountNo: partnerServiceId + customerNo,
      virtualAccountName: "Catera",
      trxId: op.reference,
      virtualAccountTrxType: "C",
      totalAmount: amount(c.quote.total),
      expiredDate: expiresAt,
      additionalInfo: {
        account,
        channel: op.channel,
        virtualAccountConfig: { reusableStatus: false },
      },
    };
  }
  if (op.channel !== "QRIS") throw new Error("DOKU_CHANNEL_NOT_SUPPORTED");
  return {
    partnerReferenceNo: op.reference,
    amount: amount(c.quote.total),
    merchantId: required("DOKU_QRIS_MERCHANT_ID"),
    terminalId: required("DOKU_QRIS_TERMINAL_ID"),
    validityPeriod: expiresAt,
    additionalInfo: {
      account,
      postalCode: required("DOKU_QRIS_POSTAL_CODE"),
      feeType: "1",
    },
  };
}

export function validateQr(content: unknown, expected: number) {
  if (
    typeof content !== "string" ||
    content.length > 2048 ||
    !/6304[0-9A-Fa-f]{4}$/.test(content)
  )
    throw new Error("DOKU_INVALID_QR");
  const fields = new Map<string, string>();
  for (let i = 0; i < content.length;) {
    const id = content.slice(i, i + 2),
      lenText = content.slice(i + 2, i + 4),
      len = Number(lenText);
    if (
      !/^\d{2}$/.test(id) ||
      !/^\d{2}$/.test(lenText) ||
      i + 4 + len > content.length ||
      fields.has(id)
    )
      throw new Error("DOKU_INVALID_QR");
    fields.set(id, content.slice(i + 4, i + 4 + len));
    i += 4 + len;
  }
  let crc = 0xffff;
  for (const byte of Buffer.from(content.slice(0, -4), "utf8")) {
    crc ^= byte << 8;
    for (let j = 0; j < 8; j++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  if (
    crc.toString(16).padStart(4, "0").toUpperCase() !==
      content.slice(-4).toUpperCase() ||
    fields.get("00") !== "01" ||
    fields.get("01") !== "12" ||
    fields.get("53") !== "360" ||
    fields.get("58") !== "ID" ||
    !/^\d+(?:\.\d{1,2})?$/.test(fields.get("54") || "") ||
    Number(fields.get("54")) !== expected
  )
    throw new Error("DOKU_INVALID_QR");
  return content;
}
export function directResult(
  data: Record<string, any>,
  c: Checkout,
  op: ProviderOperation,
) {
  if (op.channel === "VIRTUAL_ACCOUNT_BRI") {
    const va = data.virtualAccountData;
    if (
      data.responseCode !== "2002700" ||
      va?.trxId !== op.reference ||
      va?.virtualAccountTrxType !== "C" ||
      (va?.additionalInfo?.channel !== undefined &&
        va.additionalInfo.channel !== op.channel) ||
      typeof va?.virtualAccountNo !== "string" ||
      !/^\d{5,28}$/.test(va.virtualAccountNo.trim()) ||
      va.partnerServiceId !== op.request.partnerServiceId ||
      typeof va.customerNo !== "string" ||
      !va.customerNo.startsWith(op.request.customerNo) ||
      va.virtualAccountNo !== va.partnerServiceId + va.customerNo ||
      typeof va.virtualAccountName !== "string"
    )
      throw new Error("DOKU_INVALID_RESPONSE");
    checkAmount(va.totalAmount, op.amount);
    return {
      expiresAt: expiry(va.expiredDate, c.expires_at),
      instructions: {
        kind: "virtual_account",
        bank: "BRI",
        accountNumber: va.virtualAccountNo.trim(),
        accountName: va.virtualAccountName,
      },
      // Stored privately for status inquiry; not part of the public payment view.
      virtualAccount: {
        partnerServiceId: va.partnerServiceId,
        customerNo: va.customerNo,
        virtualAccountNo: va.virtualAccountNo,
      },
    };
  }
  if (
    data.responseCode !== "2004700" ||
    data.partnerReferenceNo !== op.reference ||
    typeof data.referenceNo !== "string" ||
    !data.referenceNo ||
    data.terminalId !== op.request.terminalId
  )
    throw new Error("DOKU_INVALID_RESPONSE");
  return {
    providerReference: data.referenceNo,
    expiresAt: expiry(data.additionalInfo?.validityPeriod, c.expires_at),
    instructions: {
      kind: "qris",
      qrContent: validateQr(data.qrContent, op.amount),
    },
  };
}
export async function submitDirectPayment(c: Checkout, sys: System) {
  let op = await sys<ProviderOperation>("provider.operation", {
    kind: "payment",
    id: c.id,
  });
  if (!op || op.payment_mode !== "direct" || op.state !== "preparing") return;
  assertDokuIdentity(op);
  if (!op.channel || !directMethodReady(op.channel))
    throw new Error("PAYMENT_UNAVAILABLE");
  const request = directRequest(c, op);
  op = await sys<ProviderOperation>("provider.direct.submit", {
    id: c.id,
    request,
  });
  if (!op.submit) return;
  try {
    const data = await dokuSnap(
      directPaths[op.channel!],
      op.request,
      await sys<string>("provider.externalId"),
      "H2H",
    );
    await sys("provider.direct.attached", {
      id: c.id,
      result: directResult(data, c, op),
    });
  } catch (e) {
    const code =
      e instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(e.message)
        ? e.message
        : "DOKU_NETWORK_UNCERTAIN";
    await sys("provider.error", { kind: "payment", id: c.id, code });
    console.warn(
      JSON.stringify({
        event: "payment.direct.unresolved",
        checkoutId: c.id,
        code,
      }),
    );
    // A possibly-created instrument must never be resubmitted.
  }
}
export function directPaymentEvent(
  data: Record<string, any>,
  op: ProviderOperation,
  source:
    "bri_notification" | "qris_notification" | "bri_status" | "qris_status",
) {
  let transaction: string | undefined;
  if (source.startsWith("bri")) {
    if (op.channel !== "VIRTUAL_ACCOUNT_BRI")
      throw new Error("DOKU_PAYMENT_MISMATCH");
    const va = source === "bri_notification" ? data : data.virtualAccountData;
    const reference = va?.trxId ?? data.additionalInfo?.trxId;
    if (
      reference !== op.reference ||
      va?.partnerServiceId !== op.request.partnerServiceId ||
      typeof va?.customerNo !== "string" ||
      !va.customerNo.startsWith(op.request.customerNo) ||
      va.virtualAccountNo !== va.partnerServiceId + va.customerNo ||
      (op.result.virtualAccount &&
        va.virtualAccountNo !== op.result.virtualAccount.virtualAccountNo)
    )
      throw new Error("DOKU_PAYMENT_MISMATCH");
    // The documented pending example contains paidAmount; amount alone is not payment proof.
    // DOKU documents paymentRequestId as present when payment happened.
    if (
      source === "bri_status" &&
      (!va?.paymentRequestId ||
        /pending|unpaid/i.test(va.paymentFlagReason?.english || ""))
    )
      return null;
    if (
      source === "bri_notification" &&
      va.additionalInfo?.channel !== op.channel
    )
      throw new Error("DOKU_PAYMENT_MISMATCH");
    checkAmount(va.paidAmount, op.amount);
    transaction = va.paymentRequestId;
  } else {
    if (op.channel !== "QRIS") throw new Error("DOKU_PAYMENT_MISMATCH");
    if (source === "qris_notification") {
      if (
        data.order?.invoice_number !== op.reference ||
        data.channel?.id !== "QRIS_DOKU" ||
        data.service?.id !== "QRIS" ||
        // DOKU's QRIS sandbox sends its numeric acquirer ID; older samples
        // use the name. Accept only these two verified DOKU identifiers.
        !["DOKU", "93600899"].includes(data.acquirer?.id)
      )
        throw new Error("DOKU_PAYMENT_MISMATCH");
      if (data.transaction?.status !== "SUCCESS") return null;
      if (
        Number(data.order.amount) !== op.amount ||
        (data.order.currency !== undefined && data.order.currency !== "IDR")
      )
        throw new Error("DOKU_PAYMENT_MISMATCH");
      transaction = data.emoney_payment?.approval_code;
    } else {
      if (
        data.originalPartnerReferenceNo !== op.reference ||
        data.originalReferenceNo !== op.result.providerReference ||
        data.serviceCode !== "47"
      )
        throw new Error("DOKU_PAYMENT_MISMATCH");
      if (data.latestTransactionStatus !== "00") return null;
      checkAmount(data.amount, op.amount);
      transaction = data.additionalInfo?.approvalCode;
    }
  }
  if (
    typeof transaction !== "string" ||
    !transaction ||
    transaction.length > 128
  )
    throw new Error("DOKU_PAYMENT_REFERENCE_MISSING");
  return {
    checkoutId: op.entity_id,
    providerId: op.reference,
    paymentRequestId: transaction,
    eventId: `doku:sandbox:direct:${op.reference}:paid:${transaction}`,
    status: "paid",
    amount: op.amount,
    currency: "IDR",
  };
}
export async function storeDirectEvent(
  data: Record<string, any>,
  op: ProviderOperation,
  source: Parameters<typeof directPaymentEvent>[2],
  sys: System,
) {
  assertDokuIdentity(op);
  const event = directPaymentEvent(data, op, source);
  if (event)
    await sys("provider.inbox.receive", {
      operationId: op.id,
      eventId: `${op.merchant}:${event.eventId}`,
      event,
    });
}
export async function reconcileDirectPayment(
  op: ProviderOperation,
  sys: System,
) {
  assertDokuIdentity(op);
  if (op.state === "preparing") return; // No instrument exists until the customer submits again.
  if (op.channel === "VIRTUAL_ACCOUNT_BRI") {
    if (!op.result.virtualAccount)
      throw new Error("DOKU_DIRECT_REFERENCE_UNRESOLVED");
    const data = await dokuSnap(
      "/orders/v1.0/transfer-va/status",
      { ...op.result.virtualAccount, additionalInfo: {} },
      await sys<string>("provider.externalId"),
      "H2H",
    );
    await storeDirectEvent(data, op, "bri_status", sys);
  } else if (op.channel === "QRIS") {
    if (!op.result.providerReference)
      throw new Error("DOKU_DIRECT_REFERENCE_UNRESOLVED");
    const data = await dokuSnap(
      "/snap-adapter/b2b/v1.0/qr/qr-mpm-query",
      {
        originalReferenceNo: op.result.providerReference,
        originalPartnerReferenceNo: op.reference,
        serviceCode: "47",
        merchantId: op.request.merchantId,
      },
      await sys<string>("provider.externalId"),
      "H2H",
    );
    await storeDirectEvent(data, op, "qris_status", sys);
  }
}
