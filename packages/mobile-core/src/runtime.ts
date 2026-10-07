import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createApi } from "@catera/api-client";
import type { Actor } from "@catera/domain";

export type MobileRuntimeConfig = {
  apiUrl: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  /** SecureStore key prefix, e.g. "catera" or "dapur", so two apps never share keys. */
  storagePrefix: string;
};

export type MobileRuntime = ReturnType<typeof createMobileRuntime>;

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, v: string) => SecureStore.setItemAsync(key, v),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

/** Ensures the Catera profile exists for a fresh Supabase session and returns the actor. */
export async function ensureActor(
  client: SupabaseClient,
  name: string,
  requestId: string,
): Promise<Actor> {
  const profile = await client.rpc("catera_v1_command", {
    action: "profile.ensure",
    payload: { name: name.slice(0, 100) },
    request_id: requestId,
  });
  if (profile.error) throw profile.error;
  const actor = await client.rpc("catera_v1_read", { resource: "actor", params: {} });
  if (actor.error) throw actor.error;
  if (!actor.data) throw new Error("UNAUTHORIZED");
  return actor.data as Actor;
}

/** Stateless services shared by the Catera apps: session, API and sign-in. */
export function createMobileRuntime(config: MobileRuntimeConfig) {
  const apiBase = config.apiUrl.trim().replace(/\/+$/, "");
  const key = (name: string) => `${config.storagePrefix}.${name}`;
  const supabase =
    config.supabaseUrl && config.supabaseKey
      ? createClient(config.supabaseUrl, config.supabaseKey, {
          auth: {
            storage: secureStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            flowType: "pkce",
          },
        })
      : null;
  const token = async () =>
    (await SecureStore.getItemAsync(key("demo.token"))) ||
    (await supabase?.auth.getSession())?.data.session?.access_token ||
    null;
  const api = createApi(apiBase, token, { timeoutMs: 15_000 });

  async function signInPassword(email: string, password: string, requestId: string) {
    if (!supabase) throw new Error("NOT_CONFIGURED");
    if (!email.trim() || !password) throw new Error("INVALID_CREDENTIALS");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.session)
      throw new Error(
        error?.status === 429
          ? "AUTH_RATE_LIMITED"
          : error?.code === "email_not_confirmed"
            ? "EMAIL_NOT_CONFIRMED"
            : "INVALID_CREDENTIALS",
      );
    await SecureStore.deleteItemAsync(key("demo.token"));
    const name =
      typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : "";
    try {
      return await ensureActor(supabase, name || "Katerer", requestId);
    } catch (e) {
      await supabase.auth.signOut({ scope: "local" });
      throw e;
    }
  }

  /** Phone OTP straight through Supabase; the web's /auth/phone-* routes are cookie-bound. */
  async function sendPhoneOtp(phone: string) {
    if (!supabase) throw new Error("NOT_CONFIGURED");
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new Error(error.status === 429 ? "AUTH_RATE_LIMITED" : "INVALID_INPUT");
  }

  async function verifyPhoneOtp(phone: string, otp: string, name: string, requestId: string) {
    if (!supabase) throw new Error("NOT_CONFIGURED");
    const { data, error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    if (error || !data.session) throw new Error("INVALID_OTP");
    await SecureStore.deleteItemAsync(key("demo.token"));
    return ensureActor(supabase, name || "Katerer", requestId);
  }

  async function demoLogin(role: "owner" | "staff" | "customer") {
    const r = await api.request<{ token: string }>("auth/demo", { role });
    await supabase?.auth.signOut({ scope: "local" });
    await SecureStore.setItemAsync(key("demo.token"), r.token);
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(key("demo.token"));
    const result = await supabase?.auth.signOut({ scope: "local" });
    if (result?.error) throw result.error;
  }

  return {
    apiBase,
    supabase,
    api,
    token,
    storageKey: key,
    signInPassword,
    sendPhoneOtp,
    verifyPhoneOtp,
    demoLogin,
    signOut,
  };
}
