import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { jakartaDay, mealLabel, type CustomerActionItem } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";
import { colors, fontFor, PressableRow, Text } from "@catera/mobile-ui";
import { customerLink } from "../links";
import { longDay, weekdayName } from "../schedule/dates";
import { jakartaClock } from "./Plate";

/** "Pilih menu Senin": one row per delivery whose menu the customer still has to choose. */
export function MenuDueRows({ items }: { items: CustomerActionItem[] }) {
  const { t, locale } = useMobile();
  const due = items.filter((i) => i.kind === "menu_choice_due" && i.status === "selection_due" && i.serviceDate);
  if (!due.length) return null;
  return (
    <View>
      {due.slice(0, 3).map((item, i) => (
        <PressableRow
          key={item.id}
          accessibilityRole="button"
          onPress={() => router.push(customerLink(item.href) as never)}
          style={[styles.row, i > 0 && styles.divider]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fontFor("700") }}>
              {t(`Pilih menu ${weekdayName(item.serviceDate!, "id")}`, `Choose the menu for ${weekdayName(item.serviceDate!, "en")}`)}
            </Text>
            <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>
              {[
                item.packageName,
                item.meal ? mealLabel(item.meal, locale) : "",
                item.dueAt
                  ? `${t("sebelum", "before")} ${longDay(jakartaDay(new Date(item.dueAt)), locale)} ${jakartaClock(item.dueAt)}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </PressableRow>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
});
