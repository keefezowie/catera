import { useLayoutEffect, useRef, type ReactNode } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Easing } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { useReduced } from "./useReduced";

const ease = Easing.bezier(...nativeMotion.ease);

/** Fades fresh content in over `nativeMotion.content` when `swapKey` changes; instant under reduced motion. */
export function FadeSwap({ swapKey, children }: { swapKey: string; children: ReactNode }) {
  const reduced = useReduced();
  const opacity = useSharedValue(1);
  const last = useRef(swapKey);

  useLayoutEffect(() => {
    if (last.current === swapKey) return;
    last.current = swapKey;
    if (reduced) {
      opacity.value = 1;
      return;
    }
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: nativeMotion.content, easing: ease });
  }, [swapKey, reduced, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
