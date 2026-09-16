import {
  foodBucket,
  stagingBucket,
  uploadError,
  uploadOwner,
  uploadStorage,
  validateFoodImage,
} from "../../../../lib/food-upload";
export async function POST(request: Request) {
  try {
    const s = await uploadOwner(request),
      { object } = await request.json();
    const prefix = `${s.actor!.catererId}/${s.id}/`;
    if (typeof object !== "string" || !object.startsWith(prefix))
      throw Error("FORBIDDEN");
    const match = /^(\d{13})-([a-f0-9-]{36})\.(png|jpg|webp)$/.exec(
      object.slice(prefix.length),
    );
    if (!match) throw Error("FORBIDDEN");
    if (
      Date.now() - Number(match[1]) > 2 * 60 * 60 * 1000 ||
      Number(match[1]) > Date.now()
    )
      throw Error("UPLOAD_EXPIRED");
    const client = uploadStorage(),
      target = `${s.actor!.catererId}/${match[2]}.${match[3]}`;
    const download = await client.storage.from(stagingBucket).download(object);
    if (download.error || !download.data) throw Error("UPLOAD_EXPIRED");
    const bytes = Buffer.from(await download.data.arrayBuffer());
    let ext: string;
    try {
      ext = await validateFoodImage(bytes);
      if (ext !== match[3]) throw Error("INVALID_TYPE");
    } catch (error) {
      await client.storage.from(stagingBucket).remove([object]);
      throw error;
    }
    const result = await client.storage
      .from(foodBucket)
      .upload(target, bytes, {
        contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`,
        upsert: false,
      });
    // A retry uses the same validated immutable object; never overwrite a public image.
    if (
      result.error &&
      !["409", "400"].includes(
        String((result.error as { statusCode?: string }).statusCode),
      )
    )
      throw Error("UPLOAD_UNAVAILABLE");
    if (result.error) {
      const existing = await client.storage.from(foodBucket).download(target);
      if (
        existing.error ||
        !Buffer.from(await existing.data.arrayBuffer()).equals(bytes)
      )
        throw Error("UPLOAD_UNAVAILABLE");
    }
    // Keep staging briefly for idempotent retries; the maintenance job expires it.
    return Response.json(
      {
        data: {
          url: client.storage.from(foodBucket).getPublicUrl(target).data
            .publicUrl,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return uploadError(error);
  }
}
