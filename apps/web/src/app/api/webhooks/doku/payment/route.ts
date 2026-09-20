import { after } from "next/server";
import {
  processDokuInbox,
  recordDokuPayment,
  verifyDokuNotification,
} from "@catera/backend";
export const runtime = "nodejs";
export async function POST(request: Request) {
  // Read bounded bytes before parsing. Never log raw callback bodies.
  if (Number(request.headers.get("content-length") || 0) > 65536)
    return new Response("Too large", { status: 413 });
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
      !verifyDokuNotification(
        request.headers,
        new URL(request.url).pathname,
        raw,
      )
    )
      return new Response("Unauthorized", { status: 401 });
    await recordDokuPayment(JSON.parse(raw));
    // The inbox is durable before acknowledging; scheduled jobs recover failures.
    after(async () => {
      try {
        await processDokuInbox();
      } catch {
        console.warn("DOKU inbox processing deferred to recovery job");
      }
    });
    return Response.json({ received: true });
  } catch {
    // Acknowledge only after durable inbox insertion; DOKU may retry.
    return new Response("Notification could not be recorded", { status: 503 });
  }
}
