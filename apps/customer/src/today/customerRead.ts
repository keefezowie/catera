import * as SecureStore from "expo-secure-store";
import type { CustomerState } from "@catera/domain";
import type { MobileRuntime } from "@catera/mobile-core";
import { forgetCachedCustomer, loadCachedCustomer, saveCachedCustomer } from "./offline";

/** A customer read; `savedAt` is set when it is the copy this phone kept, not a fresh answer. */
export type LoadedCustomer = { data: CustomerState; savedAt: string | null };

/**
 * Whether this phone still holds `actorId`'s session. Logout deletes the stored actor first, before it forgets the kept
 * copies and signs out, so a missing or different stored actor means the session this read began in has ended.
 */
async function stillSignedIn(runtime: MobileRuntime, actorId: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(runtime.storageKey("actor")).catch(() => null);
  try {
    return !!stored && (JSON.parse(stored) as { id?: string }).id === actorId;
  } catch {
    return false;
  }
}

/**
 * Keeps a fresh read for the next launch, only while its session lasts. A read still out when the person taps Keluar
 * must not write back the copy logout just forgot: it is not saved once the session has ended, and a save that raced
 * logout's first step is taken back. (A save that lands before logout deletes the stored actor is cleared by logout
 * itself, which forgets the copies after that step.)
 */
async function keepCustomer(runtime: MobileRuntime, actorId: string, data: CustomerState): Promise<void> {
  if (!(await stillSignedIn(runtime, actorId))) return;
  await saveCachedCustomer(actorId, { savedAt: new Date().toISOString(), data });
  if (!(await stillSignedIn(runtime, actorId))) await forgetCachedCustomer(actorId);
}

export async function loadCustomer(runtime: MobileRuntime, actorId: string): Promise<LoadedCustomer> {
  try {
    const data = await runtime.api.customer();
    await keepCustomer(runtime, actorId, data);
    return { data, savedAt: null };
  } catch (e) {
    const cached = await keptCustomer(actorId);
    if (cached) return cached;
    throw e;
  }
}

/** The last confirmed read this phone kept for this account, painted at launch while the fresh read runs. */
export async function keptCustomer(actorId: string): Promise<LoadedCustomer | null> {
  const cached = await loadCachedCustomer(actorId);
  return cached ? { data: cached.data, savedAt: cached.savedAt } : null;
}
