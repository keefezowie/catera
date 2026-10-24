import type { ReactNode } from "react";
import { View, type TextStyle } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { Text } from "../components";
import { PressableRow } from "../PressableRow";
import { themedStyles, useColors } from "../theme";
import { DecorativeIcon } from "./DecorativeIcon";
import { rowLabel } from "./rowLabel";
import { Thumb } from "./Thumb";

/**
 * Two lines beside a 56 thumb (72 tall): `rowTitle` and `meta`, one line each. `leading` replaces the thumb; `notSet`
 * draws the dashed thumb; `trailing` is a node or `"chevron"`. Without `onPress` it is not a button. `wrap` lets both
 * lines grow past one line (the row grows too) for a row whose words must all show, like a state at large text;
 * `wrap="title"` grows only the title and keeps the meta to one truncated line (a day's date over its dish list).
 * `size="compact"` is the Dapur Menu dish row: 64 tall beside a 48 thumb; `titleVariant="bodyStrong"` sets its title
 * one step quieter. The default size is unchanged.
 */
export function MediaRow({
  image,
  notSet,
  leading,
  title,
  meta,
  metaStyle,
  trailing,
  onPress,
  wrap = false,
  size = "media",
  titleVariant = "rowTitle",
  accessibilityLabel,
  testID,
}: {
  image?: string | null;
  notSet?: boolean;
  leading?: ReactNode;
  title: string;
  meta?: string;
  /** Extra style for the meta line (tabular figures on a price). */
  metaStyle?: TextStyle;
  trailing?: ReactNode | "chevron";
  onPress?: () => void;
  wrap?: boolean | "title";
  size?: "media" | "compact";
  titleVariant?: "rowTitle" | "bodyStrong";
  /** What a screen reader says for the row; by default its title and meta (`rowLabel`). Pass one when the row's own texts read badly (a date column). */
  accessibilityLabel?: string;
  testID?: string;
}) {
  const c = useColors();
  const styles = useStyles();
  const compact = size === "compact";
  // The default row keeps its one style object, so a customer row is drawn exactly as before.
  const rowStyle = compact ? [styles.row, styles.compact] : styles.row;
  const body = (
    <>
      {leading ?? (
        <Thumb
          uri={image}
          notSet={notSet}
          size={compact ? nativeLayout.thumb.compact : nativeLayout.thumb.sm}
          testID={testID ? `${testID}-thumb` : "thumb"}
        />
      )}
      <View style={styles.text}>
        <Text variant={titleVariant} numberOfLines={wrap ? undefined : 1}>
          {title}
        </Text>
        {meta ? (
          <Text variant="meta" numberOfLines={wrap === true ? undefined : 1} style={metaStyle}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing === "chevron" ? (
        process.env.EXPO_OS === "ios" ? (
          <View testID={testID ? `${testID}-chevron` : undefined}>
            <DecorativeIcon name="chevron-forward" size={20} color={c.muted} />
          </View>
        ) : null
      ) : (
        trailing
      )}
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
    minHeight: nativeLayout.row.media,
    paddingVertical: nativeLayout.space.sm,
  },
  compact: { minHeight: nativeLayout.row.compact },
  text: { flex: 1, minWidth: 0 },
}));
