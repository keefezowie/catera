import type { ReactNode } from "react";
import { LayoutAnimationConfig } from "react-native-reanimated";

/**
 * Rows that carry row motion (`useRowMotion`, `useListMotion`) but must not animate when the whole set changes for a
 * reason the user did not cause row by row: a filter or search change, a pull to refresh, a read that arrives by push
 * (Decision A). A new `swapKey` remounts the block; its rows skip their entrances and exits and nothing moves, so the
 * new set simply replaces the old one. While the key holds, rows the user's own action inserts or removes animate as
 * usual.
 */
export function RowSwap({ swapKey, children }: { swapKey: string; children: ReactNode }) {
  return (
    <LayoutAnimationConfig key={swapKey} skipEntering skipExiting>
      {children}
    </LayoutAnimationConfig>
  );
}
