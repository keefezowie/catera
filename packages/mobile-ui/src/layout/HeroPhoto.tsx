import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { HERO_EDGE } from "../MoodFill";

/** The hero card's radius; the photo's top corners are one edge-width tighter. */
const CARD_RADIUS = nativeLayout.radius.card;

/** The outer layer: the 1.5 inset from the card's edge and the clipped top corners. It has no ratio of its own. */
export const heroPhotoInset = {
  margin: HERO_EDGE,
  borderTopLeftRadius: CARD_RADIUS - HERO_EDGE,
  borderTopRightRadius: CARD_RADIUS - HERO_EDGE,
  borderCurve: "continuous",
  overflow: "hidden",
} as const;

/** The same inset with no clip and no corner radii: the image rounds itself. */
const unclippedInset = { margin: HERO_EDGE } as const;

/**
 * The photo across the top of a hero card (Beranda's plate, the plan's hero and their loading skeletons): the card's
 * width at `ratio`, inside its 1.5 edge so the edge runs unbroken round it, top corners one edge-width tighter than the
 * card's.
 *
 * Two layers on purpose. The inset is a margin and the ratio is an `aspectRatio`, and a node that has both lays itself
 * out narrower than its slot on Android (the margin is taken off its width twice: the photo ended 4px in from the left
 * edge and 14 to 17px short of the right one). So the outer layer carries the margin and the corners and stretches as
 * usual, and the inner layer carries only the ratio, so its width is exactly the card's inner width. `testID` names the
 * inner layer (the photo); the outer is `{testID}-inset`.
 *
 * `clip` (default true) is the hero card's clipped top corners. `clip={false}` drops the `overflow: "hidden"` and the
 * corner radii with it: a photo that can finish loading after the screen has mounted inside a rounded clipping parent can
 * stay blank on Android (audit-003 F1), so the caller's image carries its own corner radius instead (Dapur's package photo).
 */
export function HeroPhotoFrame({
  ratio,
  testID,
  style,
  children,
  clip = true,
}: {
  ratio: number;
  testID: string;
  /** Clip the photo to the card's top corners (default). `false`: no clipping ancestor; the image rounds itself. */
  clip?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <View testID={`${testID}-inset`} style={clip ? heroPhotoInset : unclippedInset}>
      <View testID={testID} style={[{ aspectRatio: ratio }, style]}>
        {children}
      </View>
    </View>
  );
}
