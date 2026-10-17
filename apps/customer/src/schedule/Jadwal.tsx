import { useEffect, useMemo, useState } from "react";
import { Image, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  calendarDays,
  jakartaDay,
  mealLabel,
  MEALS,
  windowStartMinutes,
  type CustomerState,
  type Delivery,
} from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Card,
  FadeSwap,
  fontFor,
  MoodHeader,
  PressableRow,
  PressableScale,
  ReadError,
  Screen,
  StateArt,
  Text,
  themedStyles,
  useColors,
  useMoodColors,
} from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { dayHref } from "../hrefs";
import { usePullToRefresh } from "../refresh";
import { JadwalCellsSkeleton } from "../skeletons";
import { photoUri } from "../today/Plate";
import { BLEED, CalendarLegend, MonthFrame, MonthGrid } from "./MonthGrid";
import { longDay, monthOf, monthRange, monthTitle, shiftMonth } from "./dates";

const live = (d: Delivery) => d.status !== "cancelled";
const served = (d: Delivery) => (d.meals ?? []).filter((m) => m.status !== "cancelled");
/** The caterer marked the meal "Gagal diantar": it did not come and is not coming. */
const failed = (status: string) => status === "issue";

/** The legend explains the cells and claims nothing about the month, so it holds its place in every state. */
function Legend() {
  const { t } = useMobile();
  return (
    <CalendarLegend
      labels={{
        photo: t("Foto menu", "Menu photo"),
        unset: t("Menu belum diisi", "Menu not set"),
        dinner: t("Ada makan malam", "Dinner too"),
      }}
    />
  );
}

/** Jadwal: the month at a glance and the meals of the day you tap. */
export function Jadwal() {
  const { actor, ready, t, locale } = useMobile();
  // Before the session is known, the header and this month's frame are already in place; only the cells wait.
  if (!ready) {
    const month = monthOf(jakartaDay(new Date()));
    return (
      <Screen
        header={
          <MoodHeader title={monthTitle(month, locale)}>
            <JadwalCellsSkeleton month={month} locale={locale} />
            <Legend />
          </MoodHeader>
        }
      >
        {null}
      </Screen>
    );
  }
  if (!actor) return <SignInFirst title={t("Jadwal", "Schedule")} next="/jadwal" headerTestID="jadwal-header" />;
  return <SignedInJadwal />;
}

function SignedInJadwal() {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const mood = useMoodColors();
  const styles = useStyles();
  const today = jakartaDay(new Date());
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState(today);
  const { from, to } = monthRange(month);
  const data = useData(`jadwal:${month}`, () => runtime.api.customer(`?from=${from}&to=${to}`));
  const state: CustomerState | null = data.data;
  const pull = usePullToRefresh(data.reload);

  useEffect(() => {
    setSelected(monthOf(today) === month ? today : `${month}-01`);
  }, [month]);

  const deliveries = useMemo(() => state?.deliveries.filter((d) => monthOf(d.service_date) === month) ?? [], [state, month]);
  const days = useMemo(() => calendarDays(deliveries), [deliveries]);
  // No meal comes this month: every delivery is cancelled, or every meal of it is.
  const monthEmpty = !deliveries.some((d) => live(d) && served(d).length > 0);
  const day = deliveries
    .filter((d) => d.service_date === selected && live(d))
    .flatMap((d) => served(d).map((m) => ({ d, m })))
    // Lunch before dinner, then by service window when several caterers serve the same meal.
    .sort(
      (a, b) =>
        MEALS.indexOf(a.m.meal) - MEALS.indexOf(b.m.meal) ||
        windowStartMinutes(a.d.offer, a.m.meal) - windowStartMinutes(b.d.offer, b.m.meal),
    );

  // The month moves from the header's trailing slot. The chevrons sit on the header, so they read its mood text colour.
  const chevrons = (
    <View style={styles.monthBar}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t("Bulan sebelumnya", "Previous month")}
        onPress={() => setMonth(shiftMonth(month, -1))}
        style={styles.arrow}
      >
        <Ionicons name="chevron-back" size={22} color={mood.headerText} />
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t("Bulan berikutnya", "Next month")}
        onPress={() => setMonth(shiftMonth(month, 1))}
        style={styles.arrow}
      >
        <Ionicons name="chevron-forward" size={22} color={mood.headerText} />
      </PressableScale>
    </View>
  );

  return (
    <Screen
      header={
        // The tab bar already names this tab, so the row holds only the month arrows.
        <MoodHeader testID="jadwal-header" title={monthTitle(month, locale)} trailing={chevrons}>
          {/* The header is the same height in all three states: the loaded grid, and the frame that stands in for it
              while the month loads (with a skeleton cell per day) or after a failed read, are all six week rows tall,
              and the legend stays below. The month fades in from its skeleton as one block. The grid pulls out past
              the header's padding by BLEED, so the fade's box pulls out with it: every cell stays inside its parent,
              where a tap on an edge cell still reaches it. */}
          <FadeSwap
            swapKey={state ? `${month}:ready` : data.error ? `${month}:error` : `${month}:loading`}
            style={{ marginHorizontal: BLEED, paddingHorizontal: -BLEED }}
          >
            {state ? (
              <MonthGrid
                month={month}
                today={today}
                selected={selected}
                days={days}
                apiBase={runtime.apiBase}
                locale={locale}
                onSelect={setSelected}
              />
            ) : data.error ? (
              // Nothing is known about this month yet, so the frame says that instead of drawing its days as empty. The
              // failed read is the month, so the puzzled mascot leads it (spec 7.2), inside the frame: the art (120, or
              // 96 on a 360dp phone at font scale 1.3), the message and the 48dp retry fit its six 52dp week rows, so
              // the header keeps its height.
              <MonthFrame locale={locale}>
                <View style={{ gap: 4, alignItems: "center" }}>
                  <StateArt pose="bingung" style={{ marginBottom: 8 }} />
                  <Text selectable style={{ color: mood.headerText, textAlign: "center" }}>
                    {data.error}
                  </Text>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={t("Coba lagi", "Try again")}
                    onPress={() => void data.reload()}
                    style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: "center" }}
                  >
                    <Text variant="label" style={{ color: mood.headerText, textDecorationLine: "underline" }}>
                      {t("Coba lagi", "Try again")}
                    </Text>
                  </PressableScale>
                </View>
              </MonthFrame>
            ) : (
              <JadwalCellsSkeleton month={month} locale={locale} />
            )}
          </FadeSwap>
          <Legend />
        </MoodHeader>
      }
      // Pulling down reads this month again; the grid and the day stay on screen until it answers.
      refreshControl={state ? pull : undefined}
    >
      {/* The chosen day fades in with the month: this and the grid's FadeSwap swap on the same read, over the same
          time. While the month is read the panel is empty rather than a second skeleton. */}
      <FadeSwap swapKey={state ? "ready" : "loading"} style={{ gap: 16 }}>
        {state ? (
          <>
            {data.error ? (
              // A refresh failed but the month is on screen: the error stays with its retry in the page.
              <ReadError message={data.error} onRetry={() => void data.reload()} />
            ) : null}
            {/* A month with no meals at all: the resting mascot sits above the day, which says there is nothing. */}
            {monthEmpty ? <StateArt pose="tidur" /> : null}
            <Text variant="label">{longDay(selected, locale)}</Text>
            {day.length ? (
              <Card style={{ padding: 4, gap: 0 }}>
                {day.map(({ d, m }, i) => (
                  <MealRow key={`${d.id}:${m.meal}`} delivery={d} meal={m.meal} status={m.status} first={i === 0} apiBase={runtime.apiBase} />
                ))}
              </Card>
            ) : (
              <Text style={{ color: c.muted }}>{t("Tidak ada pengantaran di hari ini.", "No delivery on this day.")}</Text>
            )}
          </>
        ) : null}
      </FadeSwap>
    </Screen>
  );
}

function MealRow({
  delivery: d,
  meal,
  status,
  first,
  apiBase,
}: {
  delivery: Delivery;
  meal: "lunch" | "dinner";
  status: string;
  first: boolean;
  apiBase: string;
}) {
  const { t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const image = d.offer.menus?.find((m) => m.meal === meal)?.image || d.offer.image;
  const state =
    status === "delivered"
      ? t("Sudah sampai", "Arrived")
      : failed(status)
        ? t("Tidak bisa diantar", "Couldn't be delivered")
        : "";
  const sub = [mealLabel(meal, locale), d.offer.windows?.[meal], state].filter(Boolean).join(" · ");
  return (
    <PressableRow
      accessibilityRole="button"
      accessibilityLabel={`${d.offer.name}, ${sub}`}
      onPress={() => router.push(dayHref(d.id, d.service_date, locale) as never)}
      style={[styles.meal, !first && styles.divider]}
    >
      {image ? (
        <Image source={{ uri: photoUri(image, apiBase) }} style={styles.photo} accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.photo} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fontFor("700") }}>{d.offer.name}</Text>
        <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </PressableRow>
  );
}

const useStyles = themedStyles((c) => ({
  monthBar: { flexDirection: "row", alignItems: "center" },
  arrow: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  meal: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 8 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  photo: { width: 56, height: 56, borderRadius: 10, backgroundColor: c.sage },
}));
