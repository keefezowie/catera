import { File } from "expo-file-system";
import { uploadPhoto } from "../src/business/upload";

// Expo's global fetch (the winter runtime) builds a multipart body only from Blob-like parts that can read their bytes.
// React Native's `{ uri, name, type }` file part throws "Unsupported FormDataPart implementation" there, which made every
// demo photo upload fail on the emulator. The demo branch must therefore send a File that can read itself.
jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    name = "picked.png";
    type = "image/png";
    constructor(uri: string) {
      this.uri = uri;
    }
    async bytes() {
      return new Uint8Array([1, 2, 3]);
    }
  },
}));

const runtime = { apiBase: "http://api.test", token: async () => "demo-token" } as never;
const picked = { uri: "file:///cache/ImagePicker/1.png", mimeType: "image/png", fileSize: 3 };

describe("uploadPhoto (demo)", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("posts the picked file as a self-reading File part, never a { uri } object", async () => {
    const calls: { url: string; init: { method?: string; headers?: Record<string, string>; body?: unknown } }[] = [];
    global.fetch = (async (url: string, init: never) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ data: { url: "/api/uploads?file=a.png" } }) };
    }) as never;

    // The jest FormData stringifies a non-Blob part, so the part is read from the append call, not from the body.
    const append = jest.spyOn(FormData.prototype, "append");
    const url = await uploadPhoto(runtime, picked, true);

    expect(url).toBe("/api/uploads?file=a.png");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://api.test/api/uploads");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({ Authorization: "Bearer demo-token" });
    expect(append).toHaveBeenCalledTimes(1);
    const [field, part] = append.mock.calls[0] as unknown as [string, unknown];
    expect(field).toBe("file");
    expect(part).toBeInstanceOf(File);
    expect(typeof (part as File).bytes).toBe("function");
    expect(calls[0].init.body).toBeInstanceOf(FormData);
  });
});
