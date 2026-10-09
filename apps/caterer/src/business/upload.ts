import { File } from "expo-file-system";
import type { MobileRuntime } from "@catera/mobile-core";

type Picked = { uri: string; mimeType?: string | null; fileSize?: number | null };

/** Upload a picked photo the same way the web does: staged, checked on the server, then public. */
export async function uploadPhoto(runtime: MobileRuntime, photo: Picked, demo: boolean): Promise<string> {
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
