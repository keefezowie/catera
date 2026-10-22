import { View } from "react-native";
import { nativeLayout } from "@catera/design-tokens";
import { PressableRow, Text, themedStyles, useColors } from "@catera/mobile-ui";

/** A section's heading, 12 above its content, with an optional trailing link ("Lihat semua"). */
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View testID="section-header" style={styles.row}>
      <Text variant="section" style={styles.title}>
        {title}
      </Text>
      {action ? (
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
}));
