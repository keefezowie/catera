import { useEffect, useRef } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { useColors, useReduced } from "@catera/mobile-ui";

const RING = 1.5;
const ease = Easing.bezier(...nativeMotion.ease);

/**
 * The opacity of a choice's mark: 1 while chosen, 0 when not, fading over `control` when the choice changes (never on
 * mount), and changing at once under reduced motion. Shared by Jelajah's pill ring and Beranda's sun and moon discs, so
 * both switches answer on the same curve and clock.
 */
export function useChoiceFade(selected: boolean) {
  const reduced = useReduced();
  const shown = useSharedValue(selected ? 1 : 0);
  const was = useRef(selected);
  useEffect(() => {
    if (was.current === selected) return;
    was.current = selected;
    const target = selected ? 1 : 0;
    shown.value = reduced ? target : withTiming(target, { duration: nativeMotion.control, easing: ease });
  }, [selected, reduced, shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  return reduced ? { opacity: selected ? 1 : 0 } : fade;
}

/**
 * The mark on the chosen meal in Jelajah's meal segment: a 1.5 forest ring (forest
 * marks a selection, palette K rule 3) on an optional fill. It is drawn over its parent's box (`inset` grows it past the
 * box without moving the layout) and fades in over `control` when its meal is chosen and out when it is not, so the
 * choice reads at once and the two marks never swap in a blink. Under reduced motion it changes at once.
 */
export function SelectionRing({
  selected,
  radius,
  fill,
  inset,
  testID,
}: {
  selected: boolean;
  radius: number;
  fill?: string;
  /** How far past the parent's edges the ring sits, in dp. */
  inset?: { x: number; y: number };
  testID?: string;
}) {
  const c = useColors();
  // Only a change of choice animates: the ring a screen opens with is simply there.
  const fade = useChoiceFade(selected);
  const frame: ViewStyle = inset
    ? { position: "absolute", top: -inset.y, bottom: -inset.y, left: -inset.x, right: -inset.x }
    : StyleSheet.absoluteFill;
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        frame,
        {
          borderRadius: radius,
          borderCurve: "continuous",
          borderWidth: RING,
          // forest: selection (the chosen meal)
          borderColor: c.forest,
          backgroundColor: fill,
        },
        fade,
      ]}
    />
  );
}
