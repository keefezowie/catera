import { useCallback, useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

/**
 * Reanimated reads the system setting once when it loads, so a change made while the app runs never reaches it.
 * One store holds the live value for every component: a single `reduceMotionChanged` listener, plus one read of
 * the current setting, so a component that mounts after a change starts with the new value.
 */
let live: boolean | null = null;
const subscribers = new Set<() => void>();
let started = false;

function set(next: boolean) {
  if (live === next) return;
  live = next;
  subscribers.forEach((notify) => notify());
}

function start() {
  if (started) return;
  started = true;
  AccessibilityInfo.addEventListener("reduceMotionChanged", set);
  Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
    .then((on) => {
      // Only a "reduce" is taken from the read: "off" is what Reanimated already reported, and an event wins over a late read.
      if (on === true && live === null) set(true);
    })
    .catch(() => {});
}

function subscribe(notify: () => void) {
  start();
  subscribers.add(notify);
  return () => void subscribers.delete(notify);
}

/** True when the system asks for reduced motion (Android "Remove animations", iOS "Reduce Motion"), also when it changes while the app runs. */
export function useReduced(): boolean {
  const atLaunch = useReducedMotion();
  const value = useSyncExternalStore(subscribe, useCallback(() => live, []), () => null);
  return value ?? atLaunch;
}

/** Tests only: forget the live value and the listener so the next mount starts from scratch. */
export function resetReducedMotionStore() {
  live = null;
  started = false;
  subscribers.clear();
}
