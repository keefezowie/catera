import type { ReactNode } from "react";
import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { useScreenMargin } from "@catera/mobile-ui";

/** The chip row is 44 tall (the touch target), with the 34 chips centred in it: 5 above and 5 below. */
export const CHIP_ROW_HEIGHT = nativeLayout.control.icon;
export const CHIP_ROW_SLOP = (nativeLayout.control.icon - nativeLayout.control.chip) / 2;
/** The screen body starts 16 under the header and the row's own 5 sits above its chips, while the board puts the chips
 * 12 under the search pill: pull the row up by 16 - 12 + 5. Below it the 5 comes back, so the grid is 16 under the chips. */
const BODY_TOP = 16;
const SEARCH_TO_CHIPS = 12;
export const CHIP_ROW_MARGIN_TOP = -(BODY_TOP - SEARCH_TO_CHIPS + CHIP_ROW_SLOP);
export const CHIP_ROW_MARGIN_BOTTOM = -CHIP_ROW_SLOP;

/**
 * The frame of Jelajah's chip row, shared by the loaded row and its skeleton so both sit at one place: an explicit 44
 * height that never shrinks (a hit slop cannot reach past its parent, so the parent must really be 44), the margins
 * above, and a right edge that runs to the screen edge while the row starts at the margin. The negative margins are on
 * this plain frame, never on the scroll view, whose height they would shrink.
 */
export function ChipRowFrame({ children }: { children: ReactNode }) {
  const margin = useScreenMargin();
  return (
    <View
      testID="chip-row-frame"
      style={{
        height: CHIP_ROW_HEIGHT,
        flexShrink: 0,
        marginTop: CHIP_ROW_MARGIN_TOP,
        marginBottom: CHIP_ROW_MARGIN_BOTTOM,
        marginRight: -margin,
      }}
    >
      {children}
    </View>
  );
}
