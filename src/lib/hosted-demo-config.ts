// This allowlist belongs only to the explicitly authorized, synthetic demo.
export const HOSTED_DEMO_URL = "https://otmanljypltxkwjcebni.supabase.co";
export const DEMO_ROLES = ["owner", "admin", "subscriber"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export function parseDemoRole(value: unknown): DemoRole | null {
  return typeof value === "string" && DEMO_ROLES.some((role) => role === value)
    ? (value as DemoRole)
    : null;
}

export function hostedDemoEnabled(): boolean {
  const localDemo = process.env.CATERA_DEMO_MODE === "true" && !process.env.VERCEL;
  return !localDemo && process.env.CATERA_HOSTED_DEMO_MODE === "true" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === HOSTED_DEMO_URL;
}
