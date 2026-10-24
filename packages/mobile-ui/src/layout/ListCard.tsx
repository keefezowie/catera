import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { cardEdge, cardEdgeWidth, themedStyles, useColors } from "../theme";
import { GLYPH_BARE, GLYPH_CIRCLE } from "./metrics";

/** Where a `MediaRow` text column starts: its 56 thumb and the 12 gap. */
export const MEDIA_INSET = nativeLayout.thumb.sm + nativeLayout.space.md;
/** Where a compact `MediaRow` text column starts: its 48 thumb and the 12 gap. */
export const COMPACT_MEDIA_INSET = nativeLayout.thumb.compact + nativeLayout.space.md;
/** Where a `GlyphRow` text column starts: its 40 glyph circle and the 12 gap. */
export const GLYPH_INSET = GLYPH_CIRCLE + nativeLayout.space.md;
/** Where a bare-glyph row (the 48 info row) text column starts: its 20 glyph and the 12 gap. */
export const BARE_GLYPH_INSET = GLYPH_BARE + nativeLayout.space.md;

/**
 * A surface card of rows: radius 16, 16 side padding, a 1px `line` between each pair of children, inset to the text
 * column so it does not run under the thumb. It separates from the canvas by tone, not by a border.
 * `tone="sage"` is for a card on a surface that is itself the card colour (a form sheet, whose dark `cardBorder` is empty so a
 * surface card would have no edge): it takes the `sage` fill and the `surface` is left to what sits on it. `clip={false}`
 * drops the rounded clip, for rows whose photo loads late (an image that finishes loading inside an overflow-hidden
 * rounded view can stay blank on Android); the rows must not reach the corners then. The defaults are unchanged.
 */
export function ListCard({
  children,
  inset = MEDIA_INSET,
  tone = "surface",
  clip = true,
}: {
  children: ReactNode;
  inset?: number;
  tone?: "surface" | "sage";
  clip?: boolean;
}) {
  const styles = useStyles();
  const c = useColors();
  // toArray already drops null, undefined and booleans, so a conditional child leaves no stray separator.
  const rows = Children.toArray(children);
  return (
    <View
      testID="list-card"
      style={[styles.card, tone === "sage" && { backgroundColor: c.sage }, !clip && styles.open]}
    >
      {rows.map((child, i) => (
        <Fragment key={isValidElement(child) && child.key != null ? child.key : i}>
          {i > 0 ? <View testID="list-card-separator" style={[styles.separator, { marginLeft: inset }]} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    paddingHorizontal: nativeLayout.cardPadding - cardEdgeWidth(c),
    overflow: "hidden",
    ...cardEdge(c),
  },
  open: { overflow: "visible" },
  separator: { height: 1, backgroundColor: c.line },
}));
