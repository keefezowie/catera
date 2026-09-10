import type { SupabaseClient } from "@supabase/supabase-js";
import type { Actor } from "@catera/domain";

/** Native owns its session in SecureStore; no second web-cookie login is needed. */
export async function signInNative(
  client: SupabaseClient,
  email: string,
  password: string,
  requestId: string,
): Promise<Actor> {
  if (!email.trim() || !password) throw new Error("INVALID_CREDENTIALS");
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.user || !data.session)
    throw new Error(
      error?.status === 429 ? "AUTH_RATE_LIMITED" : "INVALID_CREDENTIALS",
    );
  try {
    const name =
      typeof data.user.user_metadata?.name === "string"
        ? data.user.user_metadata.name.slice(0, 100)
        : "Pelanggan";
    const profile = await client.rpc("catera_v1_command", {
      action: "profile.ensure",
      payload: { name },
      request_id: requestId,
    });
    if (profile.error) throw profile.error;
    const actor = await client.rpc("catera_v1_read", {
      resource: "actor",
      params: {},
    });
    if (actor.error) throw actor.error;
    if (!actor.data || actor.data.id !== data.user.id)
      throw new Error("UNAUTHORIZED");
    return actor.data as Actor;
  } catch (error) {
    await client.auth.signOut({ scope: "local" });
    throw error;
  }
}

export function nativeReturnPath(value?: string): string {
  if (!value || /[\\\u0000-\u0020]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://catera.invalid");
    if (!value.startsWith("/") || url.origin !== "https://catera.invalid")
      return "/";
    if (
      !/^\/(?:discover|calendar|messages|account|addresses|notifications|support|compare|(?:checkout|payment|package|delivery|subscriptions)\/[^/]+)?$/.test(
        url.pathname,
      )
    )
      return "/";
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}

export function nativeSignInPath(actor: Actor, next?: string): string {
  return actor.role === "customer" ? nativeReturnPath(next) : "/account";
}
