import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, expect, it, vi } from "vitest";

let locale: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "catera_locale" && locale ? { value: locale } : undefined) }),
}));

// The web workspace resolves its own React; render with that one (no JSX in this file).
const webRequire = createRequire(resolve("apps/web/package.json"));
const { renderToStaticMarkup } = webRequire("react-dom/server") as typeof import("react-dom/server");

beforeEach(() => {
  locale = undefined;
});

async function render() {
  const { default: Page } = await import("../apps/web/src/app/syarat-dan-privasi/page");
  return renderToStaticMarkup(await Page());
}

it("the page renders and says it is a placeholder", async () => {
  const html = await render();
  expect(html).toContain("<h1>Syarat dan privasi</h1>");
  // The first text after the heading is the placeholder notice.
  expect(html.indexOf("terms-notice")).toBeGreaterThan(html.indexOf("</h1>"));
  expect(html.indexOf("terms-notice")).toBeLessThan(html.indexOf("<h2"));
  expect(html).toMatch(/<p[^>]*class="terms-notice"[^>]*>[^<]*sementara/i);
  // Hapus akun links to the privacy section.
  expect(html).toContain('id="privasi"');
  expect(html).toContain('id="syarat"');
  // Nothing invented: no dates, no company names, no em dash.
  expect(html).not.toMatch(/—|\b(19|20)\d{2}\b|PT |CV /);
  expect(html).not.toMatch(/Anda\b/);
});

it("the page speaks English when the locale cookie says so", async () => {
  locale = "en";
  const html = await render();
  expect(html).toContain("<h1>Terms and privacy</h1>");
  expect(html).toMatch(/temporary/i);
});

it("both Pengaturan rows open the page and the TODO is gone", () => {
  const shared = readFileSync(resolve("packages/mobile-ui/src/settings/Pengaturan.tsx"), "utf8");
  expect(shared).not.toContain("Segera hadir");
  expect(shared).not.toContain("TODO: open the web terms page");
  expect(shared).toContain("/syarat-dan-privasi");
});
