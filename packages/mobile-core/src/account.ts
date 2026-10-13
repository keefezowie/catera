import { normalizeCustomerPhone } from "@catera/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The slice of the mobile runtime the account calls need; `useMobile()` and `runtime` supply it. */
export type AccountApi = { request<T>(path: string, body?: unknown): Promise<T> };
export type AccountCommand = <T = Record<string, unknown>>(action: string, payload: unknown) => Promise<T>;

/** Result of a change that demo mode only pretends to make. `simulated` is true only in demo. */
export type AccountChange = { simulated: boolean };

export type AccountRequestKind = "deletion" | "help";
export type AccountRequestResult = {
  id: string;
  status: "open" | "resolved";
  /** True when a deletion request was already open and nothing new was created. */
  existing?: boolean;
};

export const PROFILE_NAME_MIN = 2;
export const PROFILE_NAME_MAX = 80;
export const PASSWORD_MIN = 8;

/** Codes the account callers reject with; the screens map each one to a message. */
export type AccountErrorCode =
  | "INVALID_INPUT"
  | "INVALID_PHONE"
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "NO_EMAIL"
  | "AUTH_RATE_LIMITED"
  | "EMAIL_IN_USE"
  | "PHONE_IN_USE"
  | "CODE_INVALID"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_MISMATCH"
  | "PASSWORD_REJECTED"
  | "PHONE_CHANGE_FAILED"
  | "EMAIL_CHANGE_FAILED";

type Auth = Pick<SupabaseClient, "auth">;
type AuthFailure = { status?: number; code?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP = /^\d{6}$/;

function fail(code: AccountErrorCode): never {
  throw new Error(code);
}

function authFailure(error: AuthFailure, fallback: AccountErrorCode): never {
  if (error.status === 429 || error.code?.startsWith("over_")) fail("AUTH_RATE_LIMITED");
  if (error.code === "email_exists") fail("EMAIL_IN_USE");
  if (error.code === "phone_exists") fail("PHONE_IN_USE");
  if (error.code === "email_address_invalid") fail("INVALID_INPUT");
  if (error.code === "weak_password" || error.code === "same_password") fail("PASSWORD_REJECTED");
  fail(fallback);
}

function phoneNumber(phone: string) {
  try {
    return normalizeCustomerPhone(phone);
  } catch {
    return fail("INVALID_PHONE");
  }
}

/** Renames the signed-in person's own profile (`profile.update`). Rejects INVALID_INPUT before sending when the trimmed name is not 2 to 80 characters. */
export async function updateProfileName(command: AccountCommand, name: string): Promise<{ name: string }> {
  const trimmed = name.trim();
  const length = [...trimmed].length;
  if (length < PROFILE_NAME_MIN || length > PROFILE_NAME_MAX) fail("INVALID_INPUT");
  return command<{ name: string }>("profile.update", { name: trimmed });
}

/**
 * Sends a code to the new number (Supabase `phone_change`) on the mobile session. The web routes `auth/phone-send` and
 * `auth/phone-verify` read a cookie session, so a Bearer-only phone cannot use them. Demo sends nothing.
 */
export async function sendPhoneChangeCode(supabase: Auth | null, demo: boolean, phone: string): Promise<AccountChange> {
  const value = phoneNumber(phone);
  if (demo) return { simulated: true };
  if (!supabase) fail("NOT_CONFIGURED");
  const { error } = await supabase.auth.updateUser({ phone: value });
  if (error) authFailure(error, "PHONE_CHANGE_FAILED");
  return { simulated: false };
}

/** Confirms the six-digit `phone_change` code. Any failure but a taken number or a rate limit is CODE_INVALID. In demo any six digits pass and nothing changes. */
export async function verifyPhoneChangeCode(
  supabase: Auth | null,
  demo: boolean,
  phone: string,
  code: string,
): Promise<AccountChange> {
  const value = phoneNumber(phone);
  if (!OTP.test(code)) fail("INVALID_INPUT");
  if (demo) return { simulated: true };
  if (!supabase) fail("NOT_CONFIGURED");
  const { error } = await supabase.auth.verifyOtp({ phone: value, token: code, type: "phone_change" });
  if (error) authFailure(error, "CODE_INVALID");
  return { simulated: false };
}

/**
 * Asks Supabase to change the email. `double_confirm_changes` is on, so nothing changes until the link in both the
 * old and the new inbox is opened; the caller shows "check your email", never "changed". Demo sends nothing.
 */
export async function requestEmailChange(supabase: Auth | null, demo: boolean, email: string): Promise<AccountChange> {
  const value = email.trim();
  if (!EMAIL.test(value)) fail("INVALID_INPUT");
  if (demo) return { simulated: true };
  if (!supabase) fail("NOT_CONFIGURED");
  const { error } = await supabase.auth.updateUser({ email: value });
  if (error) authFailure(error, "EMAIL_CHANGE_FAILED");
  return { simulated: false };
}

/**
 * Changes the password of the signed-in email account after re-checking the current one against that account's own
 * email, so a phone left unlocked cannot change it. Demo changes nothing.
 */
export async function changePassword(
  supabase: Auth | null,
  demo: boolean,
  input: { current: string; next: string },
): Promise<AccountChange> {
  if (input.next.length < PASSWORD_MIN || input.next.length > 256 || !input.current) fail("INVALID_INPUT");
  if (demo) return { simulated: true };
  if (!supabase) fail("NOT_CONFIGURED");
  const me = await supabase.auth.getUser();
  const user = me.data.user;
  if (me.error || !user) fail("UNAUTHORIZED");
  if (!user.email) fail("NO_EMAIL");
  // A successful sign-in replaces the stored session with fresh tokens; the id check rejects any other account.
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: input.current });
  if (check.error || !check.data.session) {
    if (check.error?.status === 429) fail("AUTH_RATE_LIMITED");
    fail("INVALID_CREDENTIALS");
  }
  if (check.data.user?.id !== user.id) fail("ACCOUNT_MISMATCH");
  const { error } = await supabase.auth.updateUser({ password: input.next });
  if (error) authFailure(error, "PASSWORD_REJECTED");
  return { simulated: false };
}

async function request(command: AccountCommand, kind: AccountRequestKind, body: string, catererId?: string) {
  const text = body.trim();
  if (text.length < 5 || text.length > 2000) throw new Error("INVALID_INPUT");
  return command<AccountRequestResult>("accountRequest.create", {
    kind,
    body: text,
    ...(catererId ? { catererId } : {}),
  });
}

/** Asks the Catera team to delete the account. Made once while a request is open: asking again returns that one (`existing`). */
export const requestAccountDeletion = (command: AccountCommand, body: string): Promise<AccountRequestResult> =>
  request(command, "deletion", body);

/** A help request to Catera; a caterer's staff pass `catererId` (the Dapur "Ubah nama atau kontak dapur" request). */
export const requestHelp = (command: AccountCommand, body: string, catererId?: string): Promise<AccountRequestResult> =>
  request(command, "help", body, catererId);

export type AccountRequestRow = {
  id: string;
  kind: AccountRequestKind;
  status: "open" | "resolved";
  body: string;
  resolution: string | null;
  caterer_id: string | null;
  created_at: string;
};

/** The caller's own requests, newest first, with their status. */
export const listAccountRequests = (api: AccountApi): Promise<AccountRequestRow[]> =>
  api.request<AccountRequestRow[]>("account-requests");
