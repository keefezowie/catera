import { issueDokuNotificationToken } from "@catera/backend";
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
    if (size > 4096) {
      await reader.cancel();
      return new Response("Too large", { status: 413 });
    }
    chunks.push(value);
  }
  try {
    const result = issueDokuNotificationToken(
      request.headers,
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    return Response.json(
      result ?? { responseCode: "4017300", responseMessage: "Unauthorized" },
      {
        status: result ? 200 : 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      { responseCode: "4007300", responseMessage: "Invalid request" },
      { status: 400 },
    );
  }
}
