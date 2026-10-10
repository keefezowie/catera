import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { UpcomingDay } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { fonts, PhotoRing, PressableRow, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { dayHref } from "../hrefs";
import { photoUri } from "./Plate";
import { SectionTitle } from "./WaitingList";

/**
 * "Berikutnya": the next days that have a delivery, each under one label with its count ("Senin 12 Okt", "3 antaran"),
 * then one row per meal and plan: the photo ring (sunrise ink for lunch, forest for dinner), the dish or "Menu belum
 * ditentukan", and "Siang · {paket} · {katerer}". A row opens that day.
 */
export function UpcomingDays({ days, apiBase }: { days: UpcomingDay[]; apiBase: string }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  if (!days.length) return null;
  return (
    <View testID="upcoming-days" style={{ gap: 10 }}>
      <SectionTitle>{t("Berikutnya", "Coming up")}</SectionTitle>
      {days.map((day) => {
        const n = day.meals.length;
        return (
          <View key={day.date}>
            <View style={styles.dayRow}>
              <Text testID="upcoming-day-label" style={styles.dayLabel}>
                {day.label}
              </Text>
              <Text testID="upcoming-day-count" variant="caption" style={styles.count}>
                {t(`${n} antaran`, n === 1 ? "1 delivery" : `${n} deliveries`)}
              </Text>
            </View>
            {day.meals.map((m, i) => {
              const dish = m.lead ?? t("Menu belum ditentukan", "Menu not set yet");
              const meal = m.meal === "dinner" ? t("Malam", "Dinner") : t("Siang", "Lunch");
              const line = [meal, m.packageName, m.catererName].filter(Boolean).join(" · ");
              return (
                <PressableRow
                  key={`${m.deliveryId}:${m.meal}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.label}, ${dish}, ${line}`}
                  onPress={() => router.push(dayHref(m.deliveryId, day.date, locale) as never)}
                  style={[styles.row, i > 0 && styles.divider]}
                >
                  {/* The row is the button and speaks for the ring. */}
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <PhotoRing
                      uri={m.image ? photoUri(m.image, apiBase) : ""}
                      size={40}
                      ring={m.meal === "dinner" ? "forest" : "sunrise"}
                      accessibilityLabel={dish}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={m.lead ? styles.dish : styles.unset}>{dish}</Text>
                    <Text variant="caption" style={styles.line}>
                      {line}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.muted} />
                </PressableRow>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  dayRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  dayLabel: { flexShrink: 1, fontSize: 13, lineHeight: 18, fontFamily: fonts.bold, color: c.forest },
  count: { fontSize: 12, lineHeight: 16, color: c.muted, fontVariant: ["tabular-nums"] },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  dish: { fontSize: 14, lineHeight: 20, fontFamily: fonts.bold, color: c.charcoal },
  // A menu not set yet is said plainly, never as a dish name.
  unset: { fontSize: 14, lineHeight: 20, fontFamily: fonts.semibold, color: c.muted },
  line: { fontSize: 12, lineHeight: 16 },
}));
