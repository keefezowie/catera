import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale, Text, themedStyles, useColors, useStackedLayout } from "@catera/mobile-ui";
import { ACTION_CIRCLE, DAY_ACTION_GAP, DAY_ACTIONS_PAD } from "./dayMetrics";
import { DecorativeIcon } from "../layout";

/** What a day offers, in the order the row shows it. */
export type DayActionKey = "change" | "menu" | "report" | "chat" | "address";

export type DayAction = { key: DayActionKey; label: string; onPress(): void };

/** The widest an action's column grows on one row; a label wider than it wraps. */
const ACTION_COLUMN_MAX = 96;
/**
 * Under this effective width (`width / fontScale`, in dp) the row wraps to two lines. 380 keeps four 56 circles with
 * their labels on one line at 390 and 412 wide, and wraps them on a 360 phone and at font scale 1.3 (412 / 1.3 = 317).
 */
const WRAP_BELOW = 380;

const ICON: Record<DayActionKey, keyof typeof Ionicons.glyphMap> = {
  change: "calendar-outline",
  menu: "restaurant-outline",
  report: "flag-outline",
  chat: "chatbubble-outline",
  address: "location-outline",
};

/**
 * The day's actions as 56 circles with a `meta` label under each, in one row. Every circle is a button named by its
 * label. At a larger font or on a narrow phone the row wraps to two lines (`ceil(n / 2)` columns) and each label wraps
 * inside its column, so nothing is cut. Draws nothing when the day offers nothing.
 */
export function DayActions({ actions }: { actions: DayAction[] }) {
  const styles = useStyles();
  const c = useColors();
  const wraps = useStackedLayout(WRAP_BELOW);
  if (!actions.length) return null;
  const columns = wraps ? Math.ceil(actions.length / 2) : actions.length;
  return (
    <View
      testID="day-actions"
      // One line: the circles spread across the sheet with 12 at each side. Wrapped: equal columns across the width.
      style={[styles.row, wraps ? { flexWrap: "wrap" } : { flexWrap: "nowrap", justifyContent: "space-between", paddingHorizontal: DAY_ACTIONS_PAD }]}
    >
      {actions.map((action) => (
        <PressableScale
          key={action.key}
          testID={`day-action-${action.key}`}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={[
            styles.item,
            wraps
              ? { width: columns === 1 ? ACTION_COLUMN_MAX : `${100 / columns}%` }
              : { minWidth: ACTION_CIRCLE, maxWidth: ACTION_COLUMN_MAX, flexShrink: 1 },
          ]}
        >
          <View testID={`day-action-circle-${action.key}`} style={styles.circle}>
            <DecorativeIcon name={ICON[action.key]} size={24} color={c.charcoal} />
          </View>
          <Text variant="meta" style={styles.label}>
            {action.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: { flexDirection: "row", rowGap: 12 },
  item: { alignItems: "center", gap: DAY_ACTION_GAP },
  circle: {
    width: ACTION_CIRCLE,
    height: ACTION_CIRCLE,
    borderRadius: ACTION_CIRCLE / 2,
    backgroundColor: c.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { textAlign: "center" },
}));
