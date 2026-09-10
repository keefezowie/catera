import { signInNative, nativeReturnPath, nativeSignInPath } from "../src/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Actor } from "@catera/domain";

function fixture() {
  const actor = { id: "user-1", role: "customer", name: "Demo" } as Actor;
  const client = {
    auth: {
      signInWithPassword: jest
        .fn()
        .mockResolvedValue({
          data: {
            user: {
              id: actor.id,
              user_metadata: { name: "Demo", role: "platform_admin" },
            },
            session: { access_token: "test" },
          },
          error: null,
        }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    rpc: jest
      .fn()
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: actor, error: null }),
  };
  return { actor, client, typed: client as unknown as SupabaseClient };
}

test("password login creates one session and uses the database role", async () => {
  const { actor, client, typed } = fixture();
  expect(
    await signInNative(typed, " demo@example.com ", "password", "request-1"),
  ).toEqual(actor);
  expect(client.auth.signInWithPassword).toHaveBeenCalledTimes(1);
  expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
    email: "demo@example.com",
    password: "password",
  });
  expect(client.rpc).toHaveBeenNthCalledWith(1, "catera_v1_command", {
    action: "profile.ensure",
    payload: { name: "Demo" },
    request_id: "request-1",
  });
  expect(client.rpc).toHaveBeenNthCalledWith(2, "catera_v1_read", {
    resource: "actor",
    params: {},
  });
});

test.each([
  [401, "INVALID_CREDENTIALS"],
  [429, "AUTH_RATE_LIMITED"],
])(
  "failed auth status %s does not provision a profile",
  async (status, code) => {
    const { client, typed } = fixture();
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { status },
    });
    await expect(
      signInNative(typed, "demo@example.com", "bad", "request"),
    ).rejects.toThrow(code);
    expect(client.rpc).not.toHaveBeenCalled();
  },
);

test("failed profile setup removes the partially created local session", async () => {
  const { client, typed } = fixture();
  client.rpc.mockReset().mockResolvedValue({ error: new Error("FORBIDDEN") });
  await expect(
    signInNative(typed, "demo@example.com", "password", "request"),
  ).rejects.toThrow("FORBIDDEN");
  expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});

test.each([
  "//evil.example",
  "/\\evil.example",
  "https://evil.example",
  "/login",
  "/seller",
  "/admin",
])("rejects unsupported return destination %s", (path) => {
  expect(nativeReturnPath(path)).toBe("/");
});

test("customer returns to checkout; operational roles land on the account workspace handoff", () => {
  expect(
    nativeSignInPath(
      { role: "customer" } as Actor,
      "/checkout/package-1?portions=2",
    ),
  ).toBe("/checkout/package-1?portions=2");
  for (const role of ["owner", "staff", "platform_admin"])
    expect(nativeSignInPath({ role } as Actor, "/checkout/package-1")).toBe(
      "/account",
    );
});
