import { Text as NativeText, View } from "react-native";
import { router } from "expo-router";
import type { CustomerActionItem, CustomerState } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { fonts, PressableRow, Text, themedStyles, useColors, useStackedLayout } from "@catera/mobile-ui";
import { SECTION_LEAD } from "./sectionGap";
import { WaitingAction, WaitingGlyph, useWaitingRows } from "./WaitingList";

/**
 * Beranda's one live slot: a 72 row card for the most urgent thing that waits on the customer, in the domain's order,
 * with its own action as the trailing word. When more wait, "n hal lainnya" is in its meta line and opens the full list
 * (the pushed screen "Perlu kamu urus"); the same link is an action on the row for a screen reader. Hidden when nothing
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

  return (
    <View testID="live-slot" style={styles.card}>
      <PressableRow
        testID="live-slot-row"
        accessibilityRole="button"
        accessibilityLabel={`${row.title}, ${row.detail}, ${row.action}`}
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
            {rest ? (
              <>
                {" · "}
                {/* A plain text inside the meta line: it takes the line's size and wraps with it. */}
                <NativeText
                  testID="live-slot-more"
                  accessibilityRole="link"
                  onPress={openList}
                  /* forest: action (the link to the full list) */
                  style={{ color: c.forest, fontFamily: fonts.semibold }}
                >
                  {more}
                </NativeText>
              </>
            ) : null}
          </Text>
          {stacked ? <WaitingAction row={row} stacked /> : null}
        </View>
        {stacked ? null : <WaitingAction row={row} stacked={false} />}
      </PressableRow>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  // A surface card on the canvas: tone, not a border.
  card: {
    marginTop: SECTION_LEAD,
    backgroundColor: c.surface,
    borderRadius: nativeLayout.radius.card,
    paddingHorizontal: nativeLayout.cardPadding,
  },
  row: {
    minHeight: nativeLayout.row.media,
    flexDirection: "row",
    alignItems: "center",
    gap: nativeLayout.space.md,
    paddingVertical: nativeLayout.space.sm,
  },
  text: { flex: 1, minWidth: 0 },
  figures: { fontVariant: ["tabular-nums"] },
}));
