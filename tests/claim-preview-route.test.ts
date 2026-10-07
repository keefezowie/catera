import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rpc: vi.fn() }));
// Anyone holding the link may read the preview: no user, no token.
vi.mock("../apps/web/src/lib/auth", () => ({
  session: async () => ({ id: null, token: null, actor: null }),
}));
vi.mock("@catera/backend", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  demoEnabled: () => false,
  rpc: state.rpc,
}));
import { GET } from "../apps/web/src/app/api/v1/[...path]/route";

const token = "a".repeat(64);
const call = (path: string) =>
  GET(new Request("https://catera.test/api/v1/" + path), {
    params: Promise.resolve({ path: path.split("?")[0].split("/") }),
  } as never);
beforeEach(() => state.rpc.mockReset());

it("reads the preview for an anonymous visitor passing only the token", async () => {
  state.rpc.mockResolvedValueOnce({ catererName: "Dapur Senja" });
  const response = await call("claim-preview/" + token + "?id=other&limit=9");
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ data: { catererName: "Dapur Senja" } });
  expect(state.rpc).toHaveBeenCalledWith(null, null, "catera_v1_read", {
    resource: "claim-preview",
    params: { token },
  });
});

it("rejects a missing or malformed token before reaching the database", async () => {
  for (const path of ["claim-preview", "claim-preview/short"]) {
    const response = await call(path);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_INPUT");
  }
  expect(state.rpc).not.toHaveBeenCalled();
});

it("answers NOT_FOUND with a 404 whatever the reason", async () => {
  state.rpc.mockRejectedValueOnce(new Error("NOT_FOUND"));
  const response = await call("claim-preview/" + token);
  expect(response.status).toBe(404);
  expect((await response.json()).error.code).toBe("NOT_FOUND");
});
