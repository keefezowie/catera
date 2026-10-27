import * as SecureStore from "expo-secure-store";
import { authClient, authError, clearPending, savePending, type Pending } from "./emailAuth";
import type { MobileRuntime } from "./runtime";

/** An email link is good for an hour, on the phone that asked for it. */
export const LINK_LIFETIME_MS = 60 * 60 * 1000;

/** What a good link tells the app: whom it signed in, and the intent this phone had recorded for it. */
export type EmailLink = {
  purpose: Pending["purpose"];
  next: string;
  email: string;
  userId: string;
  /** The display name the sign-up stored on the account; "" when none. */
  name: string;
};

/**
 * Finishes an email link (the one place the security checks live, for both apps). Fails with `RECOVERY_EXPIRED`,
 * before any network call, when the link has no code, carries an error, this phone has no pending request for it
 * (`pending`, from `readPending`), the request is older than an hour, or its purpose is not one the app `accepts`
 * (Dapur: recovery only). Otherwise the one-time code is exchanged (PKCE binds it to this phone); a recovery intent
 * is honoured only when the server itself marks the link as recovery, whatever the local intent says. A recovery
 * keeps its pending intent until `saveNewPassword`; any other purpose clears it here.
 */
export async function exchangeEmailLink(
  runtime: MobileRuntime,
  pending: Pending | null,
  link: { code: string; linkError: string },
  accepts: readonly Pending["purpose"][] = ["signup", "recovery"],
): Promise<EmailLink> {
  const expired = () => new Error("RECOVERY_EXPIRED");
  if (!link.code || link.linkError || !pending || !accepts.includes(pending.purpose) || Date.now() - pending.at > LINK_LIFETIME_MS) throw expired();
  const client = authClient(runtime);
  const { data, error } = await client.auth.exchangeCodeForSession(link.code);
  if (error || !data.user || !data.session) throw expired();
  await SecureStore.deleteItemAsync(runtime.storageKey("demo.token"));
  if (pending.purpose === "recovery") {
    const redirectType = (data as typeof data & { redirectType?: string | null }).redirectType;
    if (redirectType !== "recovery") throw expired();
  } else await clearPending(runtime);
  return {
    purpose: pending.purpose,
    next: pending.next,
    email: pending.email,
    userId: data.user.id,
    name: String(data.user.user_metadata?.name || "").slice(0, 100),
  };
}

/**
 * Sets the new password, only for the account the recovery link signed in (`recoveredUserId`, from
 * `exchangeEmailLink`). The session from the link stays and the pending intent is cleared once the password is saved.
 */
export async function saveNewPassword(runtime: MobileRuntime, recoveredUserId: string, password: string) {
  const client = authClient(runtime);
  const { data, error } = await client.auth.getUser();
  if (error || !recoveredUserId || data.user?.id !== recoveredUserId) throw new Error("RECOVERY_EXPIRED");
  authError((await client.auth.updateUser({ password })).error);
  await clearPending(runtime);
}

/** Asks for a new link for what this phone asked for before, and remembers the request. Unknown addresses look the same. */
export async function resendLink(runtime: MobileRuntime, pending: Pick<Pending, "purpose" | "next" | "email">, redirectTo: string) {
  await savePending(runtime, pending.purpose, pending.next, pending.email);
  const client = authClient(runtime);
  if (pending.purpose === "signup") {
    const { error } = await client.auth.resend({ type: "signup", email: pending.email, options: { emailRedirectTo: redirectTo } });
    if (!["user_not_found", "email_exists", "email_not_confirmed"].includes(error?.code || "")) authError(error);
  } else {
    const { error } = await client.auth.resetPasswordForEmail(pending.email, { redirectTo });
    if (error?.code !== "user_not_found") authError(error);
  }
}
