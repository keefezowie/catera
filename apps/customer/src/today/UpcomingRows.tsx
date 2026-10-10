import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { dayLabel, jakartaDay, mealLabel, type UpcomingRow } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { fontFor, PressableRow, Text, themedStyles, useColors } from "@catera/mobile-ui";
import { dayHref } from "../hrefs";

/** The days after today as plain rows (not cards), each with its change deadline. */
export function UpcomingRows({ rows }: { rows: UpcomingRow[] }) {
  const { t, locale } = useMobile();
  const c = useColors();
  const styles = useStyles();
  if (!rows.length) return null;
  const today = jakartaDay(new Date());
  return (
    <View>
      <Text variant="label" style={{ marginBottom: 4 }}>
        {t("Berikutnya", "Coming up")}
      </Text>
      {rows.map((row, i) => (
        <PressableRow
          key={row.deliveryId}
          accessibilityRole="button"
          onPress={() => router.push(dayHref(row.deliveryId, row.date, locale) as never)}
          style={[styles.row, i > 0 && styles.divider]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fontFor("700") }}>{locale === "id" ? row.label : dayLabel(row.date, today, "en")}</Text>
            <Text variant="caption" numberOfLines={1}>
              {row.packageName} · {mealLabel(row.meal, locale)}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {row.dishes || t("Menu belum ditentukan", "Menu not set yet")}
            </Text>
            {row.changeUntil ? (
              <Text variant="caption" style={{ color: c.forest, fontVariant: ["tabular-nums"] }}>
                {t(`Bisa diubah sampai ${row.changeUntil}`, `Can be changed until ${row.changeUntil}`)}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        </PressableRow>
      ))}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
}));
