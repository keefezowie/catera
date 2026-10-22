import { nativeLayout } from "@catera/design-tokens";

/**
 * How far the hero card rides up over the mood band: its top 104 sits behind the card. One constant for the band's bottom
 * padding (16 + this), the data area's lift (`HERO_BAND_RISE`) and the skeleton, which draws the same.
 */
export const HERO_BAND_OVERLAP = 104;

/** The data area's negative top margin: the overlap plus the screen body's own 16 top padding. */
export const HERO_BAND_RISE = -(HERO_BAND_OVERLAP + nativeLayout.space.lg);
