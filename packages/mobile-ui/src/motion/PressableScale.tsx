import { Pressable, StyleSheet, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { useHaptic } from "./useHaptic";
import { useReduced } from "./useReduced";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESSED_SCALE = 0.97;
const REDUCED_OPACITY = 0.85;
// The dim is the reduced-motion alternative itself, so it must not be skipped by Reanimated's own reduce-motion handling.
const dim = { duration: nativeMotion.control, reduceMotion: ReduceMotion.Never };

export type PressableScaleProps = Omit<PressableProps, "style"> & {
  haptic?: "tap" | "select" | "none";
  /** False for a control whose press changes nothing (the chosen tab): no compress and no dim. Defaults to true. */
  pressFeedback?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Pressable that compresses on press-in; under reduced motion it only dims. Fires a haptic on press. */
export function PressableScale({
  haptic = "tap",
  pressFeedback = true,
  style,
  onPress,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const reduced = useReduced();
  const haptics = useHaptic();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // The press dim multiplies the caller's own opacity (a disabled button rests at 0.45), it never replaces it.
  const resting = StyleSheet.flatten(style)?.opacity;
  const base = typeof resting === "number" ? resting : 1;

  const animated = useAnimatedStyle(
    () => (reduced ? { opacity: base * opacity.value } : { transform: [{ scale: scale.value }] }),
    [reduced, base],
  );

  const pressIn = (e: GestureResponderEvent) => {
    if (!pressFeedback) {
      onPressIn?.(e);
      return;
    }
    if (reduced) opacity.value = withTiming(REDUCED_OPACITY, dim);
    else scale.value = withSpring(PRESSED_SCALE, nativeMotion.spring);
    onPressIn?.(e);
  };
  const pressOut = (e: GestureResponderEvent) => {
    if (reduced) opacity.value = withTiming(1, dim);
    else scale.value = withSpring(1, nativeMotion.spring);
    onPressOut?.(e);
  };
  const press = (e: GestureResponderEvent) => {
    if (haptic !== "none") haptics[haptic]();
    onPress?.(e);
  };

  return (
    <AnimatedPressable {...rest} onPress={press} onPressIn={pressIn} onPressOut={pressOut} style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
