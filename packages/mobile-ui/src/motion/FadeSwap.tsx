import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, FadeIn } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { useReduced } from "./useReduced";

const ease = Easing.bezier(...nativeMotion.ease);
const makeFade = () => FadeIn.duration(nativeMotion.content).easing(ease);

/**
 * Fades fresh content in over `nativeMotion.content` when `swapKey` changes; instant under reduced motion. The wrapper
 * sizes to its content; `style` is for a caller whose child must fill a region (`{ flex: 1 }`), merged under the fade.
 *
 * The wrapper is keyed on `swapKey` and fades with a layout animation, so the fresh content is mounted already hidden
 * in the same UI-thread transaction. A shared value written from JS lands after the React commit (and Reanimated
 * re-applies the registered props on each commit), which let the new content show at full opacity for a frame or more
 * before it dropped and faded. The first key does not fade: nothing fades in on a screen's own first paint.
 * Content that must survive a key change (a form being typed into, a looping mascot) belongs outside the FadeSwap.
 */
export function FadeSwap({
  swapKey,
  children,
  style,
}: {
  swapKey: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReduced();
  const mounted = useRef(false);
  // Decided once per key, the render it first appears in: a later render of the same key (the reduced-motion setting
  // arriving, the first effect) must not hand a mounted layer an animation it will never play.
  const decided = useRef<{
    key: string;
    entering: ReturnType<typeof makeFade> | undefined;
  } | null>(null);
  if (decided.current?.key !== swapKey) {
    decided.current = {
      key: swapKey,
      entering: mounted.current && !reduced ? makeFade() : undefined,
    };
  }
  const { entering } = decided.current;
  // Set in the commit itself, before any passive effect: a re-key landing in the same tick as the first paint still
  // counts as a swap and fades.
  useLayoutEffect(() => {
    mounted.current = true;
  }, []);
  return (
    <Animated.View key={swapKey} entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
