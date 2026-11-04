import { createClient } from "@supabase/supabase-js";
import { session } from "./auth";
import { assertSameOrigin } from "./request-origin";
import { demoEnabled } from "@catera/backend";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import { withThumbhash } from "@catera/domain";
export const uploadLimit = 8 * 1024 * 1024;
export const stagingBucket = "catera-v1-food-staging";
export const foodBucket = "catera-v1-food";
export const imageTypes: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
export async function uploadOwner(request: Request) {
  assertSameOrigin(request);
  const s = await session(request);
  if (!s.actor) throw Error("UNAUTHORIZED");
  if (s.actor.role !== "owner" || !s.actor.catererId) throw Error("FORBIDDEN");
  return s;
}
export function uploadStorage() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!base || !key || base.includes("otmanljypltxkwjcebni") || demoEnabled())
    throw Error("UPLOAD_UNAVAILABLE");
  return createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function validateFoodImage(bytes: Buffer) {
  if (!bytes.length || bytes.length > uploadLimit) throw Error("INVALID_SIZE");
  try {
    const image = sharp(bytes, {
      limitInputPixels: 40000000,
      failOn: "warning",
    });
    const meta = await image.metadata();
    const ext = meta.format === "jpeg" ? "jpg" : meta.format;
    if (!ext || !["png", "jpg", "webp"].includes(ext))
      throw Error("INVALID_TYPE");
    // Decode, not just a MIME/header check.
    await image.stats();
    return ext;
  } catch {
    throw Error("INVALID_TYPE");
  }
}
/** The public address with the photo's blurred placeholder after it; a photo that cannot be hashed goes without. */
export async function withPlaceholder(url: string, bytes: Buffer) {
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: 40000000 })
      .resize(100, 100, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const hash = rgbaToThumbHash(info.width, info.height, data);
    return withThumbhash(url, Buffer.from(hash).toString("base64"));
  } catch {
    return url;
  }
}
/**
 * Validates, then re-encodes the image so nothing but pixels is stored: EXIF (GPS, device,
 * timestamps), XMP and comments are dropped, and the EXIF orientation is applied first so
 * the picture still stands the right way up. The same input always gives the same bytes,
 * which keeps an immutable retry of the same upload byte-identical.
 */
export async function cleanFoodImage(
  bytes: Buffer,
): Promise<{ ext: string; bytes: Buffer }> {
  const ext = await validateFoodImage(bytes);
  let clean: Buffer;
  try {
    const image = sharp(bytes, {
      limitInputPixels: 40000000,
      failOn: "warning",
    }).rotate();
    clean = await (ext === "png"
      ? image.png()
      : ext === "webp"
        ? image.webp({ quality: 90 })
        : image.jpeg({ quality: 90 })
    ).toBuffer();
  } catch {
    throw Error("INVALID_TYPE");
  }
  if (clean.length > uploadLimit) throw Error("INVALID_SIZE");
  return { ext, bytes: clean };
}
export function uploadError(error: unknown) {
  const code =
    error instanceof Error &&
    [
      "UNAUTHORIZED",
      "FORBIDDEN",
      "INVALID_SIZE",
      "INVALID_TYPE",
      "UPLOAD_EXPIRED",
      "UPLOAD_UNAVAILABLE",
    ].includes(error.message)
      ? error.message
      : "UPLOAD_UNAVAILABLE";
  return Response.json(
    { error: { code } },
    {
      status:
        code === "UNAUTHORIZED"
          ? 401
          : code === "FORBIDDEN"
            ? 403
            : code === "UPLOAD_UNAVAILABLE"
              ? 503
              : 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
