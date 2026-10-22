import { nativeLayout } from "@catera/design-tokens";

/**
 * Buy's sizes, shared by the screen and its skeletons so a skeleton is the loaded page's own geometry.
 * The summary card is a 64 photo inside 12 padding (88 tall); the choices are one list card of four rows with a 1px
 * separator between each pair; the Rincian card is rows of 40 inside 8 vertical and 16 side padding.
 */
export const SUMMARY_PAD = nativeLayout.space.md;
export const SUMMARY_HEIGHT = nativeLayout.thumb.md + SUMMARY_PAD * 2;

/** A row of three lines (meta, bodyStrong, meta: 18 + 22 + 18) keeps its 72 by padding the rest evenly. */
export const THREE_LINE_PAD = (nativeLayout.row.media - (18 + 22 + 18)) / 2;

/** Mulai, Lama paket, Porsi per hari, Diantar ke. */
export const FIELD_ROWS = [nativeLayout.row.media, nativeLayout.row.single, nativeLayout.row.single, nativeLayout.row.media] as const;
export const FIELDS_HEIGHT = FIELD_ROWS.reduce<number>((sum, h) => sum + h, 0) + (FIELD_ROWS.length - 1);

export const BREAKDOWN_ROW = nativeLayout.row.keyValue;
export const BREAKDOWN_PAD = nativeLayout.space.sm;
/** The Rincian card's rows while the price is worked out (the loaded card has three to six). */
export const BREAKDOWN_SKELETON_ROWS = 3;

/** Below this effective width (width over font scale) the footer's amount and Bayar stack instead of sharing a row. */
export const FOOTER_STACK_BELOW = 300;
/** The primary button's width beside the amount. */
export const PAY_MIN_WIDTH = 168;
