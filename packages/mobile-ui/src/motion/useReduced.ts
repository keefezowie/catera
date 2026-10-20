import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

/**
 * True when the system asks for reduced motion (Android "Remove animations", iOS "Reduce Motion").
 * Reanimated reads the setting once at launch, so a change made while the app runs comes from the
 * system's `reduceMotionChanged` event and wins until the next launch.
 */
export function useReduced(): boolean {
  const atLaunch = useReducedMotion();
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (on) => setLive(on));
    return () => sub?.remove?.();
  }, []);
  return live ?? atLaunch;
}
