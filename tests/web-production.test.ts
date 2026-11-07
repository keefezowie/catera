import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Production-readiness audit (2026-10-31): headers, crawl files and the icon set the web app ships. */
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@catera/backend", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  rpc: state.rpc,
}));
// Outside a Next render there is no cache store; the sitemap reads the catalog straight through.
vi.mock("next/cache", () => ({ unstable_cache: (read: unknown) => read }));
import config, { securityHeaders } from "../apps/web/next.config";
import robots from "../apps/web/src/app/robots";
import sitemap from "../apps/web/src/app/sitemap";
import { publicOrigin } from "../apps/web/src/lib/public-url";

const env = { ...process.env };
beforeEach(() => {
  state.rpc.mockReset();
  process.env.CATERA_PUBLIC_URL = "https://catera.example/";
});
afterEach(() => {
  process.env = { ...env };
});

describe("security headers", () => {
  it("sends the hardening set on every route", async () => {
    const rules = await config.headers!();
    expect(rules).toEqual([{ source: "/(.*)", headers: securityHeaders }]);
    const keys = securityHeaders.map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Strict-Transport-Security",
        "Content-Security-Policy",
        "Permissions-Policy",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
      ]),
    );
    const csp = securityHeaders.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(config.poweredByHeader).toBe(false);
  });
});

describe("public origin", () => {
  it("prefers the configured origin, then Vercel's production host", () => {
    expect(publicOrigin()).toBe("https://catera.example");
    delete process.env.CATERA_PUBLIC_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "catera-eight.vercel.app";
    expect(publicOrigin()).toBe("https://catera-eight.vercel.app");
  });
});

describe("robots and sitemap", () => {
  it("keeps private routes out of search and points at the sitemap", () => {
    const file = robots();
    const rule = Array.isArray(file.rules) ? file.rules[0] : file.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(
      expect.arrayContaining(["/api/", "/admin", "/seller", "/account", "/checkout", "/payment"]),
    );
    expect(file.sitemap).toBe("https://catera.example/sitemap.xml");
  });

  it("lists the public catalog once per package and caterer", async () => {
    state.rpc.mockResolvedValueOnce({
      items: [
        { slug: "nasi-liwet", catererSlug: "dapur-senja" },
        { slug: "sayur-asem", catererSlug: "dapur-senja" },
      ],
    });
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toEqual([
      "https://catera.example",
      "https://catera.example/login",
      "https://catera.example/register",
      "https://catera.example/packages/nasi-liwet",
      "https://catera.example/caterers/dapur-senja",
      "https://catera.example/packages/sayur-asem",
    ]);
    expect(state.rpc).toHaveBeenCalledWith(null, null, "catera_v1_read", {
      resource: "catalog",
      params: { limit: 100 },
    });
  });

  it("still serves the static routes when the database is not configured", async () => {
    state.rpc.mockRejectedValueOnce(new Error("NOT_CONFIGURED"));
    expect((await sitemap()).map((e) => e.url)).toEqual([
      "https://catera.example",
      "https://catera.example/login",
      "https://catera.example/register",
    ]);
  });
});

describe("icons and share image", () => {
  it.each(["icon.png", "apple-icon.png", "opengraph-image.png", "opengraph-image.alt.txt"])(
    "ships apps/web/src/app/%s",
    (file) => {
      expect(existsSync(new URL("../apps/web/src/app/" + file, import.meta.url))).toBe(true);
    },
  );
});
