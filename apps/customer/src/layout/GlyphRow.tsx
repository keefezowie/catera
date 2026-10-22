import type { ReactNode } from "react";
import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { PressableRow, Text, themedStyles } from "@catera/mobile-ui";
import { GLYPH_BARE, GLYPH_CIRCLE } from "./metrics";

/**
 * A row led by a glyph: a 40 circle on a tone, or with `bare` the 20 glyph alone. 56 tall by default, 72 for a row
 * with two lines of meta, 48 for an info row. A 48 row always draws the bare glyph: a 40 circle plus the 8 vertical
 * padding would make it 56. Without `onPress` it is not a button.
 */
export function GlyphRow({
  glyph,
  bare = false,
  tone,
  title,
  meta,
  trailing,
  onPress,
  minHeight = nativeLayout.row.single,
  testID,
}: {
  glyph: ReactNode;
  bare?: boolean;
  /** The circle's fill where it is not the plain `sage` tone (a meal's mood tint). */
  tone?: string;
  title: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  minHeight?: 56 | 72 | 48;
  testID?: string;
}) {
  const styles = useStyles();
  const bareGlyph = bare || minHeight === nativeLayout.row.info;
  const body = (
    <>
      <View testID={testID ? `${testID}-glyph` : undefined} style={bareGlyph ? styles.bare : [styles.circle, tone ? { backgroundColor: tone } : null]}>{glyph}</View>
      <View style={styles.text}>
        <Text variant="rowTitle" numberOfLines={1}>
          {title}
        </Text>
        {meta ? <Text variant="meta">{meta}</Text> : null}
      </View>
      {trailing}
    </>
  );
  const style = [styles.row, { minHeight }];
  return onPress ? (
    <PressableRow testID={testID} accessibilityRole="button" onPress={onPress} style={style}>
      {body}
    </PressableRow>
  ) : (
    <View testID={testID} style={style}>
      {body}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md, paddingVertical: nativeLayout.space.sm },
  circle: { width: GLYPH_CIRCLE, height: GLYPH_CIRCLE, borderRadius: GLYPH_CIRCLE / 2, backgroundColor: c.sage, alignItems: "center", justifyContent: "center" },
  bare: { width: GLYPH_BARE, height: GLYPH_BARE, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0 },
}));
