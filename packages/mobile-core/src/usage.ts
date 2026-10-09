import * as SecureStore from "expo-secure-store";
import { localDay, type Actor, type UsageName } from "@catera/domain";
import type { MobileRuntime } from "./runtime";

/**
 * Sends one anonymous usage count. It never throws, never waits for the answer and never retries:
 * a count lost to a bad connection is better than a screen that stalls or a request loop.
 * Without an actor there is no session to send from, so nothing is sent.
 */
export function sendUsage(runtime: MobileRuntime, actor: Actor | null, name: UsageName): void {
  // A runtime built without an app (a test double, an old caller) has nothing to count for.
  const app = runtime.config.app;
  if (!actor || !app) return;
  try {
    void Promise.resolve(runtime.api.usage(name, app)).catch(() => undefined);
  } catch {
    // The request could not even start; the count is dropped.
  }
}

/**
 * Counts app_open once per Jakarta day. The day is kept in SecureStore, so a new process on the
 * same day does not count again, and in memory, so two foreground events that arrive while the
 * store is still being read make one count. The day is stored before the request is sent, which
 * keeps the count at most once per day even when that request fails.
 */
export function createOpenCounter(runtime: MobileRuntime) {
  let counted = "";
  return async function countOpen(actor: Actor | null): Promise<void> {
    if (!actor || !runtime.config.app) return;
    const today = localDay();
    if (counted === today) return;
    counted = today;
    try {
      const key = runtime.storageKey("usage.app_open");
      if ((await SecureStore.getItemAsync(key)) === today) return;
      await SecureStore.setItemAsync(key, today);
    } catch {
      // Without the stored day we cannot keep the count once-a-day, so this open is not counted.
      return;
    }
    sendUsage(runtime, actor, "app_open");
  };
}
