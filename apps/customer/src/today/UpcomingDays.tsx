import { View } from "react-native";
import { router } from "expo-router";
import type { StoryPart, UpcomingDay, UpcomingMeal } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { plural, useMobile } from "@catera/mobile-core";
import { PolishArt, PressableRow, Text, themedStyles, useColors, type PolishArtName } from "@catera/mobile-ui";
import { dayHref } from "../hrefs";
import { ListCard, rowLabel, SectionHeader, Thumb } from "../layout";
import { goToTab } from "../nav";
import { photoUri } from "./photoUri";
import { SECTION_LEAD } from "./sectionGap";

/** The most days Berikutnya shows, whatever the plans; "Lihat semua jadwal" has the rest. */
export const UPCOMING_DAYS = 3;

/** The most photos a day's strip shows; a day with more ends it with a "+n" tile. */
const STRIP = 4;
/** The strip tiles are the 48 compact thumb; the picture sits 4 in from its edge. */
const TILE = nativeLayout.thumb.compact;
const TILE_ART = TILE - 8;

type Translate = (id: string, en: string) => string;

/** The word for a meal ("Siang"). */
const mealWord = (meal: "lunch" | "dinner", t: Translate) =>
  meal === "dinner" ? t("Malam", "Dinner") : t("Siang", "Lunch");

/**
 * The picture for a day with no dish photo (polish canvas Beranda): a menu the customer still picks is the empty plate
 * and pencil, one the caterer has not announced is the rantang with its clock, and a set menu with no photo is the open
 * rantang. A set menu with a photo keeps the photo.
 */
export function dayArt(meal: Pick<UpcomingMeal, "lead" | "pickable">): PolishArtName {
  if (meal.lead !== null) return "spot-rantang-open";
  return meal.pickable ? "spot-plate-empty-pencil" : "spot-rantang-clock";
}

/** Tomorrow's delivery parts in the story's own order, so a card can open the story at the part it shows. */
export type TomorrowParts = { date: string; parts: Pick<StoryPart, "deliveryId" | "meal">[] };

/**
 * "Berikutnya" (spec 3.1 item 5; audit canvas 7): the next delivery days, at most three, under a `section` heading with
 * "Lihat jadwal". Each day is one card: its label and how many deliveries, a strip of the meals' photos (four, then
 * a "+n" tile), one "Siang n · Malam n" line with the menus not announced yet as its tail, and, only
 * when a menu is the customer's to pick before its cutoff, one action line. Tapping the card opens the day's first
 * delivery (the tomorrow story at the part it shows, else its day sheet); "Lihat semua jadwal" opens the Jadwal tab.
 */
export function UpcomingDays({
  days,
  apiBase,
  tomorrow,
}: {
  days: UpcomingDay[];
  apiBase: string;
  tomorrow: TomorrowParts | null;
}) {
  const { t, locale } = useMobile();
  const styles = useStyles();
  const c = useColors();
  const shown = days.slice(0, UPCOMING_DAYS);
  if (!shown.length) return null;

  /** The story part a tomorrow delivery is; null for any other day, or a delivery the story does not page through. */
  const storyPart = (day: UpcomingDay, meal: UpcomingMeal) => {
    if (tomorrow?.date !== day.date) return null;
    const at = tomorrow.parts.findIndex((p) => p.deliveryId === meal.deliveryId && p.meal === meal.meal);
    return at < 0 ? null : at;
  };
  const open = (day: UpcomingDay, meal: UpcomingMeal) => {
    const part = storyPart(day, meal);
    router.push((part === null ? dayHref(meal.deliveryId, day.date, locale) : `/tomorrow?part=${part}`) as never);
  };
  // The action opens the plan's menu at the first delivery still open to a pick.
  const pick = (day: UpcomingDay, first: UpcomingMeal) =>
    router.push(`/pilih-menu/${encodeURIComponent(first.subscriptionId)}?date=${day.date}&meal=${first.meal}` as never);

  return (
    <View testID="upcoming-days" style={styles.section}>
      <SectionHeader
        title={t("Berikutnya", "Coming up")}
        action={{ label: t("Lihat jadwal", "See schedule"), onPress: () => goToTab("jadwal") }}
      />
      <View style={styles.cards}>
        {shown.map((day) => (
          <DayCard key={day.date} day={day} apiBase={apiBase} onOpen={open} onPick={pick} />
        ))}
      </View>
      <PressableRow
        testID="upcoming-all"
        accessibilityRole="button"
        accessibilityLabel={t("Lihat semua jadwal", "See the whole schedule")}
        onPress={() => goToTab("jadwal")}
        style={styles.all}
      >
        {/* forest: action (the link to the whole schedule) */}
        <Text variant="bodyStrong" style={{ color: c.forest }}>
          {t("Lihat semua jadwal", "See the whole schedule")}
        </Text>
      </PressableRow>
    </View>
  );
}

/** One day: label and delivery count, the photo strip, the count line, and the action line when a pick is due. */
function DayCard({
  day,
  apiBase,
  onOpen,
  onPick,
}: {
  day: UpcomingDay;
  apiBase: string;
  onOpen: (day: UpcomingDay, meal: UpcomingMeal) => void;
  onPick: (day: UpcomingDay, first: UpcomingMeal) => void;
}) {
  const { t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const n = day.meals.length;
  const lunch = day.meals.filter((m) => m.meal === "lunch").length;
  const dinner = n - lunch;
  // Pick-your-own menus before their cutoff are the customer's to choose; a caterer-chosen one is waiting on the kitchen.
  const toPick = day.meals.filter((m) => m.lead === null && m.pickable && m.changeUntil !== null);
  const unannounced = day.meals.filter((m) => m.lead === null && !m.pickable).length;
  const split = [
    lunch ? `${mealWord("lunch", t)} ${lunch}` : null,
    dinner ? `${mealWord("dinner", t)} ${dinner}` : null,
    unannounced ? t(`${unannounced} menu belum diumumkan`, `${plural(unannounced, "menu")} not announced yet`) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const count = t(`${n} pengantaran`, n === 1 ? "1 delivery" : `${n} deliveries`);
  const tiles = day.meals.slice(0, STRIP);
  const rest = n - tiles.length;
  const first = toPick[0];
  return (
    <ListCard inset={0}>
      <PressableRow
        testID={`upcoming-day-${day.date}`}
        accessibilityRole="button"
        accessibilityLabel={rowLabel(day.label, count, split)}
        onPress={() => onOpen(day, day.meals[0])}
        style={styles.card}
      >
        <View style={styles.heading}>
          <Text testID="upcoming-day-label" variant="rowTitle" style={styles.label}>
            {day.label}
          </Text>
          <Text testID="upcoming-day-count" variant="meta" style={styles.figures}>
            {count}
          </Text>
        </View>
        <View testID={`upcoming-strip-${day.date}`} style={styles.strip}>
          {tiles.map((meal) => (
            <StripTile key={`${meal.deliveryId}:${meal.meal}`} meal={meal} apiBase={apiBase} />
          ))}
          {rest ? (
            <View testID="upcoming-more" style={[styles.tile, styles.more]}>
              <Text variant="bodyStrong" style={styles.figures}>{`+${rest}`}</Text>
            </View>
          ) : null}
        </View>
        <Text testID="upcoming-day-split" variant="meta" style={styles.figures}>
          {split}
        </Text>
      </PressableRow>
      {first ? (
        <View testID={`upcoming-action-${day.date}`} style={styles.action}>
          <View style={styles.actionText}>
            <Text variant="bodyStrong">
              {t(`${toPick.length} menu perlu dipilih`, `${plural(toPick.length, "menu")} to choose`)}
            </Text>
            <Text variant="meta">{t(`sebelum ${first.changeUntil}`, `before ${first.changeUntil}`)}</Text>
          </View>
          <PressableRow
            accessibilityRole="button"
            accessibilityLabel={t("Pilih menu", "Choose menu")}
            onPress={() => onPick(day, first)}
            style={styles.pick}
          >
            {/* forest: action */}
            <Text variant="bodyStrong" numberOfLines={1} style={{ color: c.forest }}>
              {t("Pilih menu", "Choose menu")}
            </Text>
          </PressableRow>
        </View>
      ) : null}
    </ListCard>
  );
}

/** One meal in the strip: its photo, or its picture (`dayArt`) while it has none. */
function StripTile({ meal, apiBase }: { meal: UpcomingMeal; apiBase: string }) {
  const styles = useStyles();
  const id = `upcoming-tile-${meal.deliveryId}-${meal.meal}`;
  if (meal.lead !== null && meal.image) return <Thumb uri={photoUri(meal.image, apiBase)} size={TILE} testID={id} />;
  return (
    <View testID={meal.lead === null ? `${id}-not-set` : id} style={styles.tile}>
      <PolishArt name={dayArt(meal)} size={TILE_ART} />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  section: { marginTop: SECTION_LEAD },
  cards: { gap: nativeLayout.space.md },
  card: { paddingVertical: nativeLayout.space.md, gap: nativeLayout.space.sm },
  heading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: nativeLayout.space.md },
  label: { flexShrink: 1 },
  figures: { fontVariant: ["tabular-nums"] },
  strip: { flexDirection: "row", flexWrap: "wrap", gap: nativeLayout.space.sm },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: nativeLayout.radius.thumb,
    borderCurve: "continuous",
    backgroundColor: c.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  more: { backgroundColor: c.line },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: nativeLayout.space.md,
    paddingVertical: nativeLayout.space.sm,
    minHeight: nativeLayout.row.info,
  },
  actionText: { flex: 1, minWidth: 0 },
  pick: { minHeight: 44, justifyContent: "center" },
  all: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: nativeLayout.space.xs },
}));
