import { useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMobile } from "@catera/mobile-core";
import { longDay, monthOf, monthTitle, monthWeeks, shiftMonth, shortDate, WEEK_HEADER, type Locale } from "@catera/domain";
import { Button, Text } from "./components";
import { FormError } from "./FormError";
import { SheetBody, SheetHeader } from "./SheetHeader";
import { themedStyles, useColors } from "./theme";
import { useBusy } from "./useBusy";
import { useT } from "./useT";

export type CalendarReason = "Penuh" | "Terisi" | "Dapur libur" | "Lewat batas waktu";
export type CalendarDayState = { state: "available" | "current" | "unavailable"; reason?: CalendarReason };

export type CalendarSheetProps = {
  /** The month shown first, "YYYY-MM". */
  month: string;
  /** Every day the caller knows about, by "YYYY-MM-DD". A day missing here is unavailable with no stated reason. */
  days: Record<string, CalendarDayState>;
  /** The delivery day today: outlined, and not a new day. */
  current: string;
  onPick: (date: string) => void;
  /** The primary button once a new day is chosen, "Pindah ke {tanggal}". */
  confirmLabel: (date: string) => string;
  /** The move. A rejection stays on the sheet as a `FormError`. */
  onConfirm: (date: string) => Promise<void>;
  /** The first and last day that can be paged to. Paging stops at the months they sit in. */
  window: { from: string; to: string };
  /** Overrides the app's language; the sheet otherwise follows it. */
  locale?: Locale;
};

const REASON_EN: Record<CalendarReason, string> = {
  Penuh: "Full",
  Terisi: "Booked",
  "Dapur libur": "Kitchen closed",
  "Lewat batas waktu": "Past the cutoff",
};
/** 48dp controls; seven cells at the 44dp floor fit 360dp. */
const CELL_HEIGHT = 48;
const CELL_MIN_WIDTH = 44;
/** A month is always drawn as six weeks, so the sheet keeps one height while paging. */
const WEEKS = 6;
const clamp = (month: string, from: string, to: string) => (month < from ? from : month > to ? to : month);

/**
 * The calendar for changing a delivery day (spec 5.5), the body of a native large-detent sheet
 * (`sheetOptions({ detents: "large" })`). The current day is outlined; the chosen day takes a forest ring, a neutral
 * fill and a forest label (rule 3: selection is a small mark, never a block). An unavailable day is dimmed, and a tap
 * reads why in the caption under the grid. "Pindah ke {tanggal}" waits for a new day and shows `busy` while it runs.
 */
export function CalendarSheet({ month, days, current, onPick, confirmLabel, onConfirm, window, locale: forced }: CalendarSheetProps) {
  const c = useColors();
  const styles = useStyles();
  const t = useT();
  const mobile = useMobile() as { locale?: Locale } | null;
  const locale: Locale = forced ?? mobile?.locale ?? "id";
  const first = monthOf(window.from);
  const last = monthOf(window.to);
  const [shown, setShown] = useState(() => clamp(month, first, last));
  const [chosen, setChosen] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ message: string; key: number } | null>(null);
  const [busy, move] = useBusy(async (date: string) => {
    setFailure(null);
    try {
      await onConfirm(date);
    } catch (e) {
      setFailure((f) => ({
        message: e instanceof Error && e.message ? e.message : t("Belum bisa pindah tanggal. Coba lagi.", "Could not move the date. Try again."),
        key: (f?.key ?? 0) + 1,
      }));
    }
  });

  const weeks = monthWeeks(shown);
  while (weeks.length < WEEKS) weeks.push(Array<null>(7).fill(null));
  const reasonOf = (day: CalendarDayState | undefined) => (day?.reason ? (locale === "en" ? REASON_EN[day.reason] : day.reason) : null);
  const stateWord = (date: string, day: CalendarDayState | undefined) => {
    if (date === chosen) return t("dipilih", "chosen");
    if (day?.state === "current" || date === current) return t("hari pengantaran sekarang", "current delivery day");
    if (day?.state === "available") return t("tersedia", "available");
    const why = reasonOf(day);
    return why ? `${t("tidak tersedia", "unavailable")}, ${why}` : t("tidak tersedia", "unavailable");
  };

  const press = (date: string) => {
    const day = days[date];
    if (day?.state === "current" || date === current) {
      setCaption(t("Pengantaran sekarang jatuh di hari ini.", "Your delivery is on this day now."));
    } else if (day?.state === "available") {
      setChosen(date);
      setCaption(null);
      setFailure(null);
      onPick(date);
    } else {
      setCaption(`${shortDate(date, locale)}: ${reasonOf(day) ?? t("Tidak tersedia", "Not available")}`);
    }
  };

  return (
    <>
      <SheetHeader title={t("Pindah tanggal", "Move date")} />
      <SheetBody>
        <View style={styles.pager}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Bulan sebelumnya", "Previous month")}
            accessibilityState={{ disabled: shown <= first }}
            disabled={shown <= first}
            onPress={() => setShown(shiftMonth(shown, -1))}
            style={[styles.pagerButton, shown <= first && styles.dim]}
          >
            <Ionicons name="chevron-back" size={22} color={c.forest} />
          </Pressable>
          <Text testID="calendar-month" variant="heading" accessibilityRole="header" style={styles.monthTitle}>
            {monthTitle(shown, locale)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Bulan berikutnya", "Next month")}
            accessibilityState={{ disabled: shown >= last }}
            disabled={shown >= last}
            onPress={() => setShown(shiftMonth(shown, 1))}
            style={[styles.pagerButton, shown >= last && styles.dim]}
          >
            <Ionicons name="chevron-forward" size={22} color={c.forest} />
          </Pressable>
        </View>
        <View style={styles.weekRow} accessible={false} importantForAccessibility="no-hide-descendants">
          {WEEK_HEADER[locale].map((name) => (
            <Text key={name} style={styles.weekName}>
              {name}
            </Text>
          ))}
        </View>
        <View testID="calendar-grid" style={styles.grid}>
          {weeks.map((week, row) => (
            <View key={row} style={styles.weekRow}>
              {week.map((date, col) => {
                if (!date) return <View key={col} style={styles.empty} />;
                const day = days[date];
                const isCurrent = day?.state === "current" || date === current;
                const isChosen = date === chosen;
                const off = !isCurrent && day?.state !== "available";
                return (
                  <Pressable
                    key={col}
                    testID={`calendar-day-${date}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${shortDate(date, locale)}, ${stateWord(date, day)}`}
                    accessibilityState={{ selected: isChosen }}
                    onPress={() => press(date)}
                    style={[styles.cell, isCurrent && styles.current, isChosen && styles.chosen, off && styles.off]}
                  >
                    <Text testID={`calendar-num-${date}`} style={[styles.num, isChosen && styles.numChosen, isChosen && { color: c.forest }]}>
                      {Number(date.slice(8))}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <View testID="calendar-caption" accessibilityLiveRegion="polite">
          <Text selectable style={styles.caption}>
            {caption ?? (chosen ? longDay(chosen, locale) : t("Pilih hari baru untuk pengantaranmu.", "Choose a new day for your delivery."))}
          </Text>
        </View>
        {failure ? (
          <FormError message={failure.message} failureKey={failure.key} retry={chosen ? () => void move(chosen) : undefined} />
        ) : null}
        <Button
          label={chosen ? confirmLabel(chosen) : t("Pindah tanggal", "Move date")}
          disabled={!chosen}
          busy={busy}
          onPress={() => chosen && void move(chosen)}
        />
      </SheetBody>
    </>
  );
}

const useStyles = themedStyles((c) => ({
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pagerButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.35 },
  monthTitle: { flex: 1, textAlign: "center" },
  weekRow: { flexDirection: "row", gap: 2 },
  weekName: { flex: 1, minWidth: CELL_MIN_WIDTH, textAlign: "center", fontSize: 12, lineHeight: 16, color: c.muted },
  grid: { gap: 2 },
  empty: { flex: 1, minWidth: CELL_MIN_WIDTH, height: CELL_HEIGHT },
  cell: {
    flex: 1,
    minWidth: CELL_MIN_WIDTH,
    height: CELL_HEIGHT,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  current: { borderWidth: 1.5, borderColor: c.forest },
  chosen: { borderWidth: 2, borderColor: c.forest, backgroundColor: c.line },
  off: { opacity: 0.45 },
  num: { fontSize: 16, lineHeight: 22, color: c.charcoal, fontVariant: ["tabular-nums"] },
  numChosen: { fontWeight: "700" },
  caption: { color: c.muted, fontSize: 14, lineHeight: 20, minHeight: 20 },
}));
