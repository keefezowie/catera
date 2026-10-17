import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { KitchenMeal } from "@catera/domain";
import type { MobileRuntime } from "@catera/mobile-core";

/** A camera photo is shrunk to this long edge before it is sent, like the import photos: a proof needs a face, not a poster. */
const LONG_EDGE = 1600;

/** The photo as it will be sent: the long edge cut to 1600 px and saved as a JPEG. The picked file stays on the phone. */
export async function shrinkProof(photo: { uri: string; width: number; height: number }): Promise<{ uri: string }> {
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > LONG_EDGE)
    context.resize(photo.width >= photo.height ? { width: LONG_EDGE } : { height: LONG_EDGE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return { uri: saved.uri };
}

/**
 * Sends one stop's Sampai photo to `/api/uploads/proof` and returns the private path `delivery.arrive` takes in
 * `photos`. The server checks the stop is this kitchen's before it stores anything. Expo's fetch only encodes a
 * Blob-like part that can read its bytes, so the file goes as an expo-file-system `File`.
 */
export async function uploadProof(
  runtime: MobileRuntime,
  uri: string,
  deliveryId: string,
  meal: KitchenMeal,
): Promise<string> {
  const token = await runtime.token();
  const form = new FormData();
  form.append("file", new File(uri) as unknown as Blob);
  form.append("deliveryId", deliveryId);
  form.append("meal", meal);
  const response = await fetch(`${runtime.apiBase}/api/uploads/proof`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const body = (await response.json().catch(() => ({}))) as { data?: { path?: string }; error?: { code?: string } };
  if (!response.ok || !body.data?.path) {
    const code = body.error?.code || "UPLOAD_UNAVAILABLE";
    throw Object.assign(new Error(code), { code });
  }
  return body.data.path;
}
