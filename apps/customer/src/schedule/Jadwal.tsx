import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { jakartaDay, mealLabel, type CustomerState, type Delivery } from "@catera/domain";
import { useData, useMobile } from "@catera/mobile-core";
import { Button, Card, colors, Screen, Text } from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { photoUri } from "../today/Plate";
import { ARRIVED_DOT, MonthGrid, type DayMark } from "./MonthGrid";
import { longDay, monthOf, monthRange, monthTitle, shiftMonth } from "./dates";

const live = (d: Delivery) => d.status !== "cancelled";
const served = (d: Delivery) => d.meals.filter((m) => m.status !== "cancelled");

/** Forest dot for a day with meals still to come, grey-green once every meal has arrived. */
function marksOf(deliveries: Delivery[]): Map<string, DayMark> {
  const marks = new Map<string, DayMark>();
  for (const d of deliveries.filter(live)) {
    const meals = served(d);
    if (!meals.length) continue;
    if (meals.some((m) => m.status !== "delivered")) marks.set(d.service_date, "planned");
    else if (!marks.has(d.service_date)) marks.set(d.service_date, "arrived");
  }
  return marks;
}

/** Jadwal: the month at a glance and the meals of the day you tap. */
export function Jadwal() {
  const { actor, ready, t } = useMobile();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  if (!actor) return <SignInFirst title={t("Jadwal", "Schedule")} next="/jadwal" />;
  return <SignedInJadwal />;
}

function SignedInJadwal() {
  const { runtime, t, locale } = useMobile();
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
  const day = deliveries.filter((d) => d.service_date === selected && live(d));

  return (
    <Screen>
      <Text variant="title">{t("Jadwal", "Schedule")}</Text>
      <View style={styles.monthBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Bulan sebelumnya", "Previous month")}
          onPress={() => setMonth(shiftMonth(month, -1))}
          style={styles.arrow}
        >
          <Ionicons name="chevron-back" size={22} color={colors.forest} />
        </Pressable>
        <Text variant="heading" style={{ flex: 1, textAlign: "center", fontSize: 18 }}>
          {monthTitle(month, locale)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Bulan berikutnya", "Next month")}
          onPress={() => setMonth(shiftMonth(month, 1))}
          style={styles.arrow}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.forest} />
        </Pressable>
      </View>
      {data.error ? (
        <View style={{ gap: 6 }}>
          <Text variant="caption" style={{ color: colors.danger }}>
            {data.error}
          </Text>
          <Button variant="text" label={t("Coba lagi", "Try again")} onPress={() => void data.reload()} />
        </View>
      ) : null}
      <MonthGrid month={month} today={today} selected={selected} marks={marksOf(deliveries)} locale={locale} onSelect={setSelected} />
      <View style={styles.legend}>
        <Legend color={colors.forest} label={t("Diantar", "Delivery")} />
        <Legend color={ARRIVED_DOT} label={t("Sudah sampai", "Arrived")} />
      </View>
      <Text variant="label">{longDay(selected, locale)}</Text>
      {data.loading && !state ? (
        <ActivityIndicator color={colors.forest} />
      ) : day.length ? (
        <Card style={{ padding: 4, gap: 0 }}>
          {day.flatMap((d) => served(d).map((m) => ({ d, m }))).map(({ d, m }, i) => (
            <MealRow key={`${d.id}:${m.meal}`} delivery={d} meal={m.meal} arrived={m.status === "delivered"} first={i === 0} apiBase={runtime.apiBase} />
          ))}
        </Card>
      ) : state ? (
        <Text style={{ color: colors.muted }}>{t("Tidak ada pengantaran di hari ini.", "No delivery on this day.")}</Text>
      ) : null}
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text variant="caption">{label}</Text>
    </View>
  );
}

function MealRow({
  delivery: d,
  meal,
  arrived,
  first,
  apiBase,
}: {
  delivery: Delivery;
  meal: "lunch" | "dinner";
  arrived: boolean;
  first: boolean;
  apiBase: string;
}) {
  const { t, locale } = useMobile();
  const image = d.offer.menus?.find((m) => m.meal === meal)?.image || d.offer.image;
  const sub = [mealLabel(meal, locale), d.offer.windows?.[meal], arrived ? t("Sudah sampai", "Arrived") : ""].filter(Boolean).join(" · ");
  return (
    <Pressable
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
        <Text style={{ fontWeight: "700" }} numberOfLines={1}>
          {d.offer.name}
        </Text>
        <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  monthBar: { flexDirection: "row", alignItems: "center" },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  legend: { flexDirection: "row", gap: 18 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  meal: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 8 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  photo: { width: 56, height: 56, borderRadius: 10, backgroundColor: colors.sage },
});
