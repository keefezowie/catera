import { useEffect, useRef, useSyncExternalStore } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import type { Actor } from "@catera/domain";
import type { MobileRuntime } from "@catera/mobile-core";

/** Written once onboarding is finished or skipped; never cleared, so it shows on a fresh install only. */
export const onboardingKey = (runtime: Pick<MobileRuntime, "storageKey">) => runtime.storageKey("onboarding.done");

/** Marks onboarding done for this phone. A failed write only means it may show once more. */
export function finishOnboarding(runtime: Pick<MobileRuntime, "storageKey">): Promise<void> {
  return SecureStore.setItemAsync(onboardingKey(runtime), "1").catch(() => undefined);
}

/**
 * Whether this launch opens onboarding: never once the flag is kept. Someone already signed in (an update over an
 * older install) is no newcomer, so the flag is written for them and nothing opens.
 */
export async function onboardingNeeded(runtime: Pick<MobileRuntime, "storageKey">, actor: Actor | null): Promise<boolean> {
  const done = await SecureStore.getItemAsync(onboardingKey(runtime)).catch(() => null);
  if (done) return false;
  if (actor) {
    await finishOnboarding(runtime);
    return false;
  }
  return true;
}

/**
 * A launch from a link (a claim, a sign-in callback) opens what it asked for; onboarding waits for a plain launch.
 * A development build's own launch URL (`…://expo-development-client/?url=…`) and Expo Go's bare `exp://host/--/` are
 * plain launches, not links.
 */
export function isLinkLaunch(url: string | null): boolean {
  if (!url) return false;
  const host = /^[a-z][\w+.-]*:\/\/([^/?#]*)/i.exec(url)?.[1] ?? "";
  if (host === "expo-development-client") return false;
  const path = url
    .replace(/^[a-z][\w+.-]*:\/\/[^/?#]*/i, "")
    .split(/[?#]/)[0]
    .replace(/^\/+/, "")
    .replace(/^--(\/|$)/, "")
    .replace(/^\/+|\/+$/g, "");
  return path !== "";
}

export async function openedFromLink(): Promise<boolean> {
  return isLinkLaunch(await Linking.getInitialURL().catch(() => null));
}

/**
 * Whether the first-run decision is made and shown: no onboarding this launch, or its welcome screen is laid out.
 * Until then the launch cover holds and the root draws a plain canvas over the tabs, so Beranda never flashes before
 * onboarding. A 3s ceiling settles it whatever happens, so the app can never stay covered.
 */
let settled = false;
const listeners = new Set<() => void>();
export function settleFirstRun() {
  if (settled) return;
  settled = true;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export function useFirstRunSettled(): boolean {
  return useSyncExternalStore(subscribe, () => settled, () => settled);
}
/** Tests only: a fresh launch. */
export function resetFirstRunForTests() {
  settled = false;
}

/**
 * The first-run gate, mounted once in the root layout. When the session is ready it checks the flag and, on a fresh
 * install, opens `/mulai` over Beranda (under the launch cover on a cold start). It asks once per JS context.
 */
export function useFirstRunGate({ ready, runtime, actor }: { ready: boolean; runtime: MobileRuntime; actor: Actor | null }) {
  const asked = useRef(false);
  useEffect(() => {
    const ceiling = setTimeout(settleFirstRun, 3000);
    return () => clearTimeout(ceiling);
  }, []);
  useEffect(() => {
    if (!ready || asked.current) return;
    asked.current = true;
    void (async () => {
      if (!(await onboardingNeeded(runtime, actor)) || (await openedFromLink())) return settleFirstRun();
      // Welcome settles the gate once it is laid out (see Onboarding.tsx), so the cover lifts onto it, not Beranda.
      router.push("/mulai" as never);
    })();
  }, [ready, runtime, actor]);
}
