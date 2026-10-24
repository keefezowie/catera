import { isValidElement, type ReactNode } from "react";
import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { Text } from "../components";
import { PressableRow } from "../PressableRow";
import { themedStyles, useColors } from "../theme";

type SectionLink = { label: string; onPress: () => void };

const isLink = (action: unknown): action is SectionLink =>
  typeof action === "object" && action !== null && !isValidElement(action) && "label" in action && "onPress" in action;

/** The touch target a node action holds (Dapur's icon buttons and text actions): the header row grows to this. */
const NODE_ACTION_HEIGHT = nativeLayout.space.xxxl;

/**
 * A section's heading, 12 above its content, with an optional trailing link ("Lihat semua"). `count` is a `meta` figure
 * at the right, before the trailing slot ("9 menu", "14 alamat"). `action` is the link, or any node for the trailing
 * slot (Dapur's 48 icon buttons, "Pilih"). A header with a node action is at least 48 tall, the title centred in it: the
 * row has to hold the whole 48 target, because Android delivers a touch only inside every ancestor's bounds and a
 * button that overhangs a 26 row loses the part outside it. A header without one stays one heading line.
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
  const node = !!action && !isLink(action);
  return (
    <View testID="section-header" style={[styles.row, node && styles.rowWithAction]}>
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
  rowWithAction: { minHeight: NODE_ACTION_HEIGHT },
  count: { flexShrink: 0 },
  trailing: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
}));
