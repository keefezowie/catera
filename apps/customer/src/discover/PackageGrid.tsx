import { Children, type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { useStackedLayout } from "@catera/mobile-ui";

/** The gap between two tile columns, and between two tile rows (spec 3.3). */
export const GRID_COLUMN_GAP = 12;
export const GRID_ROW_GAP = 20;
/**
 * The effective width (`width / fontScale`) under which the grid is one column: a 360dp phone at font scale 1.3 is 277,
 * where a half-width tile would be about 130dp wide and its name could not wrap in whole words. 411dp at 1.3 is 316 and
 * 360dp at 1.0 is 360, so both keep two columns.
 */
export const GRID_STACK_BELOW = 300;

/** How many columns the grid has on this screen: 2, or 1 when the text is large for the width. */
export function useGridColumns(): 1 | 2 {
  return useStackedLayout(GRID_STACK_BELOW) ? 1 : 2;
}

/**
 * The style of one grid cell. Two columns: a 40 percent basis that grows to fill, so two cells and the 12 gap share a
 * row exactly and a third wraps; a cell never passes half the row. One column: the whole row.
 */
export function useGridCell(): ViewStyle {
  const columns = useGridColumns();
  return columns === 1
    ? { flexBasis: "100%", flexGrow: 1, minWidth: 0 }
    : { flexBasis: "40%", flexGrow: 1, maxWidth: "50%", minWidth: 0 };
}

/**
 * The package tile grid, shared by Jelajah and Disimpan. The children are the cells (each styled with `useGridCell`);
 * an odd last tile gets a spacer beside it so it keeps one column's width instead of stretching across the row.
 */
export function PackageGrid({ children, testID = "package-grid" }: { children: ReactNode; testID?: string }) {
  const columns = useGridColumns();
  const cell = useGridCell();
  const count = Children.toArray(children).length;
  return (
    <View testID={testID} style={{ flexDirection: "row", flexWrap: "wrap", columnGap: GRID_COLUMN_GAP, rowGap: GRID_ROW_GAP }}>
      {children}
      {columns === 2 && count % 2 === 1 ? <View testID="package-cell-spacer" style={cell} /> : null}
    </View>
  );
}
