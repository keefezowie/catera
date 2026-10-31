import { useWindowDimensions } from "react-native";
import { PolishArt, stateArtSize, type PolishArtName } from "@catera/mobile-ui";

/**
 * An empty state's own picture (polish canvas 2026-10-30), centred above its title. 160 is the canvas size and the
 * runtime file's display size for the spot empties; it shrinks by the same four fifths as `StateArt` on a 360dp phone at
 * font scale 1.3, so the title and the action stay above the fold there (expo-native-ui: required actions stay reachable
 * at large text). Decorative: the title says what is missing.
 */
export const EMPTY_ART = 160;

/**
 * Optical size per cutout: the drawings fill their square differently (the lid-heart reads about 95x55 inside 160, the
 * nota about 85x95), so a wide, flat one is drawn a little larger to carry the same weight.
 */
const OPTICAL: Partial<Record<PolishArtName, number>> = { "spot-lid-heart": 1.15 };

export function EmptyArt({ name }: { name: PolishArtName }) {
  const size = Math.round(stateArtSize(useWindowDimensions(), EMPTY_ART) * (OPTICAL[name] ?? 1));
  return <PolishArt name={name} size={size} style={{ alignSelf: "center" }} />;
}
