import { afterEach, describe, expect, it, vi } from "vitest";
import { HOSTED_DEMO_URL, hostedDemoEnabled, parseDemoRole } from "../src/lib/hosted-demo-config";

afterEach(() => vi.unstubAllEnvs());
function configure() {
  vi.stubEnv("CATERA_HOSTED_DEMO_MODE", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", HOSTED_DEMO_URL);
  vi.stubEnv("CATERA_DEMO_MODE", "false");
  vi.stubEnv("VERCEL", "1");
}
describe("isolated hosted demo", () => {
  it("requires explicit opt-in", () => {
    configure();
    vi.stubEnv("CATERA_HOSTED_DEMO_MODE", "false");
    expect(hostedDemoEnabled()).toBe(false);
  });
  it("runs on the dedicated demo project", () => {
    configure();
    expect(hostedDemoEnabled()).toBe(true);
  });
  it("refuses another database", () => {
    configure();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://production.supabase.co");
    expect(hostedDemoEnabled()).toBe(false);
  });
  it("does not replace local synthetic persistence", () => {
    configure();
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("CATERA_DEMO_MODE", "true");
    expect(hostedDemoEnabled()).toBe(false);
  });
  it("only accepts the three demo roles", () => {
    for (const role of ["owner", "admin", "subscriber"])
      expect(parseDemoRole(role)).toBe(role);
    for (const role of [null, {}, "service_role", "__proto__", "constructor", "OWNER", "owner@example.com"])
      expect(parseDemoRole(role)).toBeNull();
  });
});
