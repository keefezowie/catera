import { beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
const state = vi.hoisted(() => ({
  role: "owner",
  signed: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../apps/web/src/lib/auth", () => ({
  session: async () => ({
    id: "synthetic-user",
    token: "synthetic-token",
    actor:
      state.role === "expired"
        ? null
        : {
            role: state.role,
            catererId: "10000000-0000-4000-8000-000000000001",
          },
  }),
}));
vi.mock("@catera/backend", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  demoEnabled: () => false,
}));
vi.mock("../apps/web/src/lib/food-upload", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  uploadStorage: () => ({
    storage: {
      from: () => ({
        createSignedUploadUrl: state.signed,
        download: state.download,
        upload: state.upload,
        remove: state.remove,
        getPublicUrl: (key: string) => ({
          data: { publicUrl: "https://synthetic.invalid/food/" + key },
        }),
      }),
    },
  }),
}));
import { POST as prepare } from "../apps/web/src/app/api/uploads/prepare/route";
import { POST as complete } from "../apps/web/src/app/api/uploads/complete/route";
const cid = "10000000-0000-4000-8000-000000000001";
const request = (body: unknown) =>
  new Request("https://catera.test/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const object = () =>
  `${cid}/synthetic-user/${Date.now()}-${crypto.randomUUID()}.png`;
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "owner";
  state.signed.mockResolvedValue({
    data: { signedUrl: "https://synthetic.invalid/signed" },
    error: null,
  });
  state.upload.mockResolvedValue({ error: null });
  state.remove.mockResolvedValue({ error: null });
});
it("prepares scoped tokens with metadata only and rejects unsupported types, size, staff, and expired sessions", async () => {
  const r = await prepare(request({ size: 8388608, type: "image/png" }));
  expect(r.status).toBe(200);
  const data = (await r.json()).data;
  expect(data.object).toMatch(new RegExp("^" + cid + "/synthetic-user/"));
  expect(data.url).toBe("https://synthetic.invalid/signed");
  expect(state.upload).not.toHaveBeenCalled();
  for (const body of [
    { size: 8388609, type: "image/png" },
    { size: 1, type: "image/gif" },
    { size: 1, type: "__proto__" },
  ])
    expect((await prepare(request(body))).status).toBe(400);
  state.role = "staff";
  expect((await prepare(request({ size: 1, type: "image/png" }))).status).toBe(
    403,
  );
  state.role = "expired";
  expect((await prepare(request({ size: 1, type: "image/png" }))).status).toBe(
    401,
  );
  expect(state.signed).toHaveBeenCalledTimes(1);
});
it("rejects cross-tenant or expired completions before accessing storage", async () => {
  expect(
    (
      await complete(
        request({ object: "another-tenant/synthetic-user/file.png" }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await complete(
        request({
          object: `${cid}/synthetic-user/${Date.now() - 7200001}-${crypto.randomUUID()}.png`,
        }),
      )
    ).status,
  ).toBe(400);
  expect(state.download).not.toHaveBeenCalled();
  expect(state.upload).not.toHaveBeenCalled();
});
it("decodes staging bytes before publishing and returns the same URL on an immutable retry", async () => {
  const bytes = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#ffaa44" },
    })
      .png()
      .toBuffer(),
    key = object();
  state.download.mockResolvedValue({
    error: null,
    data: new Blob([new Uint8Array(bytes)]),
  });
  const first = await complete(request({ object: key }));
  expect(first.status).toBe(200);
  state.upload.mockResolvedValue({ error: { statusCode: "409" } });
  const retry = await complete(request({ object: key }));
  expect(await retry.json()).toEqual(await first.json());
  state.download.mockResolvedValue({
    error: null,
    data: new Blob(["invalid bytes"]),
  });
  state.upload.mockClear();
  const invalid = await complete(request({ object: object() }));
  expect((await invalid.json()).error.code).toBe("INVALID_TYPE");
  expect(state.upload).not.toHaveBeenCalled();
  expect(state.remove).toHaveBeenCalled();
});
