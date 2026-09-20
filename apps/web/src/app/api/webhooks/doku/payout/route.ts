import { rpc, dokuConfig, verifyDokuSnapNotification } from "@catera/backend";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (process.env.DOKU_PAYOUT_CALLBACK_VERIFIED !== "true")
    return new Response("Callback contract not verified", { status: 503 });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Missing body", { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 65536) {
      await reader.cancel();
      return new Response("Too large", { status: 413 });
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    if (
      !verifyDokuSnapNotification(
        request.headers,
        new URL(request.url).pathname,
        raw,
      )
    )
      return new Response("Unauthorized", { status: 401 });
    const data = JSON.parse(raw);
    if (typeof data.partnerReferenceNo !== "string")
      return new Response("Missing reference", { status: 400 });
    // A notification schedules authenticated reconciliation; it never authorizes a payout itself.
    await rpc(
      null,
      null,
      "catera_v1_system",
      {
        action: "provider.payout.wake",
        payload: {
          reference: data.partnerReferenceNo,
          merchant: dokuConfig().client,
        },
      },
      true,
    );
    return Response.json({
      responseCode: "2000000",
      responseMessage: "Successful",
    });
  } catch {
    return new Response("Notification could not be recorded", { status: 503 });
  }
}
