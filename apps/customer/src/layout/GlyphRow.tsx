import type { ReactNode } from "react";
import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { PressableRow, Text, themedStyles } from "@catera/mobile-ui";

/**
 * A row led by a glyph: a 40 circle on a tone, or with `bare` the 20 glyph alone. 56 tall by default, 72 for a row
 * with two lines of meta, 48 for an info row. Without `onPress` it is not a button.
 */
export function GlyphRow({
  glyph,
  bare = false,
  title,
  meta,
  trailing,
  onPress,
  minHeight = nativeLayout.row.single,
  testID,
}: {
  glyph: ReactNode;
  bare?: boolean;
  title: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  minHeight?: 56 | 72 | 48;
  testID?: string;
}) {
  const styles = useStyles();
  const body = (
    <>
      <View style={bare ? styles.bare : styles.circle}>{glyph}</View>
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
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.sage, alignItems: "center", justifyContent: "center" },
  bare: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0 },
}));
