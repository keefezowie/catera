import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Same caps as /api/import-assistant: 6 photos, and a request body under 4 MB. */
export const MAX_IMAGES = 6;
const MAX_BASE64 = 3_800_000;

/** A notebook page stays readable at 1600 px; a full camera photo would not fit the upload. */
export async function shrinkPhoto(photo: { uri: string; width: number; height: number }) {
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > 1600)
    context.resize(photo.width >= photo.height ? { width: 1600 } : { height: 1600 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
  return { mediaType: "image/jpeg" as const, data: saved.base64 ?? "" };
}

/** Whether these base64 attachments fit in one assistant request. */
export const fitsUpload = (data: string[]) => data.reduce((n, d) => n + d.length, 0) <= MAX_BASE64;
