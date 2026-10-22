import { nativeLayout } from "@catera/design-tokens";
import { heroPhotoFrame } from "../today/Plate";

/**
 * The plan hero's photo frame: Beranda's hero frame (inside the 1.5 edge, top corners one edge-width tighter than the
 * card's) at the 16:10 card ratio instead of the hero's 4:3. The loading skeleton draws the same frame.
 */
export const planPhotoFrame = { ...heroPhotoFrame, aspectRatio: nativeLayout.ratio.card } as const;
