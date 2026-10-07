import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import type { Locale } from "@catera/domain";
import { colors, FONT } from "@catera/mobile-ui";
import { longDay, monthWeeks, WEEK_HEADER } from "./dates";

/** Forest = planned, this grey-green = arrived. */
export const ARRIVED_DOT = "#8AA399";
export type DayMark = "planned" | "arrived";

type Props = {
  month: string;
  today: string;
  selected: string;
  marks: ReadonlyMap<string, DayMark>;
  locale: Locale;
  onSelect: (date: string) => void;
};

/** One month, Monday first. Each day is a 44pt+ button with a dot under its number. */
export function MonthGrid({ month, today, selected, marks, locale, onSelect }: Props) {
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.week}>
        {WEEK_HEADER[locale].map((name) => (
          <RNText key={name} style={styles.header}>
            {name}
          </RNText>
        ))}
      </View>
      {monthWeeks(month).map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((date, col) => {
            if (!date) return <View key={col} style={styles.cell} />;
            const on = date === selected;
            const mark = marks.get(date);
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={longDay(date, locale)}
                accessibilityState={{ selected: on }}
                onPress={() => onSelect(date)}
                style={[styles.cell, styles.day, date === today && styles.today, on && styles.selected]}
              >
                <RNText style={[styles.number, { color: on ? colors.cream : colors.charcoal }]}>
                  {Number(date.slice(8))}
                </RNText>
                <View
                  style={[
                    styles.dot,
                    mark && {
                      backgroundColor: mark === "arrived" ? ARRIVED_DOT : on ? colors.cream : colors.forest,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: "row" },
  header: {
    flex: 1,
    textAlign: "center",
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    paddingVertical: 6,
  },
  cell: { flex: 1, minHeight: 48 },
  day: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  today: { borderColor: colors.sunrise, backgroundColor: colors.cream },
  selected: { backgroundColor: colors.forest, borderColor: colors.forest },
  number: { fontFamily: FONT, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "transparent" },
});
