import type { ReactNode } from "react";
import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { Text } from "../components";
import { PressableRow } from "../PressableRow";
import { themedStyles } from "../theme";
import { rowLabel } from "./rowLabel";

/**
 * Two lines (64 tall): a `rowTitle` and a `meta` line, one line each, with an optional leading node (a 28 order badge,
 * a 40 glyph circle) and an optional trailing node held in one fixed column as wide as its children (48 per button),
 * so every row of a list keeps its controls on one edge and its text on one width. Without `onPress` it is not a
 * button; its label is its title and meta (`rowLabel`) unless it is given one. `wrap="meta"` lets the meta grow past
 * one line (`wrap` lets the title too) for a row whose words must all show: the row grows, pads 12 top and bottom, and
 * its leading glyph aligns to the top while the trailing node stays centred. The default is one line each.
 */
export function TwoLineRow({
  leading,
  title,
  meta,
  trailing,
  onPress,
  wrap = false,
  accessibilityLabel,
  testID,
}: {
  leading?: ReactNode;
  title: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  wrap?: boolean | "meta";
  accessibilityLabel?: string;
  testID?: string;
}) {
  const styles = useStyles();
  const rowStyle = wrap ? [styles.row, styles.wrapped] : styles.row;
  const body = (
    <>
      {leading}
      <View style={styles.text}>
        <Text variant="rowTitle" numberOfLines={wrap === true ? undefined : 1}>
          {title}
        </Text>
        {meta ? (
          <Text variant="meta" numberOfLines={wrap ? undefined : 1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <View testID={testID ? `${testID}-trailing` : undefined} style={[styles.trailing, wrap ? styles.trailingCentre : null]}>
          {trailing}
        </View>
      ) : null}
    </>
  );
  return onPress ? (
    <PressableRow
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? rowLabel(title, meta)}
      onPress={onPress}
      style={rowStyle}
    >
      {body}
    </PressableRow>
  ) : (
    <View testID={testID} style={rowStyle}>
      {body}
    </View>
  );
}

const useStyles = themedStyles(() => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: nativeLayout.space.md,
    minHeight: nativeLayout.row.compact,
    paddingVertical: nativeLayout.space.sm,
  },
  wrapped: { alignItems: "flex-start", paddingVertical: nativeLayout.space.md },
  text: { flex: 1, minWidth: 0 },
  trailing: { flexDirection: "row", alignItems: "center", flexGrow: 0, flexShrink: 0 },
  trailingCentre: { alignSelf: "center" },
}));
