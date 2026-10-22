import { View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { UpcomingDay, UpcomingMeal } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { PressableRow, Text, themedStyles, useColors, useStackedLayout } from "@catera/mobile-ui";
import { photoUri } from "./photoUri";

/** The most delivery tiles a day shows; the rest are "+n lagi". */
export const TILES_PER_DAY = 2;

type Translate = (id: string, en: string) => string;

type Slot = { kind: "meal"; meal: UpcomingMeal } | { kind: "none"; meal: "lunch" | "dinner" };

/** The word for a meal ("Siang"), shared by the tiles and the one-delivery rows. */
export const mealWord = (meal: "lunch" | "dinner", t: Translate) =>
  meal === "dinner" ? t("Malam", "Dinner") : t("Siang", "Lunch");

/**
 * A day's tiles. One delivery fills one of the two meal slots and says the other is empty (the empty lunch before a
 * dinner, the empty dinner after a lunch). Two or more fill two tiles; the rest are `hidden`, reached through "+n lagi".
 */
function slotsOf(day: UpcomingDay): { slots: Slot[]; hidden: UpcomingMeal[] } {
  if (day.meals.length === 1) {
    const only = day.meals[0];
    const meal: Slot = { kind: "meal", meal: only };
    const none: Slot = { kind: "none", meal: only.meal === "lunch" ? "dinner" : "lunch" };
    return { slots: only.meal === "lunch" ? [meal, none] : [none, meal], hidden: [] };
  }
  return {
    slots: day.meals.slice(0, TILES_PER_DAY).map((meal) => ({ kind: "meal", meal })),
    hidden: day.meals.slice(TILES_PER_DAY),
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
}: {
  days: UpcomingDay[];
  apiBase: string;
  /** A tile was pressed. */
  onOpen: (day: UpcomingDay, meal: UpcomingMeal) => void;
  /** "+n lagi" was pressed; `hidden` are the deliveries the tiles left out. */
  onMore: (day: UpcomingDay, hidden: UpcomingMeal[]) => void;
}) {
  const { t } = useMobile();
  const styles = useStyles();
  const stacked = useStackedLayout(340);
  return (
    <View style={styles.blocks}>
      {days.map((day) => {
        const { slots, hidden } = slotsOf(day);
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
            </View>
            {hidden.length ? (
              <MoreRow
                label={t(`+${hidden.length} lagi`, `+${hidden.length} more`)}
                onPress={() => onMore(day, hidden)}
              />
            ) : null}
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
  const dish = meal.lead ?? t("Menu belum diisi", "Menu not set yet");
  const line = `${mealWord(meal.meal, t)} · ${meal.catererName}`;
  return (
    <PressableRow
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={`${dish}, ${line}`}
      onPress={onPress}
      style={[styles.tile, !stacked && styles.tileColumn]}
    >
      {meal.lead === null ? (
        <View testID={`${id}-photo-not-set`} style={[styles.photo, styles.notSet]}>
          <Ionicons name="restaurant-outline" size={24} color={c.controlRing} />
        </View>
      ) : (
        <View testID={`${id}-photo`} style={[styles.photo, { backgroundColor: c.sage }]}>
          {meal.image ? (
            <Image source={{ uri: photoUri(meal.image, apiBase) }} contentFit="cover" style={styles.fill} accessible={false} />
          ) : null}
        </View>
      )}
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
  notSet: { borderWidth: 1.5, borderStyle: "dashed", borderColor: c.controlRing },
  none: { backgroundColor: c.line, padding: nativeLayout.space.md },
  noneText: { textAlign: "center" },
  more: { minHeight: 36, justifyContent: "center" },
}));
