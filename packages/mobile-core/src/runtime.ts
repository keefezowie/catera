import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import * as ReactNative from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createApi } from "@catera/api-client";
import type { Actor } from "@catera/domain";
import { isOffline } from "./emailAuth";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";

type WebBrowserModule = typeof import("expo-web-browser");
type AppleModule = typeof import("expo-apple-authentication");

// Required when used, not at load: Dapur ships neither module, and expo-apple-authentication has no Android native side.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webBrowser = () => require("expo-web-browser") as WebBrowserModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const apple = () => require("expo-apple-authentication") as AppleModule;

let oauthOpen = false;
/**
 * True while a Google sign-in browser is open. On Android the redirect (catera://auth/callback?code=...) also reaches
 * expo-router as a deep link; `+native-intent` drops it then, because `signInWithGoogle` exchanges that code itself and
 * the email-link screen would call it expired (no pending email request).
 */
export const oauthRedirectPending = () => oauthOpen;

/** Whether "Lanjut dengan Apple" can show: iOS, and the device supports Sign in with Apple. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return apple().isAvailableAsync().catch(() => false);
}

/** A provider failure as a Catera code: offline, the rate limit, or the service (a provider not enabled included). */
function providerError(error: unknown): Error {
  const status = (error as { status?: number } | null)?.status;
  return new Error(isOffline(error) ? "OFFLINE" : status === 429 ? "AUTH_RATE_LIMITED" : "AUTH_UNAVAILABLE");
}

/** `code` and `error` from a redirect URL, in its query or its fragment. */
function redirectParams(url: string): { code: string; error: string } {
  const read = (part: string) => new URLSearchParams(part);
  const [beforeHash, hash = ""] = url.split("#");
  const query = read(beforeHash.includes("?") ? beforeHash.slice(beforeHash.indexOf("?") + 1) : "");
  const fragment = read(hash);
  return {
    code: query.get("code") || fragment.get("code") || "",
    error: query.get("error") || fragment.get("error") || "",
  };
}

export type MobileRuntimeConfig = {
  apiUrl: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  /** SecureStore key prefix, e.g. "catera" or "dapur", so two apps never share keys. */
  storagePrefix: string;
  /** Which app is counting its daily use; sent with every usage count and nothing else. */
  app: "customer" | "dapur";
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

/**
 * Empties the app's native cookie store. It never throws and waits at most two seconds, so a store that never answers
 * cannot hold sign-out up.
 *
 * The store is shared, and clearing all of it is intended at sign-out. On Android it is the app's CookieManager, which
 * React Native's networking, expo/fetch and any WebView all use. On iOS it is `HTTPCookieStorage.shared`. In Expo Go
 * every project runs in the one Expo Go app, so it clears the cookies of the other projects too.
 */
function clearNativeCookies(): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 2000);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    try {
      // React Native exports Networking at runtime; the classic typings (types/index.d.ts) leave it out.
      const { Networking } = ReactNative as unknown as {
        Networking: { clearCookies: (callback: (cleared: boolean) => void) => void };
      };
      Networking.clearCookies(done);
    } catch {
      done();
    }
  });
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
  // Bearer only: the phone never keeps or sends the API's cookies, so the token is the whole session. The direct
  // fetches to the Catera API (uploads, proof photos, the import assistant) pass `credentials: "omit"` too.
  const api = createApi(apiBase, token, { timeoutMs: 15_000, credentials: "omit" });

  /** `name` names a brand-new profile when the account carries none (default "Katering"). */
  async function signInPassword(email: string, password: string, requestId: string, name = "Katering") {
    if (!supabase) throw new Error("NOT_CONFIGURED");
    if (!email.trim() || !password) throw new Error("INVALID_CREDENTIALS");
    const { data, error } = await supabase.auth
      .signInWithPassword({ email: email.trim(), password })
      .catch((e: unknown) => ({ data: null, error: e as { status?: number; code?: string } }));
    if (error || !data?.session)
      throw new Error(
        isOffline(error)
          ? "OFFLINE"
          : error?.status === 429
          ? "AUTH_RATE_LIMITED"
          : error?.code === "email_not_confirmed"
            ? "EMAIL_NOT_CONFIRMED"
            : "INVALID_CREDENTIALS",
      );
    await SecureStore.deleteItemAsync(key("demo.token"));
    const given =
      typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : "";
    try {
      return await ensureActor(supabase, given || name, requestId);
    } catch (e) {
      await supabase.auth.signOut({ scope: "local" });
      throw e;
    }
  }

  /** A provider session is in: drop any demo token, then make sure the profile exists (signed out again if not). */
  async function finishProviderSignIn(client: SupabaseClient, name: string, requestId: string) {
    await SecureStore.deleteItemAsync(key("demo.token"));
    try {
      return await ensureActor(client, name, requestId);
    } catch (e) {
      await client.auth.signOut({ scope: "local" });
      throw e;
    }
  }

  /**
   * Google through Supabase OAuth (PKCE). The auth session captures the redirect itself and the code is exchanged
   * here. Cancel, dismiss or a declined consent throws `CANCELLED`, which callers ignore; otherwise `OFFLINE`,
   * `AUTH_RATE_LIMITED` or `AUTH_UNAVAILABLE`. A provider that is not enabled shows its error in the browser, so it
   * comes back as a cancel when the person closes it.
   */
  async function signInWithGoogle(redirectTo: string, requestId: string) {
    if (!supabase) throw new Error("NOT_CONFIGURED");
    const { data, error } = await supabase.auth
      .signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } })
      .catch((e: unknown) => ({ data: { url: null }, error: e }));
    if (error || !data?.url) throw providerError(error);
    oauthOpen = true;
    try {
      const result = await webBrowser().openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") throw new Error("CANCELLED");
      const params = redirectParams(result.url);
      if (params.error === "access_denied") throw new Error("CANCELLED");
      if (params.error || !params.code) throw new Error("AUTH_UNAVAILABLE");
      const exchanged = await supabase.auth
        .exchangeCodeForSession(params.code)
        .catch((e: unknown) => ({ data: { user: null, session: null }, error: e }));
      if (exchanged.error || !exchanged.data.session) throw providerError(exchanged.error);
      const meta = exchanged.data.user?.user_metadata ?? {};
      const name = String(meta.full_name || meta.name || "");
      return await finishProviderSignIn(supabase, name, requestId);
    } finally {
      oauthOpen = false;
    }
  }

  /** Sign in with Apple, iOS only (`NOT_AVAILABLE` elsewhere): a hashed nonce to Apple, the raw one to Supabase. */
  async function signInWithApple(requestId: string) {
    if (Platform.OS !== "ios") throw new Error("NOT_AVAILABLE");
    if (!supabase) throw new Error("NOT_CONFIGURED");
    const Apple = apple();
    const rawNonce = Crypto.randomUUID();
    const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const credential = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
      nonce,
    }).catch((e: unknown) => {
      throw new Error((e as { code?: string } | null)?.code === "ERR_REQUEST_CANCELED" ? "CANCELLED" : "AUTH_UNAVAILABLE");
    });
    if (!credential.identityToken) throw new Error("AUTH_UNAVAILABLE");
    const { data, error } = await supabase.auth
      .signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce })
      .catch((e: unknown) => ({ data: { user: null, session: null }, error: e }));
    if (error || !data.session) throw providerError(error);
    // Apple sends the name on the first sign-in only, so it is also kept on the account, best effort.
    const given = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ");
    if (given) await supabase.auth.updateUser({ data: { full_name: given } }).catch(() => undefined);
    const meta = data.user?.user_metadata ?? {};
    return finishProviderSignIn(supabase, given || String(meta.full_name || meta.name || ""), requestId);
  }

  async function demoLogin(role: "owner" | "staff" | "customer") {
    // A fetch that never got a response (TypeError) or timed out is the phone being offline; an ApiError with a
    // code is the server answering and stays as it is.
    const r = await api.request<{ token: string }>("auth/demo", { role }).catch((e: unknown) => {
      throw isOffline(e) || (e as { code?: string } | null)?.code === "REQUEST_TIMEOUT" ? new Error("OFFLINE") : e;
    });
    await supabase?.auth.signOut({ scope: "local" });
    await SecureStore.setItemAsync(key("demo.token"), r.token);
  }

  /**
   * Ends the session on this phone: the demo token, the Supabase session and every cookie in the native cookie store.
   * The cookies matter for an install from before requests omitted them: the demo login's `catera_v1_demo` cookie was
   * kept there and signed the phone straight back in.
   */
  async function signOut() {
    // The demo session also lives in an httpOnly web cookie. Fire the logout best effort and do not wait for it,
    // so a hanging network never stalls sign-out. A build with no Supabase only talks to the demo backend, whose cookie
    // can outlive the stored token (Expo Go shares one cookie jar between the apps), so it always asks.
    if (!supabase || (await SecureStore.getItemAsync(key("demo.token"))))
      void Promise.resolve(api.request("auth/logout", {})).catch(() => undefined);
    await SecureStore.deleteItemAsync(key("demo.token"));
    await clearNativeCookies();
    const result = await supabase?.auth.signOut({ scope: "local" });
    if (result?.error) throw result.error;
  }

  return {
    config,
    apiBase,
    supabase,
    api,
    token,
    storageKey: key,
    signInPassword,
    signInWithGoogle,
    signInWithApple,
    demoLogin,
    signOut,
  };
}
