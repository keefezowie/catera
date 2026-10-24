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

jest.mock("expo-image-manipulator", () => {
  const context = { resize: jest.fn(), renderAsync: jest.fn() };
  const saveAsync = jest.fn();
  context.resize.mockImplementation(() => context);
  context.renderAsync.mockImplementation(async () => ({ saveAsync }));
  saveAsync.mockImplementation(async () => ({ uri: "file:///cache/shrunk.jpg" }));
  return { __context: context, __save: saveAsync, ImageManipulator: { manipulate: jest.fn(() => context) }, SaveFormat: { JPEG: "jpeg" } };
});
const manip = jest.requireMock("expo-image-manipulator") as {
  __context: { resize: jest.Mock };
  __save: jest.Mock;
  ImageManipulator: { manipulate: jest.Mock };
};

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

  describe("shrinking before the upload", () => {
    const send = async (photo: Parameters<typeof uploadPhoto>[1]) => {
      global.fetch = (async () => ({ ok: true, json: async () => ({ data: { url: "/api/uploads?file=a.jpg" } }) })) as never;
      const append = jest.spyOn(FormData.prototype, "append");
      await uploadPhoto(runtime, photo, true);
      return append;
    };
    beforeEach(() => {
      jest.restoreAllMocks();
      manip.__context.resize.mockClear();
      manip.__save.mockClear();
      manip.ImageManipulator.manipulate.mockClear();
    });

    it("cuts a long edge past 2048 to 2048 and saves a JPEG at 0.8, then sends the shrunk file", async () => {
      const append = await send({ ...picked, width: 4000, height: 3000 });
      expect(manip.ImageManipulator.manipulate).toHaveBeenCalledWith(picked.uri);
      expect(manip.__context.resize).toHaveBeenCalledWith({ width: 2048 });
      expect(manip.__save).toHaveBeenCalledWith({ compress: 0.8, format: "jpeg" });
      const part = (append.mock.calls[append.mock.calls.length - 1] as unknown as [string, { uri: string }])[1];
      expect(part.uri).toBe("file:///cache/shrunk.jpg");
    });

    it("cuts a tall photo by its height", async () => {
      await send({ ...picked, width: 3000, height: 4000 });
      expect(manip.__context.resize).toHaveBeenCalledWith({ height: 2048 });
    });

    it("never upscales a small photo", async () => {
      await send({ ...picked, width: 800, height: 600 });
      expect(manip.__context.resize).not.toHaveBeenCalled();
      expect(manip.__save).toHaveBeenCalledWith({ compress: 0.8, format: "jpeg" });
    });
  });
});
