import { isValidElement, type ReactNode } from "react";
import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { Text } from "../components";
import { PressableRow } from "../PressableRow";
import { themedStyles, useColors } from "../theme";

type SectionLink = { label: string; onPress: () => void };

const isLink = (action: unknown): action is SectionLink =>
  typeof action === "object" && action !== null && !isValidElement(action) && "label" in action && "onPress" in action;

/** The `section` line (26): a 48 control in the trailing slot overhangs it by 11 above and below instead of growing it. */
const TRAILING_OVERHANG = -(nativeLayout.space.xxxl - 26) / 2;

/**
 * A section's heading, 12 above its content, with an optional trailing link ("Lihat semua"). `count` is a `meta` figure
 * at the right, before the trailing slot ("9 menu", "14 alamat"). `action` is the link, or any node for the trailing
 * slot (Dapur's 48 icon buttons, "Pilih"); a node is held in a slot that overhangs the 26 heading line, so a 48 button
 * does not make the header taller.
 */
export function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: string;
  action?: SectionLink | ReactNode;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View testID="section-header" style={styles.row}>
      <Text variant="section" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {count ? (
        <Text variant="meta" numberOfLines={1} style={styles.count}>
          {count}
        </Text>
      ) : null}
      {isLink(action) ? (
        <PressableRow
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        >
          {/* forest: action (the section link) */}
          <Text variant="bodyStrong" style={{ color: c.forest }}>
            {action.label}
          </Text>
        </PressableRow>
      ) : action ? (
        <View testID="section-header-trailing" style={styles.trailing}>
          {action}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles(() => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: nativeLayout.space.md,
    marginBottom: nativeLayout.headingGap,
  },
  title: { flex: 1 },
  count: { flexShrink: 0 },
  trailing: { flexDirection: "row", alignItems: "center", flexShrink: 0, marginVertical: TRAILING_OVERHANG },
}));
