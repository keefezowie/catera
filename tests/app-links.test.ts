import { afterEach, expect, it, vi } from "vitest";
import { GET as assetLinks } from "../apps/web/src/app/.well-known/assetlinks.json/route";
import { GET as appleSiteAssociation } from "../apps/web/src/app/.well-known/apple-app-site-association/route";

afterEach(() => vi.unstubAllEnvs());

// Synthetic values only: real signing fingerprints and team ids live in deployment env.
const FINGERPRINT_A = Array.from({ length: 32 }, () => "AB").join(":");
const FINGERPRINT_B = Array.from({ length: 32 }, () => "0C").join(":");

it("serves Android asset links for the customer app from env", async () => {
  vi.stubEnv("CATERA_ANDROID_SHA256", ` ${FINGERPRINT_A}, ${FINGERPRINT_B} ,`);
  const response = await assetLinks();
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toEqual([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "id.catera.customer",
        sha256_cert_fingerprints: [FINGERPRINT_A, FINGERPRINT_B],
      },
    },
  ]);
});

it("serves an empty asset links list when no fingerprint is configured", async () => {
  vi.stubEnv("CATERA_ANDROID_SHA256", "");
  const response = await assetLinks();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
});

it("serves the Apple association for claim and renew links from env", async () => {
  vi.stubEnv("CATERA_APPLE_TEAM_ID", "TEAMID1234");
  const response = await appleSiteAssociation();
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toEqual({
    applinks: {
      details: [
        {
          appIDs: ["TEAMID1234.id.catera.customer"],
          components: [{ "/": "/claim/*" }, { "/": "/renew/*" }],
        },
      ],
    },
  });
});

it("serves an Apple association with no apps when no team is configured", async () => {
  vi.stubEnv("CATERA_APPLE_TEAM_ID", "");
  const response = await appleSiteAssociation();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ applinks: { details: [] } });
});
