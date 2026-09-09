import "server-only";
import { z } from "zod";
import { supabase } from "./auth";
import { HOSTED_DEMO_URL, hostedDemoEnabled, parseDemoRole, type DemoRole } from "./hosted-demo-config";

const sessionSchema = z.object({
  access_token: z.string().min(20),
  refresh_token: z.string().min(10),
});

export async function startHostedDemoSession(role: DemoRole): Promise<void> {
  const key = process.env.CATERA_HOSTED_DEMO_ANON_KEY;
  if (!hostedDemoEnabled() || !parseDemoRole(role) || !key)
    throw new Error("DEMO_DISABLED");
  // This is a PUBLIC anon JWT, not a service-role key. Privileged credentials
  // remain inside the dedicated Edge Function; only user sessions are returned.
  const response = await fetch(`${HOSTED_DEMO_URL}/functions/v1/catera-demo-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ role }),
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error("DEMO_LOGIN_FAILED");
  const session = sessionSchema.parse(await response.json());
  const { error } = await (await supabase()).auth.setSession(session);
  if (error) throw new Error("DEMO_SESSION_FAILED");
}
