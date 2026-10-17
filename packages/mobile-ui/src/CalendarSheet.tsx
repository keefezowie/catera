import { useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { translator, useMobile } from "@catera/mobile-core";
import { longDay, monthOf, monthTitle, monthWeeks, shiftMonth, shortDate, WEEK_HEADER, type Locale } from "@catera/domain";
import { Button, Text } from "./components";
import { FormError } from "./FormError";
import { SheetBody, SheetHeader, sheetSidePadding } from "./SheetHeader";
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
  /** Overrides the app's language for the dates and the sheet's own words; the sheet otherwise follows the app. */
  locale?: Locale;
  /** The platform the grid is measured for; defaults to the running one. */
  os?: string;
};

const REASON_EN: Record<CalendarReason, string> = {
  Penuh: "Full",
  Terisi: "Booked",
  "Dapur libur": "Kitchen closed",
  "Lewat batas waktu": "Past the cutoff",
};
const CELL_HEIGHT = 48;
/**
 * The grid and the weekday row bleed into the sheet's side padding, leaving an 8dp gutter, and keep no gap between
 * cells: seven cells then reach 48dp wide at 360dp (344 / 7 = 49) on both platforms.
 */
const GUTTER = 8;
const bleed = (os?: string) => GUTTER - sheetSidePadding(os);
/** The width of one day cell on a screen `screen` dp wide. */
export const calendarCellWidth = (screen: number, os = process.env.EXPO_OS) =>
  (screen - 2 * sheetSidePadding(os) - 2 * bleed(os)) / 7;
/** A month is always drawn as six weeks, so the sheet keeps one height while paging. */
const WEEKS = 6;
const clamp = (month: string, from: string, to: string) => (month < from ? from : month > to ? to : month);

/**
 * The calendar for changing a delivery day (spec 5.5), the body of a native large-detent sheet
 * (`sheetOptions({ detents: "large" })`). The current day is outlined; the chosen day takes a forest ring, a neutral
 * fill and a forest label (rule 3: selection is a small mark, never a block). An unavailable day is muted and struck
 * through, and a tap reads why in the caption under the grid. "Pindah ke {tanggal}" waits for a new day and shows `busy` while it runs.
 */
export function CalendarSheet(props: CalendarSheetProps) {
  const t = useT();
  return (
    <>
      <SheetHeader title={props.locale ? translator(props.locale)("Pindah tanggal", "Move date") : t("Pindah tanggal", "Move date")} />
      <SheetBody>
        <CalendarPanel {...props} />
      </SheetBody>
    </>
  );
}

/**
 * The calendar without its own sheet frame: the month pager, the grid, the caption and "Pindah ke {tanggal}". A sheet
 * that already has a header and a body (Ubah hari, which keeps its day title and the side switch) puts this inside its
 * body; `CalendarSheet` is the same panel under its own "Pindah tanggal" header.
 */
export function CalendarPanel({ month, days, current, onPick, confirmLabel, onConfirm, window, locale: forced, os = process.env.EXPO_OS }: CalendarSheetProps) {
  const c = useColors();
  const styles = useStyles();
  const appT = useT();
  const t = forced ? translator(forced) : appT;
  const mobile = useMobile() as { locale?: Locale } | null;
  const locale: Locale = forced ?? mobile?.locale ?? "id";
  const rowBleed = { marginHorizontal: bleed(os) };
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

  /** No day inside the window can be picked: the caption says so before anyone taps. */
  const noneOpen = !Object.entries(days).some(
    ([date, day]) => day.state === "available" && date !== current && date >= window.from && date <= window.to,
  );
  const prompt = noneOpen
    ? t("Belum ada hari lain yang bisa kamu pilih di rentang ini.", "There is no other day you can pick in this range.")
    : t("Pilih hari baru untuk pengantaranmu.", "Choose a new day for your delivery.");

  const press = (date: string) => {
    if (busy) return;
    const day = days[date];
    if (day?.state === "current" || date === current) {
      setCaption(t("Ini hari pengantaranmu sekarang.", "This is your delivery day now."));
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
      <View style={styles.pager}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Bulan sebelumnya", "Previous month")}
          accessibilityState={{ disabled: shown <= first }}
          disabled={shown <= first}
          onPress={() => setShown(shiftMonth(shown, -1))}
          style={[styles.pagerButton, shown <= first && styles.dim]}
        >
          <Ionicons name="chevron-back" size={22} color={c.charcoal} />
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
          <Ionicons name="chevron-forward" size={22} color={c.charcoal} />
        </Pressable>
      </View>
      <View
        testID="calendar-weekdays"
        style={[styles.weekRow, rowBleed]}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {WEEK_HEADER[locale].map((name) => (
          <Text key={name} style={styles.weekName}>
            {name}
          </Text>
        ))}
      </View>
      <View testID="calendar-grid" style={styles.grid}>
        {weeks.map((week, row) => (
          <View key={row} testID={`calendar-week-${row}`} style={[styles.weekRow, rowBleed]}>
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
                  accessibilityState={{ selected: isChosen, disabled: busy }}
                  disabled={busy}
                  onPress={() => press(date)}
                  style={[styles.cell, isCurrent && styles.current, isChosen && styles.chosen]}
                >
                  <Text
                    testID={`calendar-num-${date}`}
                    style={[styles.num, off && styles.numOff, isChosen && styles.numChosen]}
                  >
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
          {caption ?? (chosen ? longDay(chosen, locale) : prompt)}
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
    </>
  );
}

const useStyles = themedStyles((c) => ({
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pagerButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.35 },
  monthTitle: { flex: 1, textAlign: "center" },
  weekRow: { flexDirection: "row" },
  weekName: { flex: 1, textAlign: "center", fontSize: 12, lineHeight: 16, color: c.muted },
  grid: {},
  empty: { flex: 1, height: CELL_HEIGHT },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  current: { borderWidth: 1.5, borderColor: c.forest },
  chosen: { borderWidth: 2, borderColor: c.forest, backgroundColor: c.line },
  num: { fontSize: 16, lineHeight: 22, color: c.charcoal, fontVariant: ["tabular-nums"] },
  /** Unavailable: muted (4.5:1 on the sheet surface) and struck through, so the state never rests on colour alone. */
  numOff: { color: c.muted, textDecorationLine: "line-through" },
  numChosen: { fontWeight: "700", color: c.forest }, // forest: selection (the chosen date)
  caption: { color: c.muted, fontSize: 14, lineHeight: 20, minHeight: 20 },
}));
