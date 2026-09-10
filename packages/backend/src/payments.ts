import { timingSafeEqual } from "node:crypto";
import type { Checkout } from "@catera/domain";
export function verifyCallback(actual: string | null) {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!actual || !expected) return false;
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function xendit(
  path: string,
  body: unknown,
  idempotency: string,
  headers: Record<string, string> = {},
) {
  const key = process.env.XENDIT_SECRET_KEY;
  if (!key) throw new Error("NOT_CONFIGURED");
  const r = await fetch("https://api.xendit.co" + path, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
      "Content-Type": "application/json",
      "idempotency-key": idempotency,
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("PAYMENT_PROVIDER_" + r.status);
  return r.json();
}
export async function createPaymentSession(c: Checkout) {
  const origin = process.env.CATERA_PUBLIC_URL;
  if (!origin?.startsWith("https://")) throw new Error("NOT_CONFIGURED");
  if (new Date(c.expires_at).getTime() - Date.now() < 600000)
    throw new Error("PAYMENT_HOLD_TOO_SHORT");
  const route = JSON.parse(process.env.CATERA_XENDIT_ROUTING_JSON || "{}")[
    c.quote.offer.catererId
  ];
  const headers: Record<string, string> = {};
  if (route?.accountId) headers["for-user-id"] = route.accountId;
  if (route?.splitRuleId) headers["with-split-rule"] = route.splitRuleId;
  const data = await xendit(
    "/sessions",
    {
      reference_id: c.id,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: c.quote.total,
      currency: "IDR",
      country: "ID",
      expires_at: c.expires_at,
      locale: "id",
      description: c.quote.offer.name,
      success_return_url: origin + "/return/" + c.id,
      cancel_return_url: origin + "/return/" + c.id,
      metadata: { checkout_id: c.id },
    },
    c.id,
    headers,
  );
  return {
    providerId: data.payment_session_id as string,
    url: data.payment_link_url as string,
  };
}
export async function createRefund(refund: {
  id: string;
  amount: number;
  payment: { provider_id: string };
}) {
  return xendit(
    "/refunds",
    {
      payment_request_id: refund.payment.provider_id,
      amount: refund.amount,
      reason: "REQUESTED_BY_CUSTOMER",
      reference_id: refund.id,
    },
    refund.id,
  );
}
export async function createPayout(payout: {
  id: string;
  amount: number;
  caterer_id: string;
}) {
  const config = JSON.parse(process.env.CATERA_PAYOUT_RECIPIENTS_JSON || "{}")[
    payout.caterer_id
  ];
  if (!config?.recipient || !config?.purposeCode)
    throw new Error("PAYOUT_RECIPIENT_NOT_CONFIGURED");
  return xendit(
    "/v3/payouts",
    {
      reference_id: payout.id,
      recipient: config.recipient,
      payout_details: {
        source_currency: "IDR",
        source_amount: payout.amount,
        destination_currency: "IDR",
      },
      source_of_fund: "BUSINESS_REVENUE",
      purpose_code: config.purposeCode,
      description: "Catera approved seller settlement",
    },
    payout.id,
    { "api-version": "2025-09-01" },
  );
}
// Optional xenPlatform routing. The approved settlement topology supplies account IDs;
// a caller cannot substitute bank or sub-account destinations in a checkout command.
export async function createSplitRule(
  checkout: Checkout,
  destinationAccountId: string,
  amount: number,
) {
  if (
    !Number.isInteger(amount) ||
    amount <= 0 ||
    amount >= checkout.quote.total
  )
    throw new Error("SPLIT_AMOUNT_INVALID");
  const data = await xendit(
    "/split_rules",
    {
      name: "Catera " + checkout.id,
      description: "Immutable purchase allocation",
      routes: [
        {
          flat_amount: amount,
          currency: "IDR",
          destination_account_id: destinationAccountId,
          reference_id: checkout.id,
        },
      ],
    },
    "split-" + checkout.id,
  );
  return data.id as string;
}
