import * as SecureStore from "expo-secure-store";
import type { Actor } from "@catera/domain";
import type { MobileRuntime } from "@catera/mobile-core";
import { catererSlug } from "../onboarding";
import { tabsForRole } from "../roles";

/** What Daftar leaves in the new account's metadata, so the kitchen is made on the first signed-in session. */
export type PendingKitchen = { name: string; area: string; whatsapp?: string; slugSuffix: string };

type Command = <T = Record<string, unknown>>(action: string, payload: unknown) => Promise<T>;

/**
 * The first signed-in session after a confirmed sign-up finishes what the sign-up asked for: Daftar's kitchen
 * (`pendingKitchen`, made by seller.create) or Gabung's invite (`pendingInvite`, accepted by invite.accept). The slug
 * suffix was chosen at sign-up, so a retry after an app restart asks for the same slug. An account that already has a
 * kitchen (the create went through but the metadata was not cleared) only has the metadata cleared.
 * Returns whether anything was pending.
 */
export async function settlePending(runtime: MobileRuntime, command: Command, actor: Actor): Promise<boolean> {
  const client = runtime.supabase;
  if (!client) return false;
  const { data } = await client.auth.getSession();
  const meta = (data.session?.user.user_metadata ?? {}) as { pendingKitchen?: PendingKitchen | null; pendingInvite?: string | null };
  const kitchen = meta.pendingKitchen;
  const invite = meta.pendingInvite;
  if (!kitchen && !invite) return false;
  if (!(await hasKitchen(runtime, actor))) {
    if (kitchen) await createKitchen(runtime, command, actor, kitchen);
    else if (invite)
      await command("invite.accept", { code: invite }).catch(async (e: unknown) => {
        // A code that is not (or no longer) valid is dropped, so the gate's own code field takes over with it filled in.
        if (((e as { code?: string }).code || (e as Error).message) === "NOT_FOUND") {
          await clearPendingSetup(runtime);
          throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND", invite });
        }
        throw e;
      });
  }
  await clearPendingSetup(runtime);
  return true;
}

/**
 * The account as the server has it now: a retry after a create that went through (but answered with an error, or whose
 * re-read failed) must not create again.
 */
const hasKitchen = async (runtime: MobileRuntime, fallback: Actor) => {
  const now = await runtime.api.me().then((r) => r.actor, () => fallback);
  return !!now && tabsForRole(now.role).length > 0;
};

/** Makes the kitchen on this account (seller.create), unless it already has one. */
export async function createKitchen(runtime: MobileRuntime, command: Command, actor: Actor, kitchen: PendingKitchen) {
  await command("seller.create", {
    name: kitchen.name,
    slug: catererSlug(kitchen.name, kitchen.slugSuffix),
    description: "",
    areas: [kitchen.area],
    ...(kitchen.whatsapp ? { whatsapp: kitchen.whatsapp } : {}),
  }).catch(async (e: unknown) => {
    // The same slug again is the earlier create having gone through: done when the account now has its kitchen.
    if (!(await hasKitchen(runtime, { ...actor, role: "customer" }))) throw e;
  });
}

/**
 * What Daftar's steps collected when the email already had an account, kept on this phone so the first three steps need
 * no retyping after signing in. RoleGate reads it; only the press on "Buka dapur" makes a kitchen. It carries the email
 * it was typed for: another account on this phone is never offered it, and the read lets it go (an older value has none).
 */
const heldKitchenKey = (runtime: MobileRuntime) => runtime.storageKey("auth.kitchen");
export const holdKitchen = (runtime: MobileRuntime, kitchen: PendingKitchen, email: string) =>
  SecureStore.setItemAsync(heldKitchenKey(runtime), JSON.stringify({ ...kitchen, email: email.trim().toLowerCase() })).catch(() => undefined);
export async function readHeldKitchen(runtime: MobileRuntime): Promise<PendingKitchen | null> {
  const held = await SecureStore.getItemAsync(heldKitchenKey(runtime)).catch(() => null);
  if (!held) return null;
  try {
    const { email, ...kitchen } = JSON.parse(held) as PendingKitchen & { email?: string };
    const session = await runtime.supabase?.auth.getSession();
    if (email && email === session?.data.session?.user.email?.toLowerCase()) return kitchen;
  } catch {
    // Unreadable: let go below.
  }
  await clearHeldKitchen(runtime);
  return null;
}
export const clearHeldKitchen = (runtime: MobileRuntime) => SecureStore.deleteItemAsync(heldKitchenKey(runtime)).catch(() => undefined);

/** Drops both sign-up intents from the account's metadata. */
export async function clearPendingSetup(runtime: MobileRuntime) {
  await runtime.supabase?.auth.updateUser({ data: { pendingKitchen: null, pendingInvite: null } });
}

/** Gabung's code, kept on this phone when the person signs in with an account they already have ("Masuk dulu"). */
const heldInviteKey = (runtime: MobileRuntime) => runtime.storageKey("auth.invite");
export const holdInvite = (runtime: MobileRuntime, code: string) =>
  code.trim() ? SecureStore.setItemAsync(heldInviteKey(runtime), JSON.stringify({ code: code.trim(), at: Date.now() })).catch(() => undefined) : Promise.resolve();
/** The held code, once: RoleGate fills its invite field with it. */
export async function takeHeldInvite(runtime: MobileRuntime): Promise<string> {
  const raw = await SecureStore.getItemAsync(heldInviteKey(runtime)).catch(() => null);
  if (!raw) return "";
  await SecureStore.deleteItemAsync(heldInviteKey(runtime)).catch(() => undefined);
  try {
    const held = JSON.parse(raw) as { code?: string; at?: number };
    return held.code && Date.now() - (held.at ?? 0) < 15 * 60_000 ? held.code : "";
  } catch {
    return "";
  }
}

/** Lets go of both, so nothing typed for one account waits on this phone for the next. */
export async function clearHeld(runtime: MobileRuntime) {
  await clearHeldKitchen(runtime);
  await SecureStore.deleteItemAsync(heldInviteKey(runtime)).catch(() => undefined);
}
