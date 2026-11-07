import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { MobileRuntime } from "@catera/mobile-core";

type Picked = { uri: string; mimeType?: string | null; fileSize?: number | null; width?: number; height?: number };

/** A picked photo is cut to this long edge before it is sent: a dish tile needs no more, and a phone camera sends 12 MB. */
const LONG_EDGE = 2048;

/** A network step of the upload gives up after this long, as the API client does, so the photo spinner always ends. */
const TIMEOUT_MS = 30_000;

/** `fetch` plus reading its answer, within the timeout; on expiry it throws the code `errorLabel` already words. */
async function timed<T>(url: string, init: RequestInit, answer: (response: Response) => T | Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await answer(await fetch(url, { ...init, signal: controller.signal }));
  } catch (e) {
    throw controller.signal.aborted ? Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }) : e;
  } finally {
    clearTimeout(timer);
  }
}

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
  // The Catera API calls below are bearer only (`credentials: "omit"`), so no cookie is sent or kept. The signed storage
  // PUT and the read of the local file are not Catera calls and stay as they were.
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
    url = (await timed(`${runtime.apiBase}/api/uploads`, { method: "POST", headers: auth, body: form, credentials: "omit" }, read)).url;
  } else {
    const bytes = await (await fetch(photo.uri)).blob();
    const prepared = await timed(
      `${runtime.apiBase}/api/uploads/prepare`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ size: photo.fileSize || bytes.size, type }),
      },
      read,
    );
    const put = await timed(prepared.url, { method: "PUT", headers: { "Content-Type": type }, body: bytes }, (response) => response);
    if (!put.ok) throw Object.assign(new Error("UPLOAD_EXPIRED"), { code: put.status === 413 ? "INVALID_SIZE" : "UPLOAD_EXPIRED" });
    url = (
      await timed(
        `${runtime.apiBase}/api/uploads/complete`,
        {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          credentials: "omit",
          body: JSON.stringify({ object: prepared.object }),
        },
        read,
      )
    ).url;
  }
  if (typeof url !== "string") throw Object.assign(new Error("UPLOAD_FAILED"), { code: "UPLOAD_FAILED" });
  return url;
}
