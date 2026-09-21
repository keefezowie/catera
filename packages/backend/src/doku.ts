import {
  createHash,
  createHmac,
  randomUUID,
  sign,
  timingSafeEqual,
} from "node:crypto";
import type { Checkout } from "@catera/domain";

// Deliberately no production URL or configurable API host in this evaluation.
const base = "https://api-sandbox.doku.com";
export type ProviderIdentity = {
  provider: string;
  environment: string;
  merchant: string;
};
export function dokuConfig() {
  if (process.env.DOKU_ENVIRONMENT !== "sandbox")
    throw new Error("DOKU_SANDBOX_REQUIRED");
  const client = process.env.DOKU_CLIENT_ID;
  const secret = process.env.DOKU_SECRET_KEY;
  if (!client || !secret) throw new Error("DOKU_NOT_CONFIGURED");
  return { client, secret };
}
export function assertDokuIdentity(identity: ProviderIdentity) {
  const config = dokuConfig();
  if (
    identity.provider !== "doku" ||
    identity.environment !== "sandbox" ||
    identity.merchant !== config.client
  )
    throw new Error("PAYMENT_PROVIDER_IDENTITY_MISMATCH");
  return config;
}
export function nonSnapSignature(
  secret: string,
  client: string,
  requestId: string,
  timestamp: string,
  path: string,
  body?: string,
) {
  const fields = [
    `Client-Id:${client}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${path}`,
  ];
  if (body !== undefined)
    fields.push(`Digest:${createHash("sha256").update(body).digest("base64")}`);
  return (
    "HMACSHA256=" +
    createHmac("sha256", secret).update(fields.join("\n")).digest("base64")
  );
}
function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function verifyDokuNotification(
  headers: Headers,
  path: string,
  raw: string,
) {
  const { client, secret } = dokuConfig();
  const id = headers.get("request-id"),
    timestamp = headers.get("request-timestamp"),
    signature = headers.get("signature");
  // DOKU legitimately retries hours later; durable event deduplication handles replay.
  if (
    headers.get("client-id") !== client ||
    !id ||
    !timestamp ||
    !signature ||
    !Number.isFinite(Date.parse(timestamp))
  )
    return false;
  return equal(
    signature,
    nonSnapSignature(secret, client, id, timestamp, path, raw),
  );
}
export async function dokuRequest(
  path: string,
  body?: unknown,
  requestId: string = randomUUID(),
): Promise<Record<string, any>> {
  const { client, secret } = dokuConfig();
  const raw = body === undefined ? undefined : JSON.stringify(body);
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const response = await fetch(base + path, {
    method: raw === undefined ? "GET" : "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": client,
      "Request-Id": requestId,
      "Request-Timestamp": timestamp,
      Signature: nonSnapSignature(
        secret,
        client,
        requestId,
        timestamp,
        path,
        raw,
      ),
    },
    body: raw,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("DOKU_HTTP_" + response.status);
  return response.json();
}
export function dokuInvoice(checkoutId: string) {
  // Alphanumeric and <30 characters, with 104 bits of entropy from the UUID.
  return (
    "CT" + createHash("sha256").update(checkoutId).digest("hex").slice(0, 26)
  );
}
export function checkoutBody(c: Checkout, profileId: string, now = Date.now()) {
  const origin = process.env.CATERA_PUBLIC_URL;
  if (!origin || new URL(origin).protocol !== "https:")
    throw new Error("NOT_CONFIGURED");
  if (!/^SAC-\d+-\d+$/.test(profileId))
    throw new Error("DOKU_COLLECTION_PROFILE_REQUIRED");
  const minutes = Math.floor((Date.parse(c.expires_at) - now - 30000) / 60000);
  if (minutes < 1) throw new Error("PAYMENT_HOLD_TOO_SHORT");
  const methods = (
    process.env.DOKU_PAYMENT_METHODS || "VIRTUAL_ACCOUNT_BRI,QRIS"
  )
    .split(",")
    .map((x) => x.trim());
  const allowed =
    /^(VIRTUAL_ACCOUNT_[A-Z_]+|QRIS|EMONEY_(OVO|DANA|SHOPEEPAY|LINKAJA))$/;
  if (!methods.length || methods.some((x) => !allowed.test(x)))
    throw new Error("DOKU_CHANNEL_NOT_SUPPORTED");
  return {
    order: {
      amount: c.quote.total,
      invoice_number: dokuInvoice(c.id),
      currency: "IDR",
      language: "ID",
      callback_url: origin + "/return/" + c.id,
      callback_url_cancel: origin + "/return/" + c.id,
      auto_redirect: true,
    },
    payment: { payment_due_date: minutes, payment_method_types: methods },
    // Verified against a real sandbox payment and sub-account pending balance.
    // Checkout requires snake_case here despite the V2 Collect & Route guide.
    additional_info: {
      account: { id: profileId },
      override_notification_url: origin + "/api/webhooks/doku/payment",
    },
  };
}
export function checkoutResult(data: Record<string, any>, deadline: string) {
  const payment = data.response?.payment;
  if (
    !payment?.url ||
    !payment?.token_id ||
    !/^\d{14}$/.test(payment.expired_date || "")
  )
    throw new Error("DOKU_INVALID_RESPONSE");
  const url = new URL(payment.url);
  if (
    url.protocol !== "https:" ||
    !["sandbox.doku.com", "staging.doku.com"].includes(url.hostname) ||
    (url.port !== "" && url.port !== "443") ||
    url.username ||
    url.password
  )
    throw new Error("DOKU_INVALID_CHECKOUT_URL");
  const s = payment.expired_date as string;
  const expiry = Date.parse(
    `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}+07:00`,
  );
  if (
    !Number.isFinite(expiry) ||
    expiry > Date.parse(deadline) ||
    expiry <= Date.now()
  )
    throw new Error("DOKU_EXPIRY_MISMATCH");
  return {
    providerId: String(payment.token_id),
    url: url.href,
    expiresAt: new Date(expiry).toISOString(),
  };
}
export function dokuPaymentEvent(
  data: Record<string, any>,
  operation: { entity_id: string; reference: string; amount: number },
) {
  if (
    data.order?.invoice_number !== operation.reference ||
    Number(data.order?.amount) !== operation.amount ||
    (data.order?.currency !== undefined && data.order.currency !== "IDR")
  )
    throw new Error("DOKU_PAYMENT_MISMATCH");
  const status = data.transaction?.status;
  const paid = status === "SUCCESS";
  const expired =
    data.order?.status === "ORDER_EXPIRED" || status === "EXPIRED";
  if (!paid && !expired) return null; // FAILED is an attempt, not a terminal checkout.
  const transaction = data.transaction?.original_request_id;
  if (paid && !transaction) throw new Error("DOKU_PAYMENT_REFERENCE_MISSING");
  return {
    checkoutId: operation.entity_id,
    providerId: operation.reference,
    paymentRequestId: paid ? String(transaction) : undefined,
    eventId: `doku:sandbox:${operation.reference}:${paid ? "paid:" + transaction : "expired"}`,
    status: paid ? "paid" : "expired",
    amount: operation.amount,
    currency: "IDR",
  };
}
export function snapSignature(
  secret: string,
  path: string,
  token: string,
  timestamp: string,
  raw: string,
) {
  const digest = createHash("sha256").update(raw).digest("hex");
  return createHmac("sha512", secret)
    .update(`POST:${path}:${token}:${digest}:${timestamp}`)
    .digest("base64");
}
export function verifyDokuSnapNotification(
  headers: Headers,
  path: string,
  raw: string,
) {
  const { client, secret } = dokuConfig();
  const timestamp = headers.get("x-timestamp"),
    signature = headers.get("x-signature"),
    authorization = headers.get("authorization");
  if (
    headers.get("x-partner-id") !== client ||
    !timestamp ||
    !Number.isFinite(Date.parse(timestamp)) ||
    !signature ||
    !authorization?.startsWith("Bearer ")
  )
    return false;
  try {
    return equal(
      signature,
      snapSignature(
        secret,
        path,
        authorization.slice(7),
        timestamp,
        JSON.stringify(JSON.parse(raw)),
      ),
    );
  } catch {
    return false;
  }
}
export async function dokuToken() {
  const { client } = dokuConfig();
  const key = process.env.DOKU_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!key) throw new Error("DOKU_SNAP_NOT_CONFIGURED");
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const response = await fetch(base + "/authorization/v1/access-token/b2b", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      "X-CLIENT-KEY": client,
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": sign(
        "RSA-SHA256",
        Buffer.from(client + "|" + timestamp),
        key,
      ).toString("base64"),
    },
    body: JSON.stringify({ grantType: "client_credentials" }),
  });
  if (!response.ok) throw new Error("DOKU_TOKEN_HTTP_" + response.status);
  const data = await response.json();
  if (!data.accessToken || !String(data.responseCode).startsWith("200"))
    throw new Error("DOKU_TOKEN_FAILED");
  return String(data.accessToken);
}
export async function dokuSnap(
  path: string,
  body: unknown,
  externalId: string,
  channelId?: "H2H",
): Promise<Record<string, any>> {
  const { client, secret } = dokuConfig();
  const token = await dokuToken(),
    timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    raw = JSON.stringify(body);
  const response = await fetch(base + path, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      "X-PARTNER-ID": client,
      "X-TIMESTAMP": timestamp,
      "X-EXTERNAL-ID": externalId,
      ...(channelId ? { "CHANNEL-ID": channelId } : {}),
      "X-SIGNATURE": snapSignature(secret, path, token, timestamp, raw),
    },
    body: raw,
  });
  if (!response.ok) throw new Error("DOKU_SNAP_HTTP_" + response.status);
  const data = await response.json();
  if (!String(data.responseCode).startsWith("200"))
    throw new Error(
      "DOKU_SNAP_" +
        String(data.responseCode)
          .replace(/[^0-9]/g, "")
          .slice(0, 7),
    );
  return data;
}
export function refundBlocker(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 10000 || amount > 25000000)
    return "DOKU_REFUND_AMOUNT_UNSUPPORTED";
  return "DOKU_REFUND_SERVICE_CONTRACT_REQUIRED";
}
