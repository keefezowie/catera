import { useEffect, useRef } from "react";
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { stillRuntime } from "../../../brand/phaseF";
import { useReduced } from "../motion/useReduced";
import { MascotArt, mascotArtFrame, type MascotPose } from "./MascotArt";
import { decorative } from "./decorative";

/** An empty or error state's art: 120pt above its title (spec 7.2). */
export const STATE_ART = 120;
/** What `STATE_ART` becomes on a 360dp phone at font scale 1.3, so the title and its action stay above the fold. */
export const STATE_ART_COMPACT = 96;

const ease = Easing.bezier(...nativeMotion.ease);

/**
 * The size a state's art draws at: `base` (120 for an empty or error state, 72 for the cooking count card) on most
 * phones, and four fifths of it (96, 58) when the text is enlarged to 1.3 or more on a phone 360dp wide or narrower,
 * where the larger art would push the state's title and its action below the fold.
 */
export function stateArtSize({ width, fontScale }: { width: number; fontScale: number }, base = STATE_ART): number {
  return fontScale >= 1.3 && width <= 360 ? Math.round((base * STATE_ART_COMPACT) / STATE_ART) : base;
}

/**
 * One delivered mascot still for an empty, error or kitchen state, centred where it sits (above the state's title).
 * Decorative: the state's own text carries the meaning, so screen readers skip it. `testID` is `mascot-{pose}`.
 * Never placed beside a photo of food (DESIGN.md: food photography leads; the mascot is occasional warmth).
 *
 * `held` keeps the art's box on the page with the mascot invisible (`testID` `mascot-{pose}-slot`), for art that is
 * not known or not due yet: the cooking mascot before "Mulai masak" and after "Berangkat antar", the hello while the
 * recap's seen marks are read. The box is one view that never remounts when `held` changes, so nothing around it
 * moves; only the mascot's opacity changes, over `content` on the Catera ease (instant under reduced motion). The art
 * has no entering or exiting animation of its own: it arrives and leaves with the block it sits in, so it never
 * lingers over the content that replaces that block.
 */
export function StateArt({
  pose,
  base = STATE_ART,
  style,
  held = false,
}: {
  pose: MascotPose;
  base?: number;
  style?: StyleProp<ViewStyle>;
  held?: boolean;
}) {
  const window = useWindowDimensions();
  const reduced = useReduced();
  const size = stateArtSize(window, base);
  const { box, aspect } = stillRuntime[pose];
  const { width, height } = mascotArtFrame(box, size, aspect);
  // Drawn as it first renders; later changes of `held` fade the mascot in or out where it stands.
  const opacity = useSharedValue(held ? 0 : 1);
  const last = useRef(held);
  useEffect(() => {
    if (last.current === held) return;
    last.current = held;
    const to = held ? 0 : 1;
    opacity.value = reduced ? to : withTiming(to, { duration: nativeMotion.content, easing: ease });
  }, [held, reduced, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View
      testID={held ? `mascot-${pose}-slot` : `mascot-${pose}`}
      {...decorative}
      style={[{ alignSelf: "center" }, style]}
    >
      <Animated.View testID="mascot-art-fade" style={[{ width, height }, fade]}>
        <MascotArt pose={pose} size={size} />
      </Animated.View>
    </View>
  );
}
