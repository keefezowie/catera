import { beforeEach, afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  session: vi.fn(),
  set: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: state.set }) }));
vi.mock("../apps/web/src/lib/auth", () => ({ session: state.session }));
vi.mock("@catera/backend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@catera/backend")>()),
  demoEnabled: () => false,
  rpc: state.rpc,
}));
import { POST } from "../apps/web/src/app/api/v1/[...path]/route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CATERA_PUBLIC_URL", "https://catera.test");
  state.session.mockResolvedValue({
    id: "synthetic",
    token: "synthetic-token",
    actor: { id: "synthetic", role: "customer" },
  });
});
afterEach(() => vi.unstubAllEnvs());
const command = (action: string) =>
  POST(
    new Request("https://catera.test/api/v1/commands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://catera.test",
      },
      body: JSON.stringify({
        action,
        payload: { role: "owner" },
        requestId: crypto.randomUUID(),
      }),
    }),
    { params: Promise.resolve({ path: ["commands"] }) },
  );

it.each([
  ["seller.create", "owner"],
  ["invite.accept", "staff"],
])(
  "activates caterer presentation after successful %s with DB role %s",
  async (action, role) => {
    state.rpc.mockImplementation(async (_id, _token, name) =>
      name === "catera_v1_command"
        ? { id: "synthetic-caterer" }
        : { id: "synthetic", role, catererId: "synthetic-caterer" },
    );
    expect((await command(action)).status).toBe(200);
    expect(state.set).toHaveBeenCalledWith(
      "catera_workspace",
      "caterer",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );
  },
);

it("does not activate seller mode from a customer invitation or payload-supplied role", async () => {
  state.rpc.mockResolvedValue({ id: "synthetic", role: "customer" });
  expect((await command("invite.accept")).status).toBe(200);
  expect(state.set).not.toHaveBeenCalled();
});

it("keeps the selected workspace when activation fails", async () => {
  state.rpc.mockRejectedValue(new Error("FORBIDDEN"));
  expect((await command("seller.create")).status).toBe(403);
  expect(state.set).not.toHaveBeenCalled();
});
