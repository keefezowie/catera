import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { nativeArt } from "@catera/design-tokens";
import { decorative } from "./decorative";

/** The ring's first scale; `progress` 1 is full size. */
const START_SCALE = 0.35;

/**
 * The code-drawn disc behind the success rig (spec 7.1): the Siang header cream (`nativeArt.successDisc`) with a
 * 3dp sunrise-ink ring. It grows from 0.35 to 1 by transform only as `progress` goes from 0 to 1; the caller drives
 * `progress` (420ms in the beat) and sets it to 1 at once under reduced motion. The check lives in the delivered badge
 * layer, not here. Its colours are fixed `nativeArt` inks, the same in both themes, like the art in front of it.
 */
export function SuccessRing({ size, progress }: { size: number; progress: SharedValue<number> }) {
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: START_SCALE + (1 - START_SCALE) * progress.value }] }));
  return (
    <Animated.View
      testID="success-ring"
      {...decorative}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: nativeArt.successDisc,
          borderWidth: 3,
          borderColor: nativeArt.successRing,
        },
        grow,
      ]}
    />
  );
}
