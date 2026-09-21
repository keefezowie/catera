import type { Checkout } from "@catera/domain";
import { rpc } from "./database";
import * as xendit from "./payments";
import {
  assertDokuIdentity,
  checkoutBody,
  checkoutResult,
  dokuConfig,
  dokuInvoice,
  dokuPaymentEvent,
  dokuRequest,
  dokuSnap,
  refundBlocker,
  type ProviderIdentity,
} from "./doku";
export type System = <T = unknown>(
  action: string,
  payload?: unknown,
) => Promise<T>;
const system: System = (action, payload = {}) =>
  rpc(null, null, "catera_v1_system", { action, payload }, true);
export type ProviderOperation = ProviderIdentity & {
  id: string;
  kind: string;
  entity_id: string;
  reference: string;
  amount: number;
  state: string;
  request: Record<string, any>;
  result: Record<string, any>;
  submit?: boolean;
  lease_token: string;
};
function errorCode(error: unknown) {
  const code =
    error instanceof Error ? error.message : "PROVIDER_RECONCILIATION_FAILED";
  return /^[A-Z][A-Z0-9_]{1,99}$/.test(code)
    ? code
    : "PROVIDER_NETWORK_UNCERTAIN";
}
export async function createPaymentSession(c: Checkout, sys: System = system) {
  if (!c.terms_accepted_at || !c.terms_version) throw new Error("TERMS_REQUIRED");
  if (c.provider !== "doku") return xendit.createPaymentSession(c);
  assertDokuIdentity({
    provider: c.provider,
    environment: c.provider_environment || "",
    merchant: c.provider_merchant || "",
  });
  const existing = await sys<ProviderOperation | null>("provider.operation", {
    kind: "payment",
    id: c.id,
  });
  if (existing?.result.url)
    return { providerId: existing.reference, url: String(existing.result.url) };
  if (existing) throw new Error("DOKU_PAYMENT_RECONCILIATION_REQUIRED");
  if (
    process.env.DOKU_COLLECTION_ENABLED !== "true" ||
    process.env.CATERA_CONTROLLED_COLLECTION !== "true" ||
    process.env.DOKU_ROUTING_VERIFIED !== "true"
  )
    throw new Error("DOKU_COLLECTION_DISABLED");
  const request = checkoutBody(c, process.env.DOKU_COLLECTION_PROFILE_ID || "");
  const op = await sys<ProviderOperation>("provider.payment.claim", {
    id: c.id,
    merchant: c.provider_merchant,
    reference: dokuInvoice(c.id),
    request,
  });
  if (!op.submit) throw new Error("DOKU_PAYMENT_RECONCILIATION_REQUIRED");
  try {
    const result = checkoutResult(
      await dokuRequest("/checkout/v1/payment", op.request, op.id),
      c.expires_at,
    );
    await sys("provider.payment.attached", { id: c.id, result });
    return { providerId: op.reference, url: result.url };
  } catch (error) {
    await sys("provider.error", {
      kind: "payment",
      id: c.id,
      code: errorCode(error),
    });
    throw error;
  }
}
export async function attachPayment(
  c: Checkout,
  result: { providerId: string; url: string },
  sys: System = system,
) {
  if (c.provider !== "doku")
    await sys("payment.attach", { id: c.id, ...result });
}
export async function recordDokuPayment(
  data: Record<string, any>,
  sys: System = system,
) {
  const { client } = dokuConfig();
  if (typeof data.order?.invoice_number !== "string")
    throw new Error("DOKU_UNKNOWN_PAYMENT");
  const op = await sys<ProviderOperation | null>("provider.operation", {
    reference: data.order.invoice_number,
    merchant: client,
  });
  if (!op || op.kind !== "payment") throw new Error("DOKU_UNKNOWN_PAYMENT");
  assertDokuIdentity(op);
  const event = dokuPaymentEvent(data, op);
  if (event)
    await sys("provider.inbox.receive", {
      operationId: op.id,
      eventId: `${client}:${event.eventId}`,
      event,
    });
}
export async function processDokuInbox(sys: System = system) {
  const events = await sys<{ id: string }[]>("provider.inbox.claim");
  let failed = 0;
  for (const event of events) {
    try {
      await sys("provider.inbox.apply", { id: event.id });
    } catch (error) {
      failed++;
      await sys("provider.inbox.error", {
        id: event.id,
        code: errorCode(error),
      });
    }
  }
  return { processed: events.length - failed, failed };
}
export async function reconcileDoku(sys: System = system) {
  const inbox = await processDokuInbox(sys);
  const deadline = Date.now() + 60000;
  let failed = 0,
    checked = 0;
  for (const kind of ["payment", "payout"]) {
    const operations = await sys<ProviderOperation[]>("provider.pending", {
      kind,
    });
    for (const op of operations) {
      if (Date.now() >= deadline) break;
      checked++;
      try {
        assertDokuIdentity(op);
        if (kind === "payment")
          await recordDokuPayment(
            await dokuRequest(
              "/orders/v1/status/" + encodeURIComponent(op.reference),
            ),
            sys,
          );
        else if (op.state === "preparing")
          await submitDokuPayout(
            await sys("payout.lookup", { id: op.entity_id }),
            op,
            sys,
          );
        else await reconcileDokuPayout(op, sys);
      } catch (error) {
        failed++;
        await sys("provider.error", {
          kind,
          id: op.entity_id,
          code: errorCode(error),
        });
      }
    }
  }
  return { checked, failed, inbox, applied: await processDokuInbox(sys) };
}
export async function createRefund(
  refund: Parameters<typeof xendit.createRefund>[0] & {
    provider?: string | null;
  },
  sys: System = system,
) {
  if (refund.provider === null)
    throw new Error("HISTORICAL_PROVIDER_REVIEW_REQUIRED");
  if (refund.provider !== "doku") return xendit.createRefund(refund);
  await sys("provider.refund.block", {
    id: refund.id,
    reason: refundBlocker(refund.amount),
  });
  return { id: null, status: "NEEDS_ATTENTION" };
}
export async function createPayout(
  payout: Parameters<typeof xendit.createPayout>[0],
) {
  const source = await system<ProviderIdentity>("provider.payout.identity", {
    id: payout.id,
  });
  if (source.provider === "doku")
    throw new Error("DOKU_EARNED_PAYOUT_ROUTE_REQUIRED");
  return xendit.createPayout(payout);
}
const snap = async (path: string, body: unknown, sys: System) =>
  dokuSnap(
    "/sub-account/v2.0/" + path,
    body,
    await sys<string>("provider.externalId"),
  );
export async function submitDokuPayout(
  p: { id: string; amount: number; caterer_id: string },
  source: ProviderIdentity,
  sys: System = system,
) {
  assertDokuIdentity(source);
  const existing = await sys<ProviderOperation | null>("provider.operation", {
    id: p.id,
    kind: "payout",
  });
  if (existing && existing.state !== "preparing") {
    await reconcileDokuPayout(existing, sys);
    return;
  }
  if (
    process.env.DOKU_PAYOUTS_ENABLED !== "true" ||
    process.env.DOKU_PAYOUT_CONTRACT_VERIFIED !== "true"
  )
    throw new Error("DOKU_PAYOUTS_DISABLED");
  const destination = await sys<{
    version: number;
    accountNumber: string;
    holder: string;
    bankCode: string;
  } | null>("provider.payout.destination", { catererId: p.caterer_id });
  if (
    !destination?.accountNumber ||
    !destination.bankCode ||
    !destination.holder
  )
    throw new Error("PAYOUT_RECIPIENT_NOT_CONFIGURED");
  const fromAccount = process.env.DOKU_COLLECTION_ACCOUNT_NO;
  if (!fromAccount || !/^\d{1,22}$/.test(fromAccount))
    throw new Error("DOKU_COLLECTION_ACCOUNT_REQUIRED");
  const proposed = {
    partnerReferenceNo: p.id,
    type: "BANK_ACCOUNT",
    channel: "BI_FAST",
    fromAccount,
    beneficiaryBankCode: destination.bankCode,
    beneficiaryAccountNumber: destination.accountNumber,
    amount: { value: `${p.amount}.00`, currency: "IDR" },
  };
  const op = await sys<ProviderOperation | null>("provider.payout.claim", {
    id: p.id,
    merchant: source.merchant,
    request: {
      ...proposed,
      expectedName: destination.holder,
      destinationVersion: destination.version,
      collectionProfile: process.env.DOKU_COLLECTION_PROFILE_ID,
    },
  });
  if (!op) return;
  if (!op.submit) throw new Error("DOKU_PAYOUT_BUSY");
  const {
    expectedName,
    destinationVersion: _version,
    collectionProfile,
    ...request
  } = op.request;
  try {
    const balances = await snap(
      "balance-inquiries",
      { profileId: collectionProfile, accounts: [request.fromAccount] },
      sys,
    );
    if (balances.profileId !== collectionProfile)
      throw new Error("DOKU_COLLECTION_PROFILE_MISMATCH");
    const account = balances.accounts?.find(
      (a: Record<string, any>) =>
        a.accountNo === request.fromAccount &&
        a.type === "DOKU_MERCHANT_IDR" &&
        a.currency === "IDR",
    );
    const available = account?.balance?.available;
    const feeReserve = process.env.DOKU_PAYOUT_FEE_RESERVE_IDR;
    if (
      !feeReserve ||
      !/^\d+$/.test(feeReserve) ||
      !/^\d+(\.\d{1,2})?$/.test(String(available))
    )
      throw new Error("DOKU_BALANCE_CONTRACT_REQUIRED");
    const [whole, fraction = ""] = String(available).split(".");
    const availableCents =
      BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
    if (availableCents < (BigInt(op.amount) + BigInt(feeReserve)) * 100n)
      throw new Error("DOKU_INSUFFICIENT_FUNDING");
    const inquiry = await snap("transfer-inquiry", request, sys);
    validateInquiry(inquiry, request, expectedName);
    const payment = {
      ...request,
      referenceNo: inquiry.referenceNo,
      beneficiaryAccountName: inquiry.beneficiaryAccountName,
    };
    await sys("provider.payout.capture", {
      id: p.id,
      leaseToken: op.lease_token,
      result: { request: payment, referenceNo: inquiry.referenceNo },
    });
    await snap("transfer-payment", payment, sys);
    await reconcileDokuPayout(
      { ...op, result: { request: payment, referenceNo: inquiry.referenceNo } },
      sys,
    );
  } catch (error) {
    await sys("provider.error", {
      kind: "payout",
      id: p.id,
      leaseToken: op.lease_token,
      code: errorCode(error),
    });
    throw error;
  }
}
export function validateInquiry(
  data: Record<string, any>,
  request: Record<string, any>,
  expectedName: string,
) {
  for (const key of [
    "partnerReferenceNo",
    "fromAccount",
    "beneficiaryBankCode",
    "beneficiaryAccountNumber",
  ]) {
    if (data[key] !== request[key]) throw new Error("DOKU_PAYOUT_MISMATCH");
  }
  if (
    !data.referenceNo ||
    data.amount?.currency !== "IDR" ||
    Number(data.amount?.value) !== Number(request.amount.value) ||
    String(data.beneficiaryAccountName).trim().toUpperCase() !==
      expectedName.trim().toUpperCase()
  )
    throw new Error("DOKU_BENEFICIARY_REVIEW_REQUIRED");
}
export async function reconcileDokuPayout(
  op: ProviderOperation,
  sys: System = system,
) {
  assertDokuIdentity(op);
  const data = await snap(
    "transactions-status",
    { partnerReferenceNo: op.reference },
    sys,
  );
  if (
    data.partnerReferenceNo !== op.reference ||
    data.amount?.currency !== "IDR" ||
    Number(data.amount?.value) !== op.amount
  )
    throw new Error("DOKU_PAYOUT_MISMATCH");
  const statuses: Record<string, string> = {
    "00": "succeeded",
    "03": "pending",
    "04": "reversed",
    "06": "failed",
  };
  const status = statuses[data.latestTransactionStatus];
  if (!status || !op.result.referenceNo)
    throw new Error("DOKU_PAYOUT_RECONCILIATION_REQUIRED");
  await sys("provider.payout.event", {
    id: op.entity_id,
    providerId: op.result.referenceNo,
    amount: op.amount,
    currency: "IDR",
    status,
    eventKey: `doku:${op.merchant}:${op.reference}:${status}`,
  });
}
