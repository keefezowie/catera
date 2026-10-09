import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
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
  Button,
  Card,
  fontFor,
  MoodHeader,
  PressableRow,
  PressableScale,
  Screen,
  Text,
  themedStyles,
  useColors,
  useMoodColors,
} from "@catera/mobile-ui";
import { SignInFirst } from "../account/SignInFirst";
import { photoUri } from "../today/Plate";
import { CalendarLegend, MonthGrid } from "./MonthGrid";
import { longDay, monthOf, monthRange, monthTitle, shiftMonth } from "./dates";

const live = (d: Delivery) => d.status !== "cancelled";
const served = (d: Delivery) => (d.meals ?? []).filter((m) => m.status !== "cancelled");
/** The caterer marked the meal "Gagal diantar": it did not come and is not coming. */
const failed = (status: string) => status === "issue";

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

  useEffect(() => {
    setSelected(monthOf(today) === month ? today : `${month}-01`);
  }, [month]);

  const deliveries = useMemo(() => state?.deliveries.filter((d) => monthOf(d.service_date) === month) ?? [], [state, month]);
  const days = useMemo(() => calendarDays(deliveries), [deliveries]);
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
        <MoodHeader testID="jadwal-header" meta={t("Jadwal", "Schedule")} title={monthTitle(month, locale)} trailing={chevrons}>
          {state ? (
            <>
              <MonthGrid
                month={month}
                today={today}
                selected={selected}
                days={days}
                apiBase={runtime.apiBase}
                locale={locale}
                onSelect={setSelected}
              />
              <CalendarLegend
                labels={{
                  photo: t("Foto menu", "Menu photo"),
                  unset: t("Menu belum diisi", "Menu not set"),
                  dinner: t("Ada makan malam", "Dinner too"),
                }}
              />
            </>
          ) : data.error ? (
            // Nothing is known about this month yet, so the header says that instead of drawing it as empty.
            <View style={{ gap: 4 }}>
              <Text selectable style={{ color: mood.headerText }}>
                {data.error}
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t("Coba lagi", "Try again")}
                onPress={() => void data.reload()}
                style={{ minHeight: 48, alignSelf: "flex-start", justifyContent: "center" }}
              >
                <Text variant="label" style={{ color: mood.headerText, textDecorationLine: "underline" }}>
                  {t("Coba lagi", "Try again")}
                </Text>
              </PressableScale>
            </View>
          ) : (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 }}>
              <ActivityIndicator color={mood.headerText} />
              <Text style={{ color: mood.headerMeta }}>{t("Memuat…", "Loading…")}</Text>
            </View>
          )}
        </MoodHeader>
      }
    >
      {state ? (
        <>
          {data.error ? (
            // A refresh failed but the month is on screen: the error stays with its retry in the page.
            <View style={{ gap: 6 }}>
              <Text selectable variant="caption" style={{ color: c.danger }}>
                {data.error}
              </Text>
              <Button variant="text" label={t("Coba lagi", "Try again")} onPress={() => void data.reload()} />
            </View>
          ) : null}
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
  meal: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 8 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  photo: { width: 56, height: 56, borderRadius: 10, backgroundColor: c.sage },
}));
