import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableRow, PressableScale, Text, themedStyles, useColors, useStackedLayout } from "@catera/mobile-ui";
import { ACTION_CIRCLE, DAY_ACTION_GAP, DAY_ACTIONS_PAD } from "./dayMetrics";
import { DecorativeIcon } from "../layout";

/** What a day offers, in the order the row shows it. */
export type DayActionKey = "change" | "menu" | "report" | "chat" | "address";

export type DayAction = { key: DayActionKey; label: string; onPress(): void };

/** The widest an action's column grows on one row. */
const ACTION_COLUMN_MAX = 96;
/**
 * Under this effective width (`width / fontScale`, in dp) the circles would wrap to a second line, so the actions stack
 * as rows instead. 380 keeps four 56 circles with their labels on one line at 390 and 412 wide, and stacks them on a
 * 360 phone and at font scale 1.3 (412 / 1.3 = 317).
 */
const STACK_BELOW = 380;
/** A stacked action row: 48 tall at least, a 24 icon, 12 to the label. */
const ROW_MIN = 48;
const ROW_ICON = 24;
const ROW_GAP = 12;

const ICON: Record<DayActionKey, keyof typeof Ionicons.glyphMap> = {
  change: "calendar-outline",
  menu: "restaurant-outline",
  report: "flag-outline",
  chat: "chatbubble-outline",
  address: "location-outline",
};

/**
 * The day's actions. Where they fit on one line, 56 circles with a `meta` label under each, spread across the sheet.
 * At a larger font or on a narrow phone, where the circles would wrap and the second line could end under the gesture
 * bar, they stack as full-width 48 rows (icon, `body` label, a hairline between rows, no chevron on Android; iOS shows
 * one) in the same order. Every action is a button named by its label. Draws nothing when the day offers nothing.
 */
export function DayActions({ actions }: { actions: DayAction[] }) {
  const stacked = useStackedLayout(STACK_BELOW);
  if (!actions.length) return null;
  return stacked ? <ActionRows actions={actions} /> : <ActionCircles actions={actions} />;
}

function ActionCircles({ actions }: { actions: DayAction[] }) {
  const styles = useStyles();
  const c = useColors();
  return (
    <View testID="day-actions" style={styles.circles}>
      {actions.map((action) => (
        <PressableScale
          key={action.key}
          testID={`day-action-${action.key}`}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={styles.item}
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

function ActionRows({ actions }: { actions: DayAction[] }) {
  const styles = useStyles();
  const c = useColors();
  const ios = process.env.EXPO_OS === "ios";
  return (
    <View testID="day-actions" style={styles.rows}>
      {actions.map((action, i) => (
        <View key={action.key}>
          {i > 0 ? <View testID="day-action-separator" style={styles.separator} /> : null}
          <PressableRow
            testID={`day-action-${action.key}`}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={styles.row}
          >
            <DecorativeIcon testID={`day-action-icon-${action.key}`} name={ICON[action.key]} size={ROW_ICON} color={c.charcoal} />
            <Text variant="body" style={styles.rowLabel}>
              {action.label}
            </Text>
            {ios ? (
              <View testID={`day-action-chevron-${action.key}`}>
                <DecorativeIcon name="chevron-forward" size={20} color={c.muted} />
              </View>
            ) : null}
          </PressableRow>
        </View>
      ))}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  // One line: the circles spread across the sheet with 12 at each side.
  circles: { flexDirection: "row", flexWrap: "nowrap", justifyContent: "space-between", paddingHorizontal: DAY_ACTIONS_PAD },
  item: { alignItems: "center", gap: DAY_ACTION_GAP, minWidth: ACTION_CIRCLE, maxWidth: ACTION_COLUMN_MAX, flexShrink: 1 },
  circle: {
    width: ACTION_CIRCLE,
    height: ACTION_CIRCLE,
    borderRadius: ACTION_CIRCLE / 2,
    backgroundColor: c.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { textAlign: "center" },
  rows: { flexDirection: "column" },
  row: { flexDirection: "row", alignItems: "center", gap: ROW_GAP, minHeight: ROW_MIN, paddingVertical: 8 },
  rowLabel: { flex: 1, minWidth: 0 },
  // The hairline starts at the label, not under the icon.
  separator: { height: StyleSheet.hairlineWidth, marginLeft: ROW_ICON + ROW_GAP, backgroundColor: c.line },
}));
