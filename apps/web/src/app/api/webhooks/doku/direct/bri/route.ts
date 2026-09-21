import { after } from "next/server";
import {
  dokuConfig,
  processDokuInbox,
  rpc,
  storeDirectEvent,
  verifyDokuSnapNotification,
  type ProviderOperation,
} from "@catera/backend";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return new Response("Missing body", { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      return new Response("Too large", { status: 413 });
    }
    chunks.push(value);
  }
  try {
    const raw = Buffer.concat(chunks).toString("utf8");
    if (
      !verifyDokuSnapNotification(
        request.headers,
        new URL(request.url).pathname,
        raw,
      )
    )
      return new Response("Unauthorized", { status: 401 });
    const data = JSON.parse(raw);
    if (typeof data.trxId !== "string")
      return new Response("Invalid reference", { status: 400 });
    const system = <T = unknown>(action: string, payload: unknown = {}) =>
      rpc<T>(null, null, "catera_v1_system", { action, payload }, true);
    const op = await system<ProviderOperation | null>("provider.operation", {
      reference: data.trxId,
      merchant: dokuConfig().client,
    });
    if (!op || op.kind !== "payment" || op.payment_mode !== "direct")
      return new Response("Unknown payment", { status: 400 });
    await storeDirectEvent(data, op, "bri_notification", system);
    after(async () => {
      try {
        await processDokuInbox();
      } catch {
        console.warn("DOKU direct inbox awaiting recovery");
      }
    });
    return Response.json({
      responseCode: "2002500",
      responseMessage: "Success",
      virtualAccountData: {
        partnerServiceId: data.partnerServiceId,
        customerNo: data.customerNo,
        virtualAccountNo: data.virtualAccountNo,
        virtualAccountName: data.virtualAccountName,
        paymentRequestId: data.paymentRequestId,
        paidAmount: data.paidAmount,
      },
    });
  } catch {
    console.warn(
      JSON.stringify({
        event: "payment.direct.notification_failed",
        channel: "VIRTUAL_ACCOUNT_BRI",
      }),
    );
    return new Response("Notification could not be recorded", { status: 503 });
  }
}
