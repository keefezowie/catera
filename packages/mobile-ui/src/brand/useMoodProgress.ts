import { useEffect } from "react";
import { Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { useReduced } from "../motion";
import { useMood } from "../mood";

const ease = Easing.bezier(...nativeMotion.ease);

/**
 * 0 in Siang, 1 in Malam, easing between them over `duration` when the mood changes.
 * Under reduced motion the shared value jumps, and callers read `target` directly instead of the animated style so
 * that the change is instant on both threads.
 */
export function useMoodProgress(duration: number): { progress: SharedValue<number>; target: 0 | 1; reduced: boolean } {
  const { mood } = useMood();
  const reduced = useReduced();
  const target = mood === "malam" ? 1 : 0;
  const progress = useSharedValue<number>(target);
  useEffect(() => {
    progress.value = reduced ? target : withTiming(target, { duration, easing: ease });
  }, [progress, target, reduced, duration]);
  return { progress, target, reduced };
}
