import { nativeLayout } from "@catera/design-tokens";

/**
 * The day sheet's geometry, read by the screen, the action row and the skeleton so the three cannot drift: a 16:10
 * photo with the card radius, the address row as a 56 well with the control radius, 16 between the sheet's blocks, 4
 * inside a meal's block, 56 action circles with 8 to their label.
 */
export const DAY_PHOTO_RATIO = nativeLayout.ratio.card;
export const DAY_PHOTO_RADIUS = nativeLayout.radius.card;
export const DAY_WELL_MIN = nativeLayout.row.single;
export const DAY_WELL_RADIUS = nativeLayout.radius.control;
/** The gap between the sheet's blocks: the photo, each meal, the address well, the actions. */
export const DAY_GAP = nativeLayout.space.lg;
/** The gap between a meal's meta line, dish and state line. */
export const DAY_MEAL_GAP = nativeLayout.space.xs;
/** The state line's dot. */
export const DAY_DOT = 8;
/** The visible circle of an action, and its gap to the label under it. */
export const ACTION_CIRCLE = nativeLayout.row.single;
export const DAY_ACTION_GAP = nativeLayout.space.sm;
/** The side padding of the action row while it stays on one line. */
export const DAY_ACTIONS_PAD = nativeLayout.space.md;
/** The line heights of the `meta` and `heroTitle` text, so the skeleton's lines occupy what the loaded lines do. */
export const DAY_META_LINE = 18;
export const DAY_HERO_LINE = 30;
