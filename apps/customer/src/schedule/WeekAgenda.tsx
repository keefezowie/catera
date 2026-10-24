import { View } from "react-native";
import {
  canChangeDay,
  mealJourney,
  menuIsSet,
  monthName,
  statusLabel,
  storyDishes,
  MEALS,
  weekdayName,
  windowStart,
  windowStartMinutes,
  type Delivery,
  type Locale,
} from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { nativeLayout } from "@catera/design-tokens";
import { PressableRow, PressableScale, Text, themedStyles, useColors, cardEdge, cardEdgeWidth } from "@catera/mobile-ui";
import { router } from "expo-router";
import { DecorativeIcon, ListCard, MediaRow } from "../layout";
import { dayHref } from "../hrefs";
import { photoUri } from "../today/Plate";
import { mealReported, mealSettled } from "./mealState";

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
  now,
  deliveries,
  apiBase,
  locale,
  onOpenWeek,
}: {
  week: string[];
  next: string[];
  today: string;
  /** The clock Beranda's plate reads, so a meal past its window is "due" on both screens. */
  now: Date;
  deliveries: Delivery[];
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
    const image = d.offer.menus?.find((x) => x.meal === m.meal)?.image || d.offer.image;
    // The words the screen already uses for a meal's stage (Plate's state line, the day sheet), so the agenda never coins
    // its own: scheduled, cooking, on the way, arrived, delivered, not delivered.
    const journey = mealJourney(m);
    // Beranda's rule (plateState): today's meal nobody has sent out whose window has opened is due, and a report outranks
    // it. Only today: a past day nobody updated was settled as delivered by the server (auto_deliver reads silence so).
    const reported = mealReported(m);
    const due = !reported && date === today && windowStart(date, d.offer, m.meal) <= now.getTime();
    const settled = mealSettled(m, date, today);
    const state = failed(m.status)
      ? t("Gagal diantar", "Not delivered")
      : reported
        ? t("Laporan terkirim", "Report sent")
        : journey.stage === "delivered" || settled
          ? t("Sudah sampai", "Arrived")
          : journey.stage === "arrived"
            ? statusLabel("arrived", locale)
            : journey.stage === "out_for_delivery"
              ? t("Sedang diantar", "On the way")
              : due
                ? t("Belum sampai", "Not here yet")
                : journey.stage === "preparing"
                  ? t("Sedang dimasak", "Being cooked")
                  : t("Terjadwal", "Scheduled");
    const label = m.meal === "dinner" ? t("Malam", "Dinner") : t("Siang", "Lunch");
    const window = d.offer.windows?.[m.meal];
    const sub = [window ? `${label} ${window}` : label, state].filter(Boolean).join(" · ");
    // The row's title is the meal's lead dish, as the day sheet's is; a menu not set says so instead of naming the package.
    const menu = d.offer.menus?.find((x) => x.meal === m.meal);
    const lead = menu && menuIsSet(menu) ? storyDishes(menu).title : null;
    // The thumb and the title read the same menu: a photo never sits beside "Menu belum diisi".
    const notSet = !lead;
    const title = lead || t("Menu belum diisi", "Menu not set yet");
    // A pick-your-own day whose menu is not set offers the pick beside the row only while the day can still change
    // (before its cutoff): the rule Beranda's day block reads through `changeUntil`.
    const changeable = canChangeDay(d, now);
    const pick =
      notSet && date >= today && d.offer.menuSelectionMode === "customer" && (changeable.date || changeable.address);
    const row = (
      <MediaRow
        key={`${d.id}:${m.meal}`}
        testID={`agenda-row-${d.id}-${m.meal}`}
        image={image && !notSet ? photoUri(image, apiBase) : null}
        notSet={notSet}
        title={title}
        meta={sub}
        accessibilityLabel={[title, sub].filter(Boolean).join(", ")}
        trailing="chevron"
        wrap
        onPress={() => router.push(dayHref(d.id, d.service_date, locale) as never)}
      />
    );
    if (!pick) return row;
    // The action is the row's sibling, not a child of its button, so each is its own target for touch and screen reader.
    const query = new URLSearchParams({ date, meal: m.meal }).toString();
    return (
      <View key={`${d.id}:${m.meal}`} style={styles.pickRow}>
        <View style={{ flex: 1, minWidth: 0 }}>{row}</View>
        <PressableScale
          testID={`agenda-pick-${d.id}-${m.meal}`}
          accessibilityRole="button"
          accessibilityLabel={t(`Pilih menu, ${dayName(date, "id")}`, `Choose menu, ${dayName(date, "en")}`)}
          onPress={() => router.push(`/pilih-menu/${encodeURIComponent(d.subscription_id)}?${query}` as never)}
          style={styles.pick}
        >
          {/* forest: action */}
          <Text variant="bodyStrong" style={{ color: c.forest }}>
            {t("Pilih menu", "Choose menu")}
          </Text>
        </PressableScale>
      </View>
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
          accessibilityLabel={t(`Minggu depan, ${rangeLabel(next, locale)}`, `Next week, ${rangeLabel(next, locale)}`)}
          onPress={() => onOpenWeek(next[0])}
          style={styles.next}
        >
          <Text variant="rowTitle" style={{ flex: 1 }}>
            {t(`Minggu depan, ${rangeLabel(next, locale)}`, `Next week, ${rangeLabel(next, locale)}`)}
          </Text>
          {process.env.EXPO_OS === "ios" ? <DecorativeIcon name="chevron-forward" size={20} color={c.muted} /> : null}
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
  pickRow: { flexDirection: "row", alignItems: "center", gap: nativeLayout.space.sm },
  pick: { minHeight: 44, flexShrink: 0, justifyContent: "center", paddingHorizontal: nativeLayout.space.sm },
  empty: {
    minHeight: nativeLayout.row.single,
    justifyContent: "center",
    paddingHorizontal: nativeLayout.cardPadding - cardEdgeWidth(c),
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    backgroundColor: c.surface,
    ...cardEdge(c),
  },
  next: {
    minHeight: nativeLayout.row.single,
    flexDirection: "row",
    alignItems: "center",
    gap: nativeLayout.space.md,
    paddingHorizontal: nativeLayout.cardPadding - cardEdgeWidth(c),
    borderRadius: nativeLayout.radius.card,
    borderCurve: "continuous",
    backgroundColor: c.surface,
    ...cardEdge(c),
  },
}));
