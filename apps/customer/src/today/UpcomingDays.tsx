import { View } from "react-native";
import { router } from "expo-router";
import { WEEK_HEADER, type StoryPart, type UpcomingDay, type UpcomingMeal } from "@catera/domain";
import { nativeLayout } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { Text, themedStyles } from "@catera/mobile-ui";
import { dayHref } from "../hrefs";
import { ListCard, MediaRow, rowLabel, SectionHeader, Thumb } from "../layout";
import { goToTab } from "../nav";
import { DayBlocks, mealWord } from "./DayBlocks";
import { photoUri } from "./photoUri";
import { SECTION_LEAD } from "./sectionGap";

/** The most days Berikutnya shows, whatever the plans; "Lihat jadwal" has the rest. */
export const UPCOMING_DAYS = 3;

/** The date column of a one-delivery row. */
const DATE_COLUMN = 36;

/** Tomorrow's delivery parts in the story's own order, so a block can open the story at the part it shows. */
export type TomorrowParts = { date: string; parts: Pick<StoryPart, "deliveryId" | "meal">[] };

/**
 * "Berikutnya" (spec 3.1 item 5): the next delivery days, at most three, under a `section` heading with "Lihat jadwal".
 * While every shown day has one delivery they are one card of 72 rows (the weekday over the day number, the dish photo,
 * the dish and when it comes). A day with two or more makes every day a block of tiles (`DayBlocks`). Tomorrow opens
 * the tomorrow story at the part it shows; any other day opens its day sheet. What the caps leave out stays reachable:
 * "+n lagi" opens the delivery's day (or the story part, or the schedule when the rest are several deliveries), and
 * "Lihat jadwal" the Jadwal tab.
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
  const more = (day: UpcomingDay, hidden: UpcomingMeal[]) => {
    const first = hidden[0];
    const part = storyPart(day, first);
    // The story pages through every part, so its first hidden one reaches the rest. Elsewhere one delivery has its own
    // sheet; several have none to share, so the schedule is the way to all of them.
    if (part !== null) router.push(`/tomorrow?part=${part}` as never);
    else if (hidden.every((m) => m.deliveryId === first.deliveryId))
      router.push(dayHref(first.deliveryId, day.date, locale) as never);
    else goToTab("jadwal");
  };

  const single = shown.every((d) => d.meals.length === 1);
  return (
    <View testID="upcoming-days" style={styles.section}>
      <SectionHeader
        title={t("Berikutnya", "Coming up")}
        action={{ label: t("Lihat jadwal", "See schedule"), onPress: () => goToTab("jadwal") }}
      />
      {single ? (
        <ListCard inset={DATE_COLUMN + nativeLayout.space.md}>
          {shown.map((day) => (
            <DayRow
              key={day.date}
              day={day}
              meal={day.meals[0]}
              tomorrow={tomorrow?.date === day.date}
              apiBase={apiBase}
              onOpen={open}
            />
          ))}
        </ListCard>
      ) : (
        <DayBlocks days={shown} apiBase={apiBase} onOpen={open} onMore={more} />
      )}
    </View>
  );
}

/** One day with one delivery: the date column, the 56 photo (dashed while the menu is not set), the dish and its line. */
function DayRow({
  day,
  meal,
  tomorrow,
  apiBase,
  onOpen,
}: {
  day: UpcomingDay;
  meal: UpcomingMeal;
  tomorrow: boolean;
  apiBase: string;
  onOpen: (day: UpcomingDay, meal: UpcomingMeal) => void;
}) {
  const { t, locale } = useMobile();
  const styles = useStyles();
  const id = `upcoming-row-${meal.deliveryId}-${meal.meal}`;
  const notSet = meal.lead === null;
  const dish = meal.lead ?? t("Menu belum diisi", "Menu not set yet");
  const when = [mealWord(meal.meal, t), meal.window].filter(Boolean).join(" ");
  // A dish not chosen yet says whose kitchen it is: there is no dish to tell the row apart by.
  const line = [tomorrow ? t("Besok", "Tomorrow") : null, when, notSet ? meal.catererName : null]
    .filter(Boolean)
    .join(" · ");
  const weekday = WEEK_HEADER[locale][(new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7];
  return (
    <MediaRow
      testID={id}
      leading={
        <View style={styles.lead}>
          <View testID="upcoming-date" style={styles.date}>
            <Text variant="meta">{weekday}</Text>
            <Text variant="section" style={styles.figures}>
              {Number(day.date.slice(8))}
            </Text>
          </View>
          <Thumb
            uri={notSet || !meal.image ? null : photoUri(meal.image, apiBase)}
            notSet={notSet}
            testID={`${id}-thumb`}
          />
        </View>
      }
      title={dish}
      meta={line}
      wrap
      accessibilityLabel={rowLabel(day.label, dish, line)}
      onPress={() => onOpen(day, meal)}
    />
  );
}

const useStyles = themedStyles(() => ({
  section: { marginTop: SECTION_LEAD },
  lead: { flexDirection: "row", alignItems: "center", gap: nativeLayout.space.md },
  date: { width: DATE_COLUMN, alignItems: "center" },
  figures: { fontVariant: ["tabular-nums"] },
}));
