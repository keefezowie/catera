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
 * button; its label is its title and meta (`rowLabel`) unless it is given one.
 */
export function TwoLineRow({
  leading,
  title,
  meta,
  trailing,
  onPress,
  accessibilityLabel,
  testID,
}: {
  leading?: ReactNode;
  title: string;
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const styles = useStyles();
  const body = (
    <>
      {leading}
      <View style={styles.text}>
        <Text variant="rowTitle" numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text variant="meta" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <View testID={testID ? `${testID}-trailing` : undefined} style={styles.trailing}>
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
      style={styles.row}
    >
      {body}
    </PressableRow>
  ) : (
    <View testID={testID} style={styles.row}>
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
  text: { flex: 1, minWidth: 0 },
  trailing: { flexDirection: "row", alignItems: "center", flexGrow: 0, flexShrink: 0 },
}));
