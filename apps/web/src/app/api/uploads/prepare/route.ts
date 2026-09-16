import { demoEnabled } from "@catera/backend";
import {
  imageTypes,
  stagingBucket,
  uploadError,
  uploadLimit,
  uploadOwner,
  uploadStorage,
} from "../../../../lib/food-upload";
export async function POST(request: Request) {
  try {
    const s = await uploadOwner(request);
    const body = await request.json();
    if (
      !Number.isInteger(body.size) ||
      body.size < 1 ||
      body.size > uploadLimit
    )
      throw Error("INVALID_SIZE");
    const extension =
      typeof body.type === "string" && Object.hasOwn(imageTypes, body.type)
        ? imageTypes[body.type]
        : undefined;
    if (!extension) throw Error("INVALID_TYPE");
    if (demoEnabled()) return Response.json({ data: { mode: "demo" } });
    const object = `${s.actor!.catererId}/${s.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const client = uploadStorage();
    const result = await client.storage
      .from(stagingBucket)
      .createSignedUploadUrl(object, { upsert: false });
    if (result.error) throw Error("UPLOAD_UNAVAILABLE");
    return Response.json(
      { data: { mode: "storage", object, url: result.data.signedUrl } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return uploadError(error);
  }
}
