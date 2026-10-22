import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { themedStyles } from "@catera/mobile-ui";

/** Where a `MediaRow` text column starts: its 56 thumb and the 12 gap. */
export const MEDIA_INSET = nativeLayout.thumb.sm + nativeLayout.space.md;
/** Where a `GlyphRow` text column starts: its 40 glyph circle and the 12 gap. */
export const GLYPH_INSET = 40 + nativeLayout.space.md;

/**
 * A surface card of rows: radius 16, 16 side padding, a 1px `line` between each pair of children, inset to the text
 * column so it does not run under the thumb. It separates from the canvas by tone, not by a border.
 */
export function ListCard({ children, inset = MEDIA_INSET }: { children: ReactNode; inset?: number }) {
  const styles = useStyles();
  // toArray already drops null, undefined and booleans, so a conditional child leaves no stray separator.
  const rows = Children.toArray(children);
  return (
    <View testID="list-card" style={styles.card}>
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
    paddingHorizontal: nativeLayout.cardPadding,
    overflow: "hidden",
  },
  separator: { height: 1, backgroundColor: c.line },
}));
