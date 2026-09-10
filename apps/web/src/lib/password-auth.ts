import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Actor } from "@catera/domain";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
});

export async function passwordSignIn(
  client: SupabaseClient,
  input: unknown,
  ensureProfile: (id: string, token: string, name: string) => Promise<Actor>,
) {
  const credentials = credentialsSchema.parse(input);
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error || !data.user || !data.session) {
    if (error?.status === 429) throw new Error("AUTH_RATE_LIMITED");
    throw new Error("INVALID_CREDENTIALS");
  }
  // Names are presentation data; roles always come from transactional DB rules.
  const name =
    typeof data.user.user_metadata?.name === "string"
      ? data.user.user_metadata.name.slice(0, 100)
      : "Pelanggan";
  const actor = await ensureProfile(
    data.user.id,
    data.session.access_token,
    name,
  );
  return { actor };
}
