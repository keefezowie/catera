import { StyleSheet, Text as RNText, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Locale } from "@catera/domain";
import { colors, fontFor, PressableRow } from "@catera/mobile-ui";
import { longDay, monthWeeks, WEEK_HEADER } from "./dates";

/** Which meals a day covers; `done` once every meal it serves has arrived. */
export type DayMark = { lunch: boolean; dinner: boolean; done: boolean };

type Props = {
  month: string;
  today: string;
  selected: string;
  marks: ReadonlyMap<string, DayMark>;
  locale: Locale;
  onSelect: (date: string) => void;
};

/** "Jumat 9 Oktober, makan siang dan malam, sudah sampai": the day, what it covers, whether it came. */
function dayLabel(date: string, locale: Locale, mark: DayMark | undefined): string {
  const day = longDay(date, locale);
  if (!mark || (!mark.lunch && !mark.dinner)) return day;
  const en = locale === "en";
  const meals =
    mark.lunch && mark.dinner
      ? en ? "lunch and dinner" : "makan siang dan malam"
      : mark.lunch
        ? en ? "lunch" : "makan siang"
        : en ? "dinner" : "makan malam";
  return [day, meals, mark.done ? (en ? "arrived" : "sudah sampai") : null].filter(Boolean).join(", ");
}

/**
 * One month, Monday first. Each day is a 48dp button. A covered day gets the scheduled background and a
 * sun (lunch) and/or moon (dinner) under its number; the icons go muted once the meals have arrived.
 */
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
            const covered = !!mark && (mark.lunch || mark.dinner);
            const ink = on ? colors.cream : mark?.done ? colors.muted : null;
            return (
              <PressableRow
                key={date}
                accessibilityRole="button"
                accessibilityLabel={dayLabel(date, locale, mark)}
                accessibilityState={{ selected: on }}
                onPress={() => onSelect(date)}
                style={[
                  styles.cell,
                  styles.day,
                  covered && styles.covered,
                  date === today && (covered ? styles.todayRing : styles.today),
                  on && styles.selected,
                ]}
              >
                <RNText style={[styles.number, { color: on ? colors.cream : colors.charcoal }]}>
                  {Number(date.slice(8))}
                </RNText>
                <View style={styles.marks}>
                  {mark?.lunch ? <Ionicons name="sunny" size={12} color={ink ?? colors.sunriseInk} /> : null}
                  {mark?.dinner ? <Ionicons name="moon" size={11} color={ink ?? colors.forest} /> : null}
                </View>
              </PressableRow>
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
    fontFamily: fontFor("700"),
    fontSize: 12,
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
  covered: { backgroundColor: colors.scheduled },
  today: { borderColor: colors.sunriseInk, backgroundColor: colors.cream },
  todayRing: { borderColor: colors.sunriseInk },
  selected: { backgroundColor: colors.forest, borderColor: colors.forest },
  number: { fontSize: 15, fontFamily: fontFor("700"), fontVariant: ["tabular-nums"] },
  marks: { height: 12, flexDirection: "row", alignItems: "center", gap: 3 },
});
