import { useEffect, useRef } from "react";
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
 * The first-run gate, mounted once in the root layout. When the session is ready it checks the flag and, on a fresh
 * install, opens `/mulai` over Beranda (under the launch cover on a cold start). It asks once per JS context.
 */
export function useFirstRunGate({ ready, runtime, actor }: { ready: boolean; runtime: MobileRuntime; actor: Actor | null }) {
  const asked = useRef(false);
  useEffect(() => {
    if (!ready || asked.current) return;
    asked.current = true;
    void (async () => {
      if (!(await onboardingNeeded(runtime, actor))) return;
      if (await openedFromLink()) return;
      router.push("/mulai" as never);
    })();
  }, [ready, runtime, actor]);
}
