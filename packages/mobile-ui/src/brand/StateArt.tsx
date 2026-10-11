import { useRef } from "react";
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { stillRuntime } from "../../../brand/phaseF";
import { useBlockEnter } from "../motion/layout";
import { MascotArt, mascotArtFrame, type MascotPose } from "./MascotArt";
import { decorative } from "./decorative";

/** An empty or error state's art: 120pt above its title (spec 7.2). */
export const STATE_ART = 120;
/** What `STATE_ART` becomes on a 360dp phone at font scale 1.3, so the title and its action stay above the fold. */
export const STATE_ART_COMPACT = 96;

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
 * `held` keeps the art's exact box on the page without drawing it (`testID` `mascot-{pose}-slot`), for art that is
 * not known or not due yet: the cooking mascot before "Mulai masak", the hello while the recap's seen marks are read.
 * Nothing around it moves when the art arrives, and art that arrives after being held fades in over `content`
 * (instant under reduced motion). Art drawn from the first render has no fade of its own: the block it sits in
 * brings it in.
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
  const enter = useBlockEnter();
  const size = stateArtSize(window, base);
  // Set once and never cleared: a drawing that follows a held slot is an arrival, so it fades.
  const wasHeld = useRef(held);
  if (held) wasHeld.current = true;
  const frame = { alignSelf: "center" } as const;
  if (held) {
    const { box, aspect } = stillRuntime[pose];
    const { width, height } = mascotArtFrame(box, size, aspect);
    return (
      <View testID={`mascot-${pose}-slot`} {...decorative} style={[frame, style]}>
        <View testID="mascot-art-slot" style={{ width, height }} />
      </View>
    );
  }
  return (
    <Animated.View
      testID={`mascot-${pose}`}
      {...decorative}
      entering={wasHeld.current ? enter : undefined}
      style={[frame, style]}
    >
      <MascotArt pose={pose} size={size} />
    </Animated.View>
  );
}
