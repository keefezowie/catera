import { demoEnabled, rpc } from "@catera/backend";
import { session } from "@/lib/auth";
import { uploadStorage } from "@/lib/food-upload";
import {
  isMeal,
  isUuid,
  proofBucket,
  proofTypes,
  proofUrlSeconds,
  readDemoProof,
} from "@/lib/proof-photo";

const fail = (code: string, status: number) =>
  Response.json(
    { error: { code } },
    { status, headers: { "Cache-Control": "no-store" } },
  );

/**
 * The Sampai photo of one meal: GET ?deliveryId=…&meal=lunch|dinner. The database read decides who
 * may see it (that stop's customer, that caterer's staff); the storage path is then signed for five
 * minutes and the answer redirects there. Demo mode answers with the bytes kept on disk.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const deliveryId = params.get("deliveryId");
  const meal = params.get("meal");
  if (!isUuid(deliveryId) || !isMeal(meal)) return fail("INVALID_INPUT", 400);
  const s = await session(request);
  if (!s.id) return fail("UNAUTHORIZED", 401);
  let path: string;
  try {
    ({ path } = await rpc<{ path: string }>(s.id, s.token, "catera_v1_read", {
      resource: "delivery-proof",
      params: { deliveryId, meal },
    }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "FORBIDDEN") return fail("FORBIDDEN", 403);
    if (code === "NOT_FOUND") return fail("NOT_FOUND", 404);
    if (code === "UNAUTHORIZED") return fail("UNAUTHORIZED", 401);
    return fail("UPLOAD_UNAVAILABLE", 503);
  }
  const ext = path.slice(path.lastIndexOf(".") + 1);
  if (demoEnabled())
    return new Response(new Uint8Array(await readDemoProof(path)), {
      headers: {
        "Content-Type": proofTypes[ext] ?? "image/png",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  try {
    const { data, error } = await uploadStorage()
      .storage.from(proofBucket)
      .createSignedUrl(path, proofUrlSeconds);
    if (error || !data?.signedUrl) return fail("UPLOAD_UNAVAILABLE", 503);
    return new Response(null, {
      status: 302,
      headers: {
        Location: data.signedUrl,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return fail("UPLOAD_UNAVAILABLE", 503);
  }
}
