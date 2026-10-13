import { demoEnabled } from "@catera/backend";
import { session } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/request-origin";
import {
  uploadError,
  uploadStorage,
  validateFoodImage,
} from "@/lib/food-upload";
import {
  isMeal,
  isUuid,
  proofBucket,
  proofPath,
  proofTypes,
  writeDemoProof,
} from "@/lib/proof-photo";

/**
 * One Sampai photo for one stop: multipart `file`, `deliveryId`, `meal`. The kitchen's owner or staff
 * upload it before delivery.arrive, which checks that the stop is theirs and on its way. The bytes are
 * decoded on the server and land in the caterer's own folder of the private proof bucket.
 * Answers { data: { path } }, the path delivery.arrive takes in `photos`.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const s = await session(request);
    if (!s.actor) throw Error("UNAUTHORIZED");
    if (!["owner", "staff"].includes(s.actor.role) || !s.actor.catererId)
      throw Error("FORBIDDEN");
    const form = await request.formData();
    const file = form.get("file");
    const deliveryId = form.get("deliveryId");
    const meal = form.get("meal");
    if (!isUuid(deliveryId) || !isMeal(meal)) throw Error("INVALID_TYPE");
    if (!(file instanceof File) || !file.size) throw Error("INVALID_SIZE");
    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = await validateFoodImage(bytes);
    const object = proofPath(s.actor.catererId, deliveryId, meal, ext);
    if (demoEnabled()) await writeDemoProof(object, bytes);
    else {
      const { error } = await uploadStorage()
        .storage.from(proofBucket)
        .upload(object, bytes, { contentType: proofTypes[ext], upsert: false });
      if (error) throw Error("UPLOAD_UNAVAILABLE");
    }
    return Response.json(
      { data: { path: object } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return uploadError(error);
  }
}
