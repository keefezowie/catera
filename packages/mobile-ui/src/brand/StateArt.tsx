import { useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import { MascotArt, type MascotPose } from "./MascotArt";
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
 */
export function StateArt({
  pose,
  base = STATE_ART,
  style,
}: {
  pose: MascotPose;
  base?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const window = useWindowDimensions();
  return (
    <View testID={`mascot-${pose}`} {...decorative} style={[{ alignSelf: "center" }, style]}>
      <MascotArt pose={pose} size={stateArtSize(window, base)} />
    </View>
  );
}
