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

const PHONE = /^\+?\d{8,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP = /^\d{6}$/;

/** Renames the signed-in person's own profile (`profile.update`). Rejects INVALID_INPUT before sending when the trimmed name is not 2 to 80 characters. */
export async function updateProfileName(command: AccountCommand, name: string): Promise<{ name: string }> {
  const trimmed = name.trim();
  if (trimmed.length < PROFILE_NAME_MIN || trimmed.length > PROFILE_NAME_MAX) throw new Error("INVALID_INPUT");
  return command<{ name: string }>("profile.update", { name: trimmed });
}

/** Sends a code to the new number through the web route `auth/phone-send`. Demo sends nothing. */
export async function sendPhoneChangeCode(api: AccountApi, demo: boolean, phone: string): Promise<AccountChange> {
  const value = phone.replace(/[\s-]/g, "");
  if (!PHONE.test(value)) throw new Error("INVALID_INPUT");
  if (demo) return { simulated: true };
  await api.request("auth/phone-send", { phone: value });
  return { simulated: false };
}

/** Confirms the six-digit code through `auth/phone-verify` (Supabase `phone_change`). In demo any six digits pass and nothing changes. */
export async function verifyPhoneChangeCode(
  api: AccountApi,
  demo: boolean,
  phone: string,
  code: string,
): Promise<AccountChange> {
  const value = phone.replace(/[\s-]/g, "");
  if (!PHONE.test(value) || !OTP.test(code)) throw new Error("INVALID_INPUT");
  if (demo) return { simulated: true };
  await api.request("auth/phone-verify", { phone: value, token: code });
  return { simulated: false };
}

/**
 * Asks Supabase to change the email. `double_confirm_changes` is on, so nothing changes until the link in both the
 * old and the new inbox is opened; the caller shows "check your email", never "changed". Demo sends nothing.
 */
export async function requestEmailChange(
  supabase: Pick<SupabaseClient, "auth"> | null,
  demo: boolean,
  email: string,
): Promise<AccountChange> {
  const value = email.trim();
  if (!EMAIL.test(value)) throw new Error("INVALID_INPUT");
  if (demo) return { simulated: true };
  if (!supabase) throw new Error("NOT_CONFIGURED");
  const { error } = await supabase.auth.updateUser({ email: value });
  if (error) throw new Error(error.status === 429 ? "AUTH_RATE_LIMITED" : "INVALID_INPUT");
  return { simulated: false };
}

/**
 * Changes the password of an email account. The current password is checked first with a fresh sign-in, so a phone left
 * unlocked cannot change it; a wrong one rejects INVALID_CREDENTIALS before anything is updated. Demo changes nothing.
 */
export async function changePassword(
  supabase: Pick<SupabaseClient, "auth"> | null,
  demo: boolean,
  input: { email: string; current: string; next: string },
): Promise<AccountChange> {
  if (input.next.length < PASSWORD_MIN || input.next.length > 256 || !input.current) throw new Error("INVALID_INPUT");
  if (demo) return { simulated: true };
  if (!supabase) throw new Error("NOT_CONFIGURED");
  const check = await supabase.auth.signInWithPassword({ email: input.email.trim(), password: input.current });
  if (check.error || !check.data.session)
    throw new Error(check.error?.status === 429 ? "AUTH_RATE_LIMITED" : "INVALID_CREDENTIALS");
  const { error } = await supabase.auth.updateUser({ password: input.next });
  if (error) throw new Error(error.status === 429 ? "AUTH_RATE_LIMITED" : "PASSWORD_REJECTED");
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
