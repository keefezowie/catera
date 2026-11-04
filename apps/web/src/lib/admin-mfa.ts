import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin second factor (security audit 2026-11-04, M3). The database answers admin checks only for an aal2 session
 * (supabase/migrations/20261104102000_admin_mfa.sql); these helpers take a signed-in admin from aal1 to aal2 with a
 * TOTP authenticator app. The client is the cookie-session server client, so a verified challenge writes the upgraded
 * session straight back into the admin's cookies.
 */
export type AdminMfaState = { verified: boolean; enrolled: boolean };

export async function adminMfaState(client: SupabaseClient): Promise<AdminMfaState> {
  const [level, factors] = await Promise.all([
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
    client.auth.mfa.listFactors(),
  ]);
  if (level.error || factors.error) throw new Error("AUTH_UNAVAILABLE");
  return {
    verified: level.data.currentLevel === "aal2",
    enrolled: factors.data.totp.length > 0,
  };
}

/** Starts TOTP setup: a QR code (as an image URL) and the same secret as text for manual entry. */
export async function enrollAdminTotp(client: SupabaseClient) {
  const factors = await client.auth.mfa.listFactors();
  if (factors.error) throw new Error("AUTH_UNAVAILABLE");
  // One authenticator per admin: a verified one is changed by an operator in the Supabase dashboard, not from here,
  // so a stolen password cannot swap in the thief's app.
  if (factors.data.totp.length) throw new Error("CONFLICT");
  // An abandoned setup leaves an unverified factor behind; clear it so the name never collides.
  for (const f of factors.data.all)
    if (f.factor_type === "totp" && f.status !== "verified")
      await client.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Catera Admin",
  });
  if (error || !data) throw new Error("AUTH_UNAVAILABLE");
  const qr = data.totp.qr_code.startsWith("data:")
    ? data.totp.qr_code
    : "data:image/svg+xml;utf-8," + encodeURIComponent(data.totp.qr_code);
  return { factorId: data.id, qr, secret: data.totp.secret };
}

const verifySchema = z
  .object({ code: z.string().regex(/^\d{6}$/), factorId: z.string().uuid().optional() })
  .strict();

/** Checks a six-digit code against the admin's factor: the verified one, or the setup just started. */
export async function verifyAdminTotp(client: SupabaseClient, input: unknown) {
  const { code, factorId } = verifySchema.parse(input);
  const factors = await client.auth.mfa.listFactors();
  if (factors.error) throw new Error("AUTH_UNAVAILABLE");
  const verified = factors.data.totp[0];
  const factor = verified
    ? verified
    : factors.data.all.find((f) => f.factor_type === "totp" && f.id === factorId);
  if (!factor) throw new Error("NOT_FOUND");
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) throw new Error(error.status === 429 ? "AUTH_RATE_LIMITED" : "MFA_INVALID");
  return { verified: true };
}
