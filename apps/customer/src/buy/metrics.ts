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

/**
 * Below this effective width (width over font scale) the footer's amount and Bayar stack instead of sharing a row. Bayar
 * names the amount (deep pages R1), so 411dp at font scale 1.3 (316) stacks while 411 and 360 at 1.0 keep the row.
 */
export const FOOTER_STACK_BELOW = 340;
/** The primary button's width beside the amount. */
export const PAY_MIN_WIDTH = 168;

/** A generous width per character: the amount in `section` 800 (20) and the button label (15, 700), at font scale 1. */
const AMOUNT_CHAR = 12.5;
const LABEL_CHAR = 9.5;
/** The button's side padding and the row's gap. */
const PAY_PAD = 18;
const FOOTER_GAP = nativeLayout.space.md;

/**
 * Whether the amount and a Bayar labelled `label` fit on one row `available` wide at `fontScale`, from a deliberately
 * wide estimate of both texts. When they would not, the row stacks, so a long total ("Rp 2.250.000") never breaks after
 * "Rp" or squeezes the button.
 */
export function footerFits(amount: string, label: string, available: number, fontScale: number) {
  const scale = fontScale || 1;
  const pay = Math.max(PAY_MIN_WIDTH, label.length * LABEL_CHAR * scale + PAY_PAD * 2);
  return amount.length * AMOUNT_CHAR * scale + FOOTER_GAP + pay <= available;
}
