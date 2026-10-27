import * as SecureStore from "expo-secure-store";
import type { MobileRuntime } from "./runtime";

/** Email links come back to the app's auth/callback route; Supabase must allow each as a redirect URL. */
export const redirectFor = (scheme: "catera" | "catera-dapur") => `${scheme}://auth/callback`;
/** Seconds before a "resend" or a rate-limited retry is offered again. */
export const RATE_WAIT_S = 60;
/** PKCE binds an email link to the device that asked for it; this remembers why, where to return, and for whom. */
export const pendingKey = (runtime: MobileRuntime) => runtime.storageKey("auth.pending");

export type Pending = { purpose: "signup" | "recovery"; next: string; at: number; email: string };

/** `next` must already be a safe in-app path (the caller normalises it). */
export async function savePending(
  runtime: MobileRuntime,
  purpose: Pending["purpose"],
  next: string,
  email: string,
) {
  await SecureStore.setItemAsync(
    pendingKey(runtime),
    JSON.stringify({ purpose, next, at: Date.now(), email } satisfies Pending),
  );
}

export async function readPending(runtime: MobileRuntime): Promise<Pending | null> {
  const raw = await SecureStore.getItemAsync(pendingKey(runtime));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Pending>;
    if ((value.purpose !== "signup" && value.purpose !== "recovery") || typeof value.next !== "string") return null;
    return { purpose: value.purpose, next: value.next, at: Number(value.at) || 0, email: typeof value.email === "string" ? value.email : "" };
  } catch {
    return null;
  }
}

export const clearPending = (runtime: MobileRuntime) => SecureStore.deleteItemAsync(pendingKey(runtime));

export function authClient(runtime: MobileRuntime) {
  if (!runtime.supabase) throw new Error("NOT_CONFIGURED");
  return runtime.supabase;
}

/** True when the request never reached the server (no network, DNS, timeout). */
export function isOffline(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const e = error as { name?: string; status?: number } | null;
  return !!e && typeof e === "object" && (e.name === "AuthRetryableFetchError" || e.status === 0);
}

/** Supabase auth errors as Catera error codes (errorLabel has a sentence for each). */
export function authError(error: { status?: number; code?: string; name?: string } | null | undefined) {
  if (!error) return;
  throw new Error(
    isOffline(error)
      ? "OFFLINE"
      : error.status === 429
        ? "AUTH_RATE_LIMITED"
        : error.code === "email_not_confirmed"
          ? "EMAIL_NOT_CONFIRMED"
          : ["weak_password", "same_password"].includes(error.code || "")
            ? "PASSWORD_REJECTED"
            : "AUTH_UNAVAILABLE",
  );
}

export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
