import { expect, it, vi } from "vitest";
import {
  adminMfaState,
  enrollAdminTotp,
  verifyAdminTotp,
} from "../apps/web/src/lib/admin-mfa";

// Security audit 2026-11-04, M3: the web steps that take a platform admin's session from aal1 to aal2.
type Factor = { id: string; factor_type: string; status: "verified" | "unverified" };
function client(factors: Factor[], level = "aal1", verifyError: { status?: number } | null = null) {
  const mfa = {
    getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: level, nextLevel: "aal2" }, error: null })),
    listFactors: vi.fn(async () => ({
      data: { all: factors, totp: factors.filter((f) => f.factor_type === "totp" && f.status === "verified") },
      error: null,
    })),
    unenroll: vi.fn(async () => ({ data: {}, error: null })),
    enroll: vi.fn(async () => ({
      data: { id: "f-new", type: "totp", totp: { qr_code: "<svg/>", secret: "SYNTHETICSECRET", uri: "otpauth://x" } },
      error: null,
    })),
    challengeAndVerify: vi.fn(async () => ({ data: verifyError ? null : {}, error: verifyError })),
  };
  return { mfa, client: { auth: { mfa } } as never };
}
const verified: Factor = { id: "00000000-0000-4000-8000-0000000000f1", factor_type: "totp", status: "verified" };
const pending: Factor = { id: "00000000-0000-4000-8000-0000000000f2", factor_type: "totp", status: "unverified" };

it("reports whether the session passed TOTP and whether an authenticator is set up", async () => {
  expect(await adminMfaState(client([]).client)).toEqual({ verified: false, enrolled: false });
  expect(await adminMfaState(client([verified]).client)).toEqual({ verified: false, enrolled: true });
  expect(await adminMfaState(client([verified], "aal2").client)).toEqual({ verified: true, enrolled: true });
});

it("sets up one authenticator, clearing an abandoned setup, and never replaces a verified one", async () => {
  const fresh = client([pending]);
  const setup = await enrollAdminTotp(fresh.client);
  expect(fresh.mfa.unenroll).toHaveBeenCalledWith({ factorId: pending.id });
  expect(setup).toEqual({
    factorId: "f-new",
    qr: "data:image/svg+xml;utf-8," + encodeURIComponent("<svg/>"),
    secret: "SYNTHETICSECRET",
  });
  const existing = client([verified]);
  await expect(enrollAdminTotp(existing.client)).rejects.toThrow("CONFLICT");
  expect(existing.mfa.enroll).not.toHaveBeenCalled();
});

it("verifies against the admin's own factor only", async () => {
  const done = client([verified]);
  // A factor id from the request never overrides the verified factor.
  await verifyAdminTotp(done.client, { code: "123456", factorId: pending.id });
  expect(done.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: verified.id, code: "123456" });

  const setup = client([pending]);
  await verifyAdminTotp(setup.client, { code: "123456", factorId: pending.id });
  expect(setup.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: pending.id, code: "123456" });
  await expect(
    verifyAdminTotp(setup.client, { code: "123456", factorId: "00000000-0000-4000-8000-0000000000ff" }),
  ).rejects.toThrow("NOT_FOUND");

  await expect(verifyAdminTotp(client([verified]).client, { code: "12345" })).rejects.toThrow();
  await expect(verifyAdminTotp(client([verified], "aal1", {}).client, { code: "123456" })).rejects.toThrow("MFA_INVALID");
  await expect(
    verifyAdminTotp(client([verified], "aal1", { status: 429 }).client, { code: "123456" }),
  ).rejects.toThrow("AUTH_RATE_LIMITED");
});
