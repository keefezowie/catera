import { nativeLayout } from "@catera/design-tokens";

/**
 * The day sheet's geometry, read by the screen and by its skeleton so the two cannot drift: a 16:10 photo with the card
 * radius, and the address row as a 56 well with the control radius.
 */
export const DAY_PHOTO_RATIO = nativeLayout.ratio.card;
export const DAY_PHOTO_RADIUS = nativeLayout.radius.card;
export const DAY_WELL_MIN = nativeLayout.row.single;
export const DAY_WELL_RADIUS = nativeLayout.radius.control;
/** The state line's dot. */
export const DAY_DOT = 8;
