import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  mealJourney,
  monthName,
  statusLabel,
  MEALS,
  weekdayName,
  windowStartMinutes,
  type CalendarDay,
  type Delivery,
  type Locale,
} from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import { PressableRow, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { router } from "expo-router";
import { ListCard, MediaRow } from "../layout";
import { dayHref } from "../hrefs";
import { photoUri } from "../today/Plate";

const live = (d: Delivery) => d.status !== "cancelled";
const served = (d: Delivery) => (d.meals ?? []).filter((m) => m.status !== "cancelled");
/** The caterer marked the meal "Gagal diantar": it did not come and is not coming. */
const failed = (status: string) => status === "issue";

type Item = { d: Delivery; m: ReturnType<typeof served>[number] };

/** "Senin 5 Okt": the weekday and the short date, the spec's day label. */
const dayName = (date: string, locale: Locale) => `${weekdayName(date, locale)} ${Number(date.slice(8))} ${monthName(date, locale)}`;

/** "5–11 Okt", or "26 Okt–1 Nov" for a week that straddles two months. */
export function rangeLabel(dates: string[], locale: Locale): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  const [a, b] = [Number(first.slice(8)), Number(last.slice(8))];
  if (first === last) return `${a} ${monthName(first, locale)}`;
  if (first.slice(0, 7) === last.slice(0, 7)) return `${a}–${b} ${monthName(first, locale)}`;
  return `${a} ${monthName(first, locale)}–${b} ${monthName(last, locale)}`;
}

/** "Sabtu", "Sabtu dan Minggu", "Rabu, Kamis, dan Minggu": the names of days, read as a sentence's subject. */
function nameList(names: string[], locale: Locale): string {
  const and = locale === "en" ? "and" : "dan";
  if (names.length < 2) return names.join("");
  if (names.length === 2) return `${names[0]} ${and} ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, ${and} ${names[names.length - 1]}`;
}

/**
 * Jadwal's agenda under the month (spec 3.2 item 2): one block per delivery day of the selected day's week, in order,
 * each a card of 72 meal rows under a `bodyStrong` day label; the days with nothing fold into one muted row; the last
 * row opens the next week. `week` and `next` are whole Monday-to-Sunday weeks; the read window covers the whole week, so
 * a day in the neighbouring month is real data and never reported as empty by mistake.
 */
export function WeekAgenda({
  week,
  next,
  today,
  deliveries,
  days,
  apiBase,
  locale,
  onOpenWeek,
}: {
  week: string[];
  next: string[];
  today: string;
  deliveries: Delivery[];
  days: ReadonlyMap<string, CalendarDay>;
  apiBase: string;
  locale: Locale;
  onOpenWeek: (firstDay: string) => void;
}) {
  const { t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const itemsOf = (date: string): Item[] =>
    deliveries
      .filter((d) => d.service_date === date && live(d))
      .flatMap((d) => served(d).map((m) => ({ d, m })))
      // Lunch before dinner, then by service window when several caterers serve the same meal.
      .sort(
        (a, b) =>
          MEALS.indexOf(a.m.meal) - MEALS.indexOf(b.m.meal) ||
          windowStartMinutes(a.d.offer, a.m.meal) - windowStartMinutes(b.d.offer, b.m.meal),
      );

  const blocks = week.map((date) => ({ date, items: itemsOf(date) }));
  const withMeals = blocks.filter((b) => b.items.length > 0);
  const empty = blocks.filter((b) => b.items.length === 0).map((b) => weekdayName(b.date, locale));
  const count = withMeals.reduce((n, b) => n + b.items.length, 0);
  const range = rangeLabel(week, locale);
  const thisWeek = week.includes(today);

  // Each meal is one delivery.
  const meta = thisWeek
    ? range
    : count
      ? t(`${count} pengantaran`, `${count} ${count === 1 ? "delivery" : "deliveries"}`)
      : null;
  const emptyLine =
    empty.length === week.length
      ? t("Tidak ada pengantaran di minggu ini", "No deliveries this week")
      : t(`${nameList(empty, "id")} tidak ada pengantaran`, `No deliveries on ${nameList(empty, "en")}`);

  const mealRow = ({ d, m }: Item, date: string) => {
    const set = days.get(date)?.[m.meal]?.menuSet;
    const notSet = set === false;
    const image = d.offer.menus?.find((x) => x.meal === m.meal)?.image || d.offer.image;
    const state =
      m.status === "delivered"
        ? t("Sudah sampai", "Arrived")
        : mealJourney(m).stage === "arrived"
          ? statusLabel("arrived", locale)
          : failed(m.status)
            ? t("Gagal diantar", "Not delivered")
            : "";
    const label = m.meal === "dinner" ? t("Malam", "Dinner") : t("Siang", "Lunch");
    const window = d.offer.windows?.[m.meal];
    const sub = [window ? `${label} ${window}` : label, state].filter(Boolean).join(" · ");
    return (
      <MediaRow
        key={`${d.id}:${m.meal}`}
        testID={`agenda-row-${d.id}-${m.meal}`}
        image={image && !notSet ? photoUri(image, apiBase) : null}
        notSet={notSet}
        title={d.offer.name}
        meta={sub}
        trailing="chevron"
        wrap
        onPress={() => router.push(dayHref(d.id, d.service_date, locale) as never)}
      />
    );
  };

  return (
    <View testID="week-agenda">
      <View testID="agenda-heading" style={styles.heading}>
        <Text variant="section" style={{ flexShrink: 1 }}>
          {thisWeek ? t("Minggu ini", "This week") : t(`Pekan ${range}`, `Week of ${range}`)}
        </Text>
        {meta ? <Text variant="meta">{meta}</Text> : null}
      </View>
      <View style={styles.body}>
        {withMeals.length ? (
          <View style={styles.blocks}>
            {withMeals.map(({ date, items }) => (
              <View key={date} testID={`agenda-day-${date}`} style={styles.block}>
                <Text variant="bodyStrong">
                  {date === today ? `${dayName(date, locale)} · ${t("Hari ini", "Today")}` : dayName(date, locale)}
                </Text>
                <ListCard>{items.map((item) => mealRow(item, date))}</ListCard>
              </View>
            ))}
          </View>
        ) : null}
        {empty.length ? (
          <View testID="agenda-empty-days" style={styles.empty}>
            <Text variant="bodyL" style={{ color: c.muted }}>
              {emptyLine}
            </Text>
          </View>
        ) : null}
        <PressableRow
          testID="agenda-next-week"
          accessibilityRole="button"
          onPress={() => onOpenWeek(next[0])}
          style={styles.next}
        >
          <Text variant="rowTitle" style={{ flex: 1 }}>
            {t(`Minggu depan, ${rangeLabel(next, locale)}`, `Next week, ${rangeLabel(next, locale)}`)}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={c.muted} />
        </PressableRow>
      </View>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  // heading to content 12, a day block's label to its card 8, between blocks 24, between the agenda's parts 16.
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    columnGap: nativeLayout.space.md,
    marginBottom: nativeLayout.headingGap,
  },
  body: { gap: nativeLayout.space.lg },
  blocks: { gap: nativeLayout.space.xl },
  block: { gap: nativeLayout.groupGap },
  empty: {
    minHeight: nativeLayout.row.single,
    justifyContent: "center",
    paddingHorizontal: nativeLayout.cardPadding,
    borderRadius: nativeLayout.radius.card,
    backgroundColor: c.surface,
  },
  next: {
    minHeight: nativeLayout.row.single,
    flexDirection: "row",
    alignItems: "center",
    gap: nativeLayout.space.md,
    paddingHorizontal: nativeLayout.cardPadding,
    borderRadius: nativeLayout.radius.card,
    backgroundColor: c.surface,
  },
}));
