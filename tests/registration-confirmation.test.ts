import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  verify: vi.fn(),
  rpc: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: state.set, delete: state.delete }),
}));
vi.mock("../apps/web/src/lib/auth", () => ({
  supabase: async () => ({ auth: { verifyOtp: state.verify } }),
}));
vi.mock("@catera/backend", () => ({
  demoEnabled: () => false,
  rpc: state.rpc,
}));
import { GET } from "../apps/web/src/app/auth/confirm/route";
import {
  recoveryCookie,
  verifyRecoveryGrant,
} from "../apps/web/src/lib/recovery-grant";
const secret = "synthetic-registration-secret-32-characters";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CATERA_PUBLIC_URL", "https://catera.test");
  vi.stubEnv("CATERA_SESSION_SECRET", secret);
  state.verify.mockResolvedValue({
    data: {
      user: {
        id: "user",
        user_metadata: { name: "New customer", role: "platform_admin" },
      },
      session: { access_token: "verified" },
    },
    error: null,
  });
  state.rpc.mockImplementation(async (_id, _token, command) =>
    command === "catera_v1_read" ? { id: "user", role: "customer" } : {},
  );
});
afterEach(() => vi.unstubAllEnvs());
const confirm = (query: string) =>
  GET(new Request("https://catera.test/auth/confirm?" + query));
it.each([
  "/checkout/abc?trial=1",
  "/seller/onboarding",
  "/claim/synthetic-invitation",
])("initializes a verified customer and preserves %s", async (next) => {
  const response = await confirm(
    "type=signup&token_hash=synthetic&next=" + encodeURIComponent(next),
  );
  expect(response.headers.get("location")).toBe("https://catera.test" + next);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(state.rpc.mock.calls[0][3]).toMatchObject({
    action: "profile.ensure",
    payload: { name: "New customer" },
  });
  expect(state.rpc.mock.calls[0][3].payload).not.toHaveProperty("role");
});
it("rejects invalid, expired and replayed tokens without creating profiles", async () => {
  state.verify.mockResolvedValue({ data: {}, error: { code: "otp_expired" } });
  expect(
    (await confirm("type=signup&token_hash=expired")).headers.get("location"),
  ).toBe("https://catera.test/register?error=link");
  expect(state.rpc).not.toHaveBeenCalled();
});
it("never grants password recovery from a signup token or an arbitrary type", async () => {
  await confirm("type=signup&token_hash=valid&next=/reset-password");
  expect(state.set.mock.calls.some(([name]) => name === recoveryCookie)).toBe(
    false,
  );
  state.verify.mockClear();
  await confirm("type=email_change&token_hash=valid");
  expect(state.verify).not.toHaveBeenCalled();
});
it("issues a recovery grant only after verifying a recovery token", async () => {
  const response = await confirm(
    "type=recovery&token_hash=valid&next=https://evil.test",
  );
  expect(response.headers.get("location")).toBe(
    "https://catera.test/reset-password",
  );
  expect(state.verify).toHaveBeenCalledWith({
    token_hash: "valid",
    type: "recovery",
  });
  const [, grant, options] = state.set.mock.calls.find(
    ([name]) => name === recoveryCookie,
  )!;
  expect(verifyRecoveryGrant(grant, "user", "verified", secret)).toBe(true);
  expect(options).toMatchObject({
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
  });
  expect(state.rpc).not.toHaveBeenCalled();
});
