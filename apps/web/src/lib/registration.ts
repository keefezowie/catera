import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeReturnPath } from "./navigation";

export const emailSchema = z.string().trim().email().max(254);
export const newPasswordSchema = z.string().min(8).max(256);
export const registrationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: newPasswordSchema,
  next: z.string().optional(),
});

export function confirmationUrl(
  origin: string,
  next: unknown,
  recovery = false,
) {
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set(
    "next",
    recovery
      ? "/reset-password"
      : safeReturnPath(typeof next === "string" ? next : null) || "/home",
  );
  return url.toString();
}

export function authError(error: { status?: number; code?: string } | null) {
  if (!error) return;
  if (error.status === 429) throw new Error("AUTH_RATE_LIMITED");
  if (error.code === "email_not_confirmed")
    throw new Error("EMAIL_NOT_CONFIRMED");
  if (error.code === "weak_password" || error.code === "same_password")
    throw new Error("PASSWORD_REJECTED");
  if (
    error.code === "signup_disabled" ||
    error.code === "email_provider_disabled"
  )
    throw new Error("NOT_CONFIGURED");
  throw new Error("AUTH_UNAVAILABLE");
}

export async function registerEmail(
  client: SupabaseClient,
  input: unknown,
  origin: string,
) {
  const value = registrationSchema.parse(input);
  const { data, error } = await client.auth.signUp({
    email: value.email,
    password: value.password,
    options: {
      data: { name: value.name },
      emailRedirectTo: confirmationUrl(origin, value.next),
    },
  });
  // Never let an environment with confirmation disabled silently bypass verification.
  if (data.session) {
    await client.auth.signOut({ scope: "local" });
    throw new Error("NOT_CONFIGURED");
  }
  // Keep account existence private, including projects returning an explicit duplicate error.
  if (error?.code !== "user_already_exists" && error?.code !== "email_exists")
    authError(error);
  return { sent: true };
}
