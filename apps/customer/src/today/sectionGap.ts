import { nativeLayout } from "@catera/design-tokens";

/**
 * What a Beranda block adds to the page body's own 16 gap so the blocks sit 32 apart (the layout scale's section gap):
 * each block under the hero carries it as its top margin, so a block that is not drawn leaves no stray gap.
 */
export const SECTION_LEAD = nativeLayout.sectionGap - nativeLayout.space.lg;
