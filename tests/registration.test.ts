import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  registerEmail,
  confirmationUrl,
  authError,
} from "../apps/web/src/lib/registration";
import {
  createRecoveryGrant,
  verifyRecoveryGrant,
  recoveryCookie,
} from "../apps/web/src/lib/recovery-grant";
import { safeReturnPath } from "../apps/web/src/lib/navigation";
const jar = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
import { authLifecycle } from "../apps/web/src/lib/auth-lifecycle";

const secret = "synthetic-registration-secret-32-characters";
const request = new Request("https://catera.test/api/v1/auth/register");
const auth = {
  signUp: vi.fn(),
  signOut: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  updateUser: vi.fn(),
};
const client = { auth } as unknown as SupabaseClient;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CATERA_PUBLIC_URL", "https://catera.test");
  vi.stubEnv("CATERA_SESSION_SECRET", secret);
  auth.signUp.mockResolvedValue({
    data: { user: { id: "new" }, session: null },
    error: null,
  });
  auth.getUser.mockResolvedValue({
    data: { user: { id: "new" } },
    error: null,
  });
  auth.getSession.mockResolvedValue({
    data: { session: { access_token: "verified-recovery-token" } },
  });
  auth.updateUser.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("email registration", () => {
  it("waits for confirmation and never forwards user-supplied authority", async () => {
    expect(
      await registerEmail(
        client,
        {
          name: " New customer ",
          email: "new@catera.test",
          password: "synthetic-password",
          role: "platform_admin",
          next: "/checkout/abc?trial=1",
        },
        "https://catera.test",
      ),
    ).toEqual({ sent: true });
    expect(auth.signUp.mock.calls[0][0]).toMatchObject({
      options: { data: { name: "New customer" } },
    });
    expect(auth.signUp.mock.calls[0][0].options.data).not.toHaveProperty(
      "role",
    );
    expect(
      new URL(
        auth.signUp.mock.calls[0][0].options.emailRedirectTo,
      ).searchParams.get("next"),
    ).toBe("/checkout/abc?trial=1");
  });
  it.each([
    { name: " ", email: "a@catera.test", password: "12345678" },
    { name: "Test", email: "invalid", password: "12345678" },
    { name: "Test", email: "a@catera.test", password: "short" },
  ])("rejects invalid registration before calling Auth", async (input) => {
    await expect(
      registerEmail(client, input, "https://catera.test"),
    ).rejects.toThrow();
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it("does not reveal duplicate emails", async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { code: "user_already_exists" },
    });
    expect(
      await registerEmail(
        client,
        { name: "Test", email: "existing@catera.test", password: "12345678" },
        "https://catera.test",
      ),
    ).toEqual({ sent: true });
  });
  it("fails closed when email confirmation is disabled", async () => {
    auth.signUp.mockResolvedValue({
      data: { session: { access_token: "unverified" } },
      error: null,
    });
    await expect(
      registerEmail(
        client,
        { name: "Test", email: "new@catera.test", password: "12345678" },
        "https://catera.test",
      ),
    ).rejects.toThrow("NOT_CONFIGURED");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("handles rate limits without swallowing them", () => {
    expect(() => authError({ status: 429 })).toThrow("AUTH_RATE_LIMITED");
    expect(() => authError({ code: "email_not_confirmed" })).toThrow(
      "EMAIL_NOT_CONFIRMED",
    );
  });
  it.each([
    "//evil.test",
    "/register?next=/home",
    "/%6cogin",
    "/auth/confirm",
    "/reset-password",
    "/forgot-password",
  ])("blocks external or looping return %s", (next) => {
    expect(safeReturnPath(next)).toBeNull();
    expect(
      new URL(confirmationUrl("https://catera.test", next)).searchParams.get(
        "next",
      ),
    ).toBe("/home");
  });
});

describe("password recovery", () => {
  it("rejects ordinary login sessions without a recovery grant", async () => {
    await expect(
      authLifecycle(
        "reset-password",
        { password: "new-password" },
        client,
        request,
      ),
    ).rejects.toThrow("RECOVERY_EXPIRED");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("binds the grant to identity, session token, signature and expiry", () => {
    const grant = createRecoveryGrant("new", "token", secret, 1000);
    expect(verifyRecoveryGrant(grant, "new", "token", secret, 2000)).toBe(true);
    expect(verifyRecoveryGrant(grant, "other", "token", secret, 2000)).toBe(
      false,
    );
    expect(
      verifyRecoveryGrant(grant, "new", "ordinary-token", secret, 2000),
    ).toBe(false);
    expect(
      verifyRecoveryGrant(grant + "tampered", "new", "token", secret, 2000),
    ).toBe(false);
    expect(verifyRecoveryGrant(grant, "new", "token", secret, 601000)).toBe(
      false,
    );
  });
  it("updates only a verified recovery session, clears its grant and signs out", async () => {
    jar.get.mockReturnValue({
      value: createRecoveryGrant("new", "verified-recovery-token", secret),
    });
    expect(
      await authLifecycle(
        "reset-password",
        { password: "new-password" },
        client,
        request,
      ),
    ).toEqual({ updated: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password" });
    expect(jar.delete).toHaveBeenCalledWith(recoveryCookie);
    expect(auth.signOut).toHaveBeenCalled();
  });
  it("keeps the recovery grant after a rejected password so the user can retry", async () => {
    jar.get.mockReturnValue({
      value: createRecoveryGrant("new", "verified-recovery-token", secret),
    });
    auth.updateUser.mockResolvedValue({ error: { code: "same_password" } });
    await expect(
      authLifecycle(
        "reset-password",
        { password: "new-password" },
        client,
        request,
      ),
    ).rejects.toThrow("PASSWORD_REJECTED");
    expect(jar.delete).not.toHaveBeenCalled();
  });
  it("requests recovery without exposing an unknown account", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      error: { code: "user_not_found" },
    });
    expect(
      await authLifecycle(
        "recover",
        { email: "absent@catera.test" },
        client,
        request,
      ),
    ).toEqual({ sent: true });
  });
});
