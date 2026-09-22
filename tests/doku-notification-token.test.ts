import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { issueDokuNotificationToken } from "../packages/backend/src/doku";
afterEach(() => vi.unstubAllEnvs());
it("issues short-lived notification tokens only for fresh requests signed by DOKU", () => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  vi.stubEnv("DOKU_ENVIRONMENT", "sandbox");
  vi.stubEnv("DOKU_CLIENT_ID", "test-client");
  vi.stubEnv("DOKU_SECRET_KEY", "test-secret");
  vi.stubEnv(
    "DOKU_PUBLIC_KEY",
    keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
  );
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const headers = new Headers({
    "x-client-key": "test-client",
    "x-timestamp": timestamp,
    "x-signature": sign(
      "RSA-SHA256",
      Buffer.from("test-client|" + timestamp),
      keys.privateKey,
    ).toString("base64"),
  });
  const body = { grantType: "client_credentials" };
  expect(issueDokuNotificationToken(headers, body, now)).toMatchObject({
    responseCode: "2007300",
    expiresIn: 900,
    tokenType: "Bearer",
  });
  expect(issueDokuNotificationToken(headers, body, now + 301000)).toBeNull();
  expect(
    issueDokuNotificationToken(headers, { grantType: "other" }, now),
  ).toBeNull();
  headers.set("x-client-key", "other-client");
  expect(issueDokuNotificationToken(headers, body, now)).toBeNull();
  headers.set("x-client-key", "test-client");
  headers.set("x-signature", "forged");
  expect(issueDokuNotificationToken(headers, body, now)).toBeNull();
});
