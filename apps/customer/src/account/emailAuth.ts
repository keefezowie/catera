import * as SecureStore from "expo-secure-store";
import type { MobileRuntime } from "@catera/mobile-core";
import { nativeReturnPath } from "../auth";

/** Email links come back to this app route; Supabase must allow it as a redirect URL. */
export const REDIRECT_TO = "catera://auth/callback";
/** PKCE binds an email link to the device that asked for it; this remembers why and where to return. */
export const pendingKey = (runtime: MobileRuntime) => runtime.storageKey("auth.pending");

export type Pending = { purpose: "signup" | "recovery"; next: string; at: number };

export async function savePending(runtime: MobileRuntime, purpose: Pending["purpose"], next: string) {
  await SecureStore.setItemAsync(
    pendingKey(runtime),
    JSON.stringify({ purpose, next: nativeReturnPath(next), at: Date.now() } satisfies Pending),
  );
}

export function authClient(runtime: MobileRuntime) {
  if (!runtime.supabase) throw new Error("NOT_CONFIGURED");
  return runtime.supabase;
}

/** Supabase auth errors as Catera error codes (errorLabel has a sentence for each). */
export function authError(error: { status?: number; code?: string } | null) {
  if (!error) return;
  throw new Error(
    error.status === 429
      ? "AUTH_RATE_LIMITED"
      : error.code === "email_not_confirmed"
        ? "EMAIL_NOT_CONFIRMED"
        : ["weak_password", "same_password"].includes(error.code || "")
          ? "PASSWORD_REJECTED"
          : "AUTH_UNAVAILABLE",
  );
}

export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
