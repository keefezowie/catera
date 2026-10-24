import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { MobileRuntime } from "@catera/mobile-core";

type Picked = { uri: string; mimeType?: string | null; fileSize?: number | null; width?: number; height?: number };

/** A picked photo is cut to this long edge before it is sent: a dish tile needs no more, and a phone camera sends 12 MB. */
const LONG_EDGE = 2048;

/** The photo as it will be sent: a long edge past 2048 cut to 2048 (never enlarged), saved as a JPEG at 0.8. */
async function shrink(photo: Picked): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  const { width = 0, height = 0 } = photo;
  if (Math.max(width, height) > LONG_EDGE) context.resize(width >= height ? { width: LONG_EDGE } : { height: LONG_EDGE });
  const image = await context.renderAsync();
  return (await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG })).uri;
}

/** Upload a picked photo the same way the web does: staged, checked on the server, then public. */
export async function uploadPhoto(runtime: MobileRuntime, picked: Picked, demo: boolean): Promise<string> {
  const photo = { uri: await shrink(picked), mimeType: "image/jpeg", fileSize: null };
  const token = await runtime.token();
  const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const type = photo.mimeType || "image/jpeg";
  const read = async (response: Response) => {
    const body = (await response.json().catch(() => ({}))) as { data?: Record<string, string>; error?: { code?: string } };
    if (!response.ok) throw Object.assign(new Error(body.error?.code || "UPLOAD_UNAVAILABLE"), { code: body.error?.code });
    return body.data ?? {};
  };
  let url: string | undefined;
  if (demo) {
    // Expo's fetch only encodes Blob-like parts that can read their bytes; React Native's `{ uri, name, type }` part throws
    // "Unsupported FormDataPart implementation", so the picked file is sent as an expo-file-system File.
    const form = new FormData();
    form.append("file", new File(photo.uri) as unknown as Blob);
    url = (await read(await fetch(`${runtime.apiBase}/api/uploads`, { method: "POST", headers: auth, body: form }))).url;
  } else {
    const bytes = await (await fetch(photo.uri)).blob();
    const prepared = await read(
      await fetch(`${runtime.apiBase}/api/uploads/prepare`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ size: photo.fileSize || bytes.size, type }),
      }),
    );
    const put = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": type }, body: bytes });
    if (!put.ok) throw Object.assign(new Error("UPLOAD_EXPIRED"), { code: put.status === 413 ? "INVALID_SIZE" : "UPLOAD_EXPIRED" });
    url = (
      await read(
        await fetch(`${runtime.apiBase}/api/uploads/complete`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ object: prepared.object }),
        }),
      )
    ).url;
  }
  if (typeof url !== "string") throw Object.assign(new Error("UPLOAD_FAILED"), { code: "UPLOAD_FAILED" });
  return url;
}
