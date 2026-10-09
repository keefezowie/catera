import { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { jakartaDay, mealLabel, MEALS, windowStartMinutes, type CustomerState, type Delivery } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import {
  Button,
  Card,
  fontFor,
  PressableRow,
  PressableScale,
  Screen,
  Text,
  themedStyles,
  useColors,
} from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { photoUri } from "../today/Plate";
import { MonthGrid, type DayMark } from "./MonthGrid";
import { longDay, monthOf, monthRange, monthTitle, shiftMonth } from "./dates";

const live = (d: Delivery) => d.status !== "cancelled";
const served = (d: Delivery) => (d.meals ?? []).filter((m) => m.status !== "cancelled");
/** The caterer marked the meal "Gagal diantar": it did not come and is not coming. */
const failed = (status: string) => status === "issue";

/**
 * What each day covers: lunch and/or dinner, and `done` once every meal it serves has arrived.
 * Meals the caterer could not deliver count as neither, so a day of only those has no mark.
 */
function marksOf(deliveries: Delivery[]): Map<string, DayMark> {
  const marks = new Map<string, DayMark>();
  for (const d of deliveries.filter(live)) {
    const meals = served(d).filter((m) => !failed(m.status));
    if (!meals.length) continue;
    const mark = marks.get(d.service_date) ?? { lunch: false, dinner: false, done: true };
    for (const m of meals) {
      mark[m.meal] = true;
      if (m.status !== "delivered") mark.done = false;
    }
    marks.set(d.service_date, mark);
  }
  return marks;
}

/** Jadwal: the month at a glance and the meals of the day you tap. */
export function Jadwal() {
  const { actor, ready, t } = useMobile();
  const c = useColors();
  const styles = useStyles();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.forest} />
      </View>
    );
  if (!actor) return <SignInFirst title={t("Jadwal", "Schedule")} next="/jadwal" />;
  return <SignedInJadwal />;
}

function SignedInJadwal() {
  const { runtime, t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  const today = jakartaDay(new Date());
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState(today);
  const { from, to } = monthRange(month);
  const data = useData(`jadwal:${month}`, () => runtime.api.customer(`?from=${from}&to=${to}`));
  const state: CustomerState | null = data.data;

  useEffect(() => {
    setSelected(monthOf(today) === month ? today : `${month}-01`);
  }, [month]);

  const deliveries = state?.deliveries.filter((d) => monthOf(d.service_date) === month) ?? [];
  const day = deliveries
    .filter((d) => d.service_date === selected && live(d))
    .flatMap((d) => served(d).map((m) => ({ d, m })))
    // Lunch before dinner, then by service window when several caterers serve the same meal.
    .sort(
      (a, b) =>
        MEALS.indexOf(a.m.meal) - MEALS.indexOf(b.m.meal) ||
        windowStartMinutes(a.d.offer, a.m.meal) - windowStartMinutes(b.d.offer, b.m.meal),
    );

  return (
    <Screen>
      <Text variant="title">{t("Jadwal", "Schedule")}</Text>
      <View style={styles.monthBar}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t("Bulan sebelumnya", "Previous month")}
          onPress={() => setMonth(shiftMonth(month, -1))}
          style={styles.arrow}
        >
          <Ionicons name="chevron-back" size={22} color={c.forest} />
        </PressableScale>
        <Text variant="heading" style={{ flex: 1, textAlign: "center" }}>
          {monthTitle(month, locale)}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t("Bulan berikutnya", "Next month")}
          onPress={() => setMonth(shiftMonth(month, 1))}
          style={styles.arrow}
        >
          <Ionicons name="chevron-forward" size={22} color={c.forest} />
        </PressableScale>
      </View>
      {data.error ? (
        <View style={{ gap: 6 }}>
          <Text selectable variant="caption" style={{ color: c.danger }}>
            {data.error}
          </Text>
          <Button variant="text" label={t("Coba lagi", "Try again")} onPress={() => void data.reload()} />
        </View>
      ) : null}
      <MonthGrid month={month} today={today} selected={selected} marks={marksOf(deliveries)} locale={locale} onSelect={setSelected} />
      <View style={styles.legend}>
        <Legend id="lunch" icon="sunny" size={12} color={c.sunriseInk} label={t("Makan siang", "Lunch")} />
        <Legend id="dinner" icon="moon" size={11} color={c.forest} label={t("Makan malam", "Dinner")} />
        <Legend id="arrived" icon="sunny" size={12} color={c.muted} label={t("Sudah sampai", "Arrived")} />
      </View>
      <Text variant="label">{longDay(selected, locale)}</Text>
      {data.loading && !state ? (
        <ActivityIndicator color={c.forest} />
      ) : day.length ? (
        <Card style={{ padding: 4, gap: 0 }}>
          {day.map(({ d, m }, i) => (
            <MealRow key={`${d.id}:${m.meal}`} delivery={d} meal={m.meal} status={m.status} first={i === 0} apiBase={runtime.apiBase} />
          ))}
        </Card>
      ) : state ? (
        <Text style={{ color: c.muted }}>{t("Tidak ada pengantaran di hari ini.", "No delivery on this day.")}</Text>
      ) : null}
    </Screen>
  );
}

function Legend({ id, icon, size, color, label }: { id: string; icon: "sunny" | "moon"; size: number; color: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem} testID={`legend-${id}`}>
      <Ionicons name={icon} size={size} color={color} />
      <Text variant="caption">{label}</Text>
    </View>
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
      onPress={() => router.push(`/hari/${encodeURIComponent(d.id)}` as never)}
      style={[styles.meal, !first && styles.divider]}
    >
      {image ? (
        <Image source={{ uri: photoUri(image, apiBase) }} style={styles.photo} accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.photo} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fontFor("700") }} numberOfLines={1}>
          {d.offer.name}
        </Text>
        <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </PressableRow>
  );
}

const useStyles = themedStyles((c) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.canvas },
  monthBar: { flexDirection: "row", alignItems: "center" },
  arrow: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  meal: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 8 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  photo: { width: 56, height: 56, borderRadius: 10, backgroundColor: c.sage },
}));
