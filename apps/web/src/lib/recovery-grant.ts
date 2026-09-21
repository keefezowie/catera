import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const recoveryCookie = "catera_recovery";
export const recoveryMaxAge = 600;
function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
export function recoverySecret() {
  const secret = process.env.CATERA_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("NOT_CONFIGURED");
  return secret;
}
export function createRecoveryGrant(
  userId: string,
  token: string,
  secret: string,
  now = Date.now(),
) {
  const value = Buffer.from(
    JSON.stringify({
      userId,
      token: createHash("sha256").update(token).digest("hex"),
      expires: now + recoveryMaxAge * 1000,
    }),
  ).toString("base64url");
  return value + "." + signature(value, secret);
}
export function verifyRecoveryGrant(
  grant: string | undefined,
  userId: string,
  token: string,
  secret: string,
  now = Date.now(),
) {
  try {
    const [value, sig, extra] = (grant || "").split(".");
    if (!value || !sig || extra) return false;
    const expected = Buffer.from(signature(value, secret));
    const actual = Buffer.from(sig);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return false;
    const data = JSON.parse(Buffer.from(value, "base64url").toString());
    return (
      data.userId === userId &&
      data.token === createHash("sha256").update(token).digest("hex") &&
      data.expires > now
    );
  } catch {
    return false;
  }
}
