import { beforeEach, expect, it, vi } from "vitest";

// Sign-in rethink: claim and profile phone are typed by the user, no OTP-verified auth phone.
const state = vi.hoisted(() => ({ rpc: vi.fn(), demo: false, id: "00000000-0000-4000-8000-000000000001" as string | null }));
vi.mock("../apps/web/src/lib/auth", () => ({
  session: async () => ({ id: state.id, token: state.id ? "synthetic-token" : null, actor: null }),
  supabase: async () => {
    throw new Error("auth must not be read");
  },
  demoToken: () => "",
}));
vi.mock("@catera/backend", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  demoEnabled: () => state.demo,
  rpc: state.rpc,
}));
import { POST } from "../apps/web/src/app/api/v1/[...path]/route";

const token = "t".repeat(40);
const post = (action: string, payload: object) =>
  POST(
    new Request("https://catera.test/api/v1/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, payload, requestId: crypto.randomUUID() }),
    }),
    { params: Promise.resolve({ path: ["commands"] }) } as never,
  );
const code = async (r: Response) => (await r.json()).error?.code;
beforeEach(() => {
  state.rpc.mockReset();
  state.demo = false;
  state.id = "00000000-0000-4000-8000-000000000001";
});

it("claims with the typed phone, normalized, without reading the auth phone", async () => {
  for (const demo of [false, true]) {
    state.demo = demo;
    state.rpc.mockReset().mockResolvedValueOnce({ status: "claimed" });
    const r = await post("customer.claim", { token, phone: "0812-3450-0001" });
    expect(r.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith(
      null,
      null,
      "catera_v1_system",
      {
        action: "pilot.claim",
        payload: expect.objectContaining({ userId: state.id, verifiedPhone: "+6281234500001", token }),
      },
      true,
    );
  }
  // A number that does not match the record is answered "unavailable" (the count commits); the app sees CLAIM_UNAVAILABLE.
  state.rpc.mockReset().mockResolvedValueOnce({ status: "unavailable" });
  const wrong = await post("customer.claim", { token, phone: "+6289999999999" });
  expect(wrong.status).toBe(400);
  expect(await code(wrong)).toBe("CLAIM_UNAVAILABLE");
  state.rpc.mockReset().mockRejectedValueOnce(new Error("CLAIM_UNAVAILABLE"));
  expect(await code(await post("customer.claim", { token, phone: "+6289999999999" }))).toBe("CLAIM_UNAVAILABLE");
});

it("rejects a claim with a missing or bad phone, and a signed-out claim", async () => {
  for (const payload of [{ token }, { token, phone: "12345" }, { token, phone: 812 }, { phone: "+6281234500001" }])
    expect(await code(await post("customer.claim", payload))).toBe("INVALID_INPUT");
  expect(state.rpc).not.toHaveBeenCalled();
  state.id = null;
  expect(await code(await post("customer.claim", { token, phone: "+6281234500001" }))).toBe("UNAUTHORIZED");
});

it("profile.update normalizes a phone, clears it with null and needs at least one field", async () => {
  state.rpc.mockResolvedValue({});
  await post("profile.update", { phone: "6281234500001" });
  await post("profile.update", { name: " Sari ", phone: null });
  expect(state.rpc.mock.calls.map((c) => c[3].payload)).toEqual([{ phone: "+6281234500001" }, { name: "Sari", phone: null }]);
  for (const payload of [{}, { phone: "0812" }, { phone: "+6281234500001", id: "x" }])
    expect(await code(await post("profile.update", payload))).toBe("INVALID_INPUT");
});
