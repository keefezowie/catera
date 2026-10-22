import type { ReactNode } from "react";
import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { nativeLayout } from "@catera/design-tokens";
import { PressableRow, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { Thumb } from "./Thumb";

/**
 * Two lines beside a 56 thumb (72 tall): `rowTitle` and `meta`, one line each. `leading` replaces the thumb; `notSet`
 * draws the dashed thumb; `trailing` is a node or `"chevron"`. Without `onPress` it is not a button. `wrap` lets both
 * lines grow past one line (the row grows too) for a row whose words must all show, like a state at large text;
 * `wrap="title"` grows only the title and keeps the meta to one truncated line (a day's date over its dish list).
 */
export function MediaRow({
  image,
  notSet,
  leading,
  title,
  meta,
  trailing,
  onPress,
  wrap = false,
  testID,
}: {
  image?: string | null;
  notSet?: boolean;
  leading?: ReactNode;
  title: string;
  meta?: string;
  trailing?: ReactNode | "chevron";
  onPress?: () => void;
  wrap?: boolean | "title";
  testID?: string;
}) {
  const c = useColors();
  const styles = useStyles();
  const body = (
    <>
      {leading ?? <Thumb uri={image} notSet={notSet} testID={testID ? `${testID}-thumb` : "thumb"} />}
      <View style={styles.text}>
        <Text variant="rowTitle" numberOfLines={wrap ? undefined : 1}>
          {title}
        </Text>
        {meta ? (
          <Text variant="meta" numberOfLines={wrap === true ? undefined : 1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing === "chevron" ? (
        <View testID={testID ? `${testID}-chevron` : undefined}>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </View>
      ) : (
        trailing
      )}
    </>
  );
  return onPress ? (
    <PressableRow testID={testID} accessibilityRole="button" onPress={onPress} style={styles.row}>
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
    minHeight: nativeLayout.row.media,
    paddingVertical: nativeLayout.space.sm,
  },
  text: { flex: 1, minWidth: 0 },
}));
