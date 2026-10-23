import { View } from "react-native";
import { router } from "expo-router";
import type { CustomerActionItem, CustomerState } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { PressableRow, Text, themedStyles, useColors, useStackedLayout, cardEdge, cardEdgeWidth } from "@catera/mobile-ui";
import { GLYPH_INSET } from "../layout";
import { SECTION_LEAD } from "./sectionGap";
import { WaitingAction, WaitingGlyph, useWaitingRows } from "./WaitingList";

/**
 * Beranda's one live slot: a 72 row card for the most urgent thing that waits on the customer, in the domain's order,
 * with its own action as the trailing word. When more wait, "n hal lainnya" is a 44 tall link under the row that opens the
 * full list (the pushed screen "Perlu kamu urus"); it is also an action on the row for a screen reader. Hidden when nothing
 * waits. Offline the kept copy gives no menu or review rows, so the slot never offers what cannot be done.
 */
export function LiveSlot({
  state,
  actions,
  offline,
  now,
}: {
  state: CustomerState;
  /** The action read; null while it failed, never loaded, or the screen shows the saved copy. */
  actions: CustomerActionItem[] | null;
  offline: boolean;
  now: Date;
}) {
  const { t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  // Large text or a narrow phone: the action word drops under the text so the title keeps whole-word lines.
  const stacked = useStackedLayout(340);
  const rows = useWaitingRows({ state, actions, offline, now });
  const row = rows[0];
  if (!row) return null;
  const rest = rows.length - 1;
  const more = rest ? t(`${rest} hal lainnya`, `${rest} more`) : "";
  const openList = () => router.push("/perlu-diurus" as never);

  const label = [row.title, row.detail, row.action, more].filter(Boolean).join(", ");

  return (
    <View testID="live-slot" style={styles.card}>
      {/* The row's press is the item's own action; the link to the full list is its own element below it, so a touch
          near the link can never start a renewal or open the menu picker. */}
      <PressableRow
        testID="live-slot-row"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityActions={rest ? [{ name: "more", label: more }] : undefined}
        onAccessibilityAction={rest ? openList : undefined}
        onPress={row.onPress}
        style={styles.row}
      >
        <WaitingGlyph icon={row.icon} />
        <View testID="live-slot-text" style={styles.text}>
          <Text variant="rowTitle" style={styles.figures}>
            {row.title}
          </Text>
          <Text variant="meta" style={styles.figures}>
            {row.detail}
          </Text>
          {stacked ? <WaitingAction row={row} stacked /> : null}
        </View>
        {stacked ? null : <WaitingAction row={row} stacked={false} />}
      </PressableRow>
      {rest ? (
        <PressableRow
          testID="live-slot-more"
          accessibilityRole="button"
          accessibilityLabel={more}
          onPress={openList}
          style={styles.more}
        >
          {/* forest: action (the link to the full list) */}
          <Text variant="bodyStrong" style={{ color: c.forest }}>
            {more}
          </Text>
        </PressableRow>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  // A surface card on the canvas: a hairline and a faint shadow in light, tone in dark.
  card: {
    marginTop: SECTION_LEAD,
    backgroundColor: c.surface,
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    paddingHorizontal: nativeLayout.cardPadding - cardEdgeWidth(c),
    ...cardEdge(c),
  },
  row: {
    minHeight: nativeLayout.row.media,
    flexDirection: "row",
    alignItems: "center",
    gap: nativeLayout.space.md,
    paddingVertical: nativeLayout.space.sm,
  },
  text: { flex: 1, minWidth: 0 },
  // A real 44 touch target, under the text column (past the glyph circle and its gap).
  more: { minHeight: nativeLayout.control.icon, justifyContent: "center", paddingLeft: GLYPH_INSET },
  figures: { fontVariant: ["tabular-nums"] },
}));
