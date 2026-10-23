import { View } from "react-native";
import { Image } from "expo-image";
import type { UpcomingDay, UpcomingMeal } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { PressableRow, Text, themedStyles, useColors, useStackedLayout } from "@catera/mobile-ui";
import { photoUri } from "./photoUri";
import { DecorativeIcon, rowLabel } from "../layout";

/** The most delivery tiles a day shows; the rest are "+n lagi". */
export const TILES_PER_DAY = 2;

type Translate = (id: string, en: string) => string;

type Slot = { kind: "meal"; meal: UpcomingMeal } | { kind: "none"; meal: "lunch" | "dinner" };

/** The word for a meal ("Siang"), shared by the tiles and the one-delivery rows. */
export const mealWord = (meal: "lunch" | "dinner", t: Translate) =>
  meal === "dinner" ? t("Malam", "Dinner") : t("Siang", "Lunch");

/**
 * A day's tiles, for its deliveries whose menu is picked. A day of one delivery fills one of the two meal slots and says
 * the other is empty (the empty lunch before a dinner, the empty dinner after a lunch). Otherwise the picked ones fill
 * up to two tiles; the rest are `hidden`, reached through "+n lagi". Unpicked deliveries get no tile: they share the
 * day's one "Pilih menu" row.
 */
function slotsOf(day: UpcomingDay, picked: UpcomingMeal[]): { slots: Slot[]; hidden: UpcomingMeal[] } {
  if (day.meals.length === 1 && picked.length === 1) {
    const only = picked[0];
    const meal: Slot = { kind: "meal", meal: only };
    const none: Slot = { kind: "none", meal: only.meal === "lunch" ? "dinner" : "lunch" };
    return { slots: only.meal === "lunch" ? [meal, none] : [none, meal], hidden: [] };
  }
  return {
    slots: picked.slice(0, TILES_PER_DAY).map((meal) => ({ kind: "meal", meal })),
    hidden: picked.slice(TILES_PER_DAY),
  };
}

/**
 * Berikutnya as day blocks (spec 3.1 item 5), for days that have two or more deliveries: the day label with how many
 * come, a two-column grid of at most two photo tiles, and "+n lagi" as a link row when more exist. Every block is the
 * same shape, so a day with one delivery beside a busy one keeps its tile and says which meal is empty. At large text
 * or on a narrow phone the tiles take a column each, and the dish may wrap.
 */
export function DayBlocks({
  days,
  apiBase,
  onOpen,
  onMore,
  onPick,
}: {
  days: UpcomingDay[];
  apiBase: string;
  /** A tile was pressed. */
  onOpen: (day: UpcomingDay, meal: UpcomingMeal) => void;
  /** "+n lagi" was pressed; `hidden` are the deliveries the tiles left out. */
  onMore: (day: UpcomingDay, hidden: UpcomingMeal[]) => void;
  /** "Pilih menu" on the day's unpicked row was pressed; `first` is the first delivery without a menu. */
  onPick: (day: UpcomingDay, first: UpcomingMeal) => void;
}) {
  const { t } = useMobile();
  const styles = useStyles();
  const stacked = useStackedLayout(340);
  return (
    <View style={styles.blocks}>
      {days.map((day) => {
        const picked = day.meals.filter((m) => m.lead !== null);
        const unpicked = day.meals.filter((m) => m.lead === null);
        const { slots, hidden } = slotsOf(day, picked);
        const n = day.meals.length;
        return (
          <View key={day.date} testID={`upcoming-day-${day.date}`} style={styles.block}>
            <View style={styles.heading}>
              <Text testID="upcoming-day-label" variant="rowTitle" style={styles.label}>
                {day.label}
              </Text>
              <Text testID="upcoming-day-count" variant="meta" style={styles.figures}>
                {t(`${n} pengantaran`, n === 1 ? "1 delivery" : `${n} deliveries`)}
              </Text>
            </View>
            {slots.length ? (
              <View
                testID={`upcoming-grid-${day.date}`}
                style={[styles.grid, { flexDirection: stacked ? "column" : "row" }]}
              >
                {slots.map((slot) =>
                  slot.kind === "meal" ? (
                    <Tile
                      key={`${slot.meal.deliveryId}:${slot.meal.meal}`}
                      meal={slot.meal}
                      apiBase={apiBase}
                      stacked={stacked}
                      onPress={() => onOpen(day, slot.meal)}
                    />
                  ) : (
                    <NoneTile key={`none:${slot.meal}`} meal={slot.meal} stacked={stacked} />
                  ),
                )}
                {/* One picked tile beside unpicked deliveries keeps its half width. */}
                {slots.length === 1 && !stacked ? <View style={styles.tileColumn} /> : null}
              </View>
            ) : null}
            {hidden.length ? (
              <MoreRow
                label={t(`+${hidden.length} lagi`, `+${hidden.length} more`)}
                onPress={() => onMore(day, hidden)}
              />
            ) : null}
            {unpicked.length ? <UnpickedRow count={unpicked.length} onPick={() => onPick(day, unpicked[0])} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** One delivery: its photo at 16:10 over the dish and "Siang · caterer". */
function Tile({
  meal,
  apiBase,
  stacked,
  onPress,
}: {
  meal: UpcomingMeal;
  apiBase: string;
  stacked: boolean;
  onPress: () => void;
}) {
  const { t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const id = `upcoming-tile-${meal.deliveryId}-${meal.meal}`;
  // Only picked deliveries get a tile, so the dish is set.
  const dish = meal.lead ?? "";
  const line = `${mealWord(meal.meal, t)} · ${meal.catererName}`;
  return (
    <PressableRow
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={rowLabel(dish, line)}
      onPress={onPress}
      style={[styles.tile, !stacked && styles.tileColumn]}
    >
      <View testID={`${id}-photo`} style={[styles.photo, { backgroundColor: c.sage }]}>
        {meal.image ? (
          <Image source={{ uri: photoUri(meal.image, apiBase) }} contentFit="cover" style={styles.fill} accessible={false} />
        ) : null}
      </View>
      <View style={styles.tileText}>
        <Text variant="bodyStrong" numberOfLines={stacked ? undefined : 1}>
          {dish}
        </Text>
        <Text variant="meta" numberOfLines={stacked ? undefined : 1}>
          {line}
        </Text>
      </View>
    </PressableRow>
  );
}

/** A meal slot with no delivery: a canvas-tone tile, so the day still has two. */
function NoneTile({ meal, stacked }: { meal: "lunch" | "dinner"; stacked: boolean }) {
  const { t } = useMobile();
  const styles = useStyles();
  const text =
    meal === "dinner"
      ? t("Malam tidak ada pengantaran", "No dinner delivery")
      : t("Siang tidak ada pengantaran", "No lunch delivery");
  return (
    <View style={[styles.tile, !stacked && styles.tileColumn]} accessible accessibilityLabel={text}>
      <View testID="upcoming-none" style={[styles.photo, styles.none]}>
        <Text variant="meta" style={styles.noneText}>
          {text}
        </Text>
      </View>
    </View>
  );
}

/**
 * A day's deliveries without a menu, as one row (spec R3): the utensil tile, how many ("Menu belum dipilih" for one) and
 * one "Pilih menu" text action to the first one's menu. The count wraps at large text; the action keeps one line.
 */
function UnpickedRow({ count, onPick }: { count: number; onPick: () => void }) {
  const { t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const text =
    count === 1
      ? t("Menu belum dipilih", "Menu not chosen yet")
      : t(`${count} pengantaran belum ada menu`, `${count} deliveries without a menu`);
  const action = t("Pilih menu", "Choose menu");
  return (
    <View testID="day-unpicked-row" style={styles.unpicked}>
      <View testID="day-unpicked-tile" style={styles.unpickedTile}>
        <DecorativeIcon name="restaurant-outline" size={20} color={c.charcoal} />
      </View>
      <Text variant="body" style={styles.unpickedText}>
        {text}
      </Text>
      <PressableRow accessibilityRole="button" accessibilityLabel={action} onPress={onPick} style={styles.pick}>
        {/* forest: action */}
        <Text variant="bodyStrong" numberOfLines={1} style={{ color: c.forest }}>
          {action}
        </Text>
      </PressableRow>
    </View>
  );
}

/** "+n lagi": a 36 tall link row (44 to reach, through its hit slop). */
function MoreRow({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <PressableRow
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={styles.more}
    >
      {/* forest: action (the link to the rest of the day) */}
      <Text variant="bodyStrong" style={{ color: c.forest }}>
        {label}
      </Text>
    </PressableRow>
  );
}

const useStyles = themedStyles((c) => ({
  // Between blocks 24; a block's label to its tiles 8.
  blocks: { gap: nativeLayout.space.xl },
  block: { gap: nativeLayout.groupGap },
  heading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: nativeLayout.space.md },
  label: { flexShrink: 1 },
  figures: { fontVariant: ["tabular-nums"] },
  grid: { gap: nativeLayout.space.md },
  tile: { gap: nativeLayout.space.sm },
  tileColumn: { flex: 1, minWidth: 0 },
  tileText: { minWidth: 0 },
  photo: {
    aspectRatio: nativeLayout.ratio.card,
    borderRadius: nativeLayout.radius.control,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fill: { width: "100%", height: "100%" },
  none: { backgroundColor: c.line, padding: nativeLayout.space.md },
  // Ink, not muted: muted on the `line` fill is 4.4:1, under the 4.5 text needs.
  noneText: { textAlign: "center", color: c.charcoal },
  more: { minHeight: 36, justifyContent: "center" },
  unpicked: { flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md, minHeight: 48 },
  unpickedTile: {
    width: 44,
    height: 44,
    borderRadius: nativeLayout.radius.control,
    backgroundColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  unpickedText: { flex: 1, minWidth: 0 },
  pick: { minHeight: 44, justifyContent: "center" },
}));
