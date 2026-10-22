import type { ReactNode } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import type { CalendarDay, Locale } from "@catera/domain";
import { fontFor, PressableScale, Text, useMoodColors, useScreenMargin } from "@catera/mobile-ui";
import { longDay, monthWeeks, WEEK_HEADER } from "./dates";

type Props = {
  month: string;
  today: string;
  selected: string;
  days: ReadonlyMap<string, CalendarDay>;
  locale: Locale;
  onSelect: (date: string) => void;
};

/** A day cell is 40 tall (spec 3.2) and shares its row down to this floor, so seven of them fit a 360dp screen. */
export const MONTH_CELL = 40;
const CELL_MIN_WIDTH = 44;
/** The weekday row's least height; the names are `meta`, so it grows with them. */
export const WEEKDAY_ROW = 20;
/** The selected day's filled circle, and the ring that marks today. It holds the number and the dot below it. */
export const DAY_CIRCLE = 32;
/** The delivery dot and the unset ring, and the legend's swatches. */
export const DOT = 6;
const TODAY_RING = 2;
const UNSET_RING = 1.5;
/** The number's 15/500, capped so number, gap and dot (20 + 2 + 6) stay inside the 32 circle. */
const NUMBER_MAX_SCALE = 1.3;
/** A month that could not be read keeps room for its mascot, message and retry, whatever weeks the month has. */
const ERROR_ROWS = 6;
/** `MoodHeader` pads its content by this much on each side. */
const HEADER_PADDING = 20;

/**
 * How far the grid pulls out of the header's padding so its days sit one screen margin (16 under `v2`) from the screen
 * edge, in line with the agenda below. It is 0 where the margin is the header's own 20.
 */
export function useGridBleed(): number {
  return -(HEADER_PADDING - useScreenMargin());
}

/** The meals a day covers, lunch first. */
const covered = (day: CalendarDay | undefined) => [day?.lunch, day?.dinner].filter((m) => m != null);

/**
 * "Jumat 9 Oktober, makan siang dan makan malam, menu belum diisi, sudah sampai, hari ini": the day, what it covers,
 * then only the states that hold, so a screen reader hears what the dot and the ring show. Selection is not in the
 * words: the cell's `selected` accessibility state says it, and saying it twice would be read twice.
 */
function dayLabel(date: string, locale: Locale, day: CalendarDay | undefined, today: boolean): string {
  const en = locale === "en";
  const meals = covered(day);
  const parts = [longDay(date, locale)];
  if (day?.lunch && day.dinner) parts.push(en ? "lunch and dinner" : "makan siang dan makan malam");
  else if (day?.lunch) parts.push(en ? "lunch" : "makan siang");
  else if (day?.dinner) parts.push(en ? "dinner" : "makan malam");
  if (meals.some((m) => !m.menuSet)) parts.push(en ? "menu not set" : "menu belum diisi");
  if (meals.length && meals.every((m) => m.delivered)) parts.push(en ? "arrived" : "sudah sampai");
  if (today) parts.push(en ? "today" : "hari ini");
  return parts.join(", ");
}

/**
 * One month, Monday first, drawn on the mood header: only the weeks the month needs (5 or 6, or 4). A day is its
 * number in a 32 circle: filled forest when selected (the number then in the card colour), ringed in forest when it is
 * today. A delivery day carries a 6 dot under the number (muted once it is past); a day whose menu is not set carries
 * a 6 ring of the same size instead. Everything reads the mood palette because the grid sits on the header.
 */
export function MonthGrid({ month, today, selected, days, locale, onSelect }: Props) {
  const weeks = monthWeeks(month);
  return (
    <Frame testID="month-grid" locale={locale}>
      {weeks.map((week, row) => (
        <View key={row} testID="month-week" style={weekRow}>
          {week.map((date, col) => {
            if (!date) return <View key={col} style={slot} />;
            const day = days.get(date);
            const meals = covered(day);
            const isToday = date === today;
            return (
              <DayCell
                key={date}
                day={Number(date.slice(8))}
                delivery={meals.length > 0}
                menuSet={meals.every((m) => m.menuSet)}
                past={date < today}
                today={isToday}
                selected={date === selected}
                onPress={() => onSelect(date)}
                accessibilityLabel={dayLabel(date, locale, day, isToday)}
              />
            );
          })}
        </View>
      ))}
    </Frame>
  );
}

function DayCell({
  day,
  delivery,
  menuSet,
  past,
  today,
  selected,
  onPress,
  accessibilityLabel,
}: {
  day: number;
  delivery: boolean;
  menuSet: boolean;
  past: boolean;
  today: boolean;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const mood = useMoodColors();
  // The dot sits inside the circle, so on the selected fill it takes the number's own colour.
  const ink = selected ? mood.onToggleActive : mood.headerText;
  const dot = selected ? mood.onToggleActive : past ? mood.markerIdle : mood.headerMeta;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      // The cell is 40 tall by spec; the slop lifts its target to 44 without moving the rows.
      hitSlop={{ top: 2, bottom: 2 }}
      style={[slot, { minWidth: CELL_MIN_WIDTH }]}
    >
      <View
        testID="cell-circle"
        style={{
          width: DAY_CIRCLE,
          height: DAY_CIRCLE,
          borderRadius: DAY_CIRCLE / 2,
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          ...(selected ? { backgroundColor: mood.toggleActive } : null),
          ...(today ? { borderWidth: TODAY_RING, borderColor: mood.todayRing } : null),
        }}
      >
        <RNText
          testID="cell-number"
          maxFontSizeMultiplier={NUMBER_MAX_SCALE}
          style={{ color: ink, fontFamily: fontFor("500"), fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] }}
        >
          {String(day)}
        </RNText>
        {/* The slot is always there, so a day without a dot keeps its number on the same line as its neighbours. */}
        <View style={{ height: DOT, justifyContent: "center" }}>
          {delivery && menuSet ? (
            <View testID="cell-dot" style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: dot }} />
          ) : null}
          {delivery && !menuSet ? (
            <View
              testID="cell-unset-ring"
              style={{
                width: DOT,
                height: DOT,
                borderRadius: DOT / 2,
                borderWidth: UNSET_RING,
                borderColor: selected ? mood.onToggleActive : mood.markerIdle,
              }}
            />
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * The grid with no month in it, for while the month loads or when it could not be read: the weekday names and the
 * month's own week rows at the loaded grid's height, with `children` (the error and its retry) centred over the rows.
 * The rows carry no day numbers, because a bare number is how the grid draws a day without a meal, and nothing is known
 * about these days yet. While a month loads, `cell` places a placeholder (the skeleton) in each of the month's day
 * slots, where the loaded grid draws its cells. With `children` the rows grow to `ERROR_ROWS` so the message fits.
 */
export function MonthFrame({
  month,
  locale,
  children,
  cell,
}: {
  month: string;
  locale: Locale;
  children?: ReactNode;
  cell?: (date: string) => ReactNode;
}) {
  const weeks = monthWeeks(month);
  return (
    <Frame testID="month-frame" locale={locale} minRowsHeight={children ? ERROR_ROWS * MONTH_CELL : undefined}>
      {weeks.map((week, row) => (
        <View key={row} testID="month-week" style={weekRow}>
          {cell
            ? week.map((date, col) => (
                <View key={col} style={[slot, { minWidth: CELL_MIN_WIDTH }]}>
                  {date ? cell(date) : null}
                </View>
              ))
            : null}
        </View>
      ))}
      {children ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }]}>
          {children}
        </View>
      ) : null}
    </Frame>
  );
}

const slot = { flex: 1, minWidth: CELL_MIN_WIDTH, height: MONTH_CELL, alignItems: "center", justifyContent: "center" } as const;
const weekRow = { flexDirection: "row", height: MONTH_CELL } as const;

/**
 * What the loaded grid and the empty frame share, so the two are the same height by construction: the weekday names,
 * then the week rows (and whatever is laid over them) in one column.
 */
function Frame({
  testID,
  locale,
  children,
  minRowsHeight,
}: {
  testID: string;
  locale: Locale;
  children: ReactNode;
  minRowsHeight?: number;
}) {
  const mood = useMoodColors();
  const bleed = useGridBleed();
  return (
    <View testID={testID} style={{ marginHorizontal: bleed }}>
      <View testID="month-weekdays" style={{ minHeight: WEEKDAY_ROW, flexDirection: "row", alignItems: "center" }}>
        {WEEK_HEADER[locale].map((name) => (
          <View key={name} style={{ flex: 1, minWidth: CELL_MIN_WIDTH, alignItems: "center" }}>
            <Text variant="meta" style={{ color: mood.headerMeta }}>
              {name}
            </Text>
          </View>
        ))}
      </View>
      <View testID="month-weeks" style={minRowsHeight ? { minHeight: minRowsHeight } : undefined}>
        {children}
      </View>
    </View>
  );
}

/**
 * What the cells show: a 6 dot for a delivery day and a 6 ring for a menu not set yet, in `meta`. Sits on the header,
 * so the swatches read the same mood tokens as the cells they explain.
 */
export function CalendarLegend({ labels }: { labels: { delivery: string; unset: string } }) {
  const mood = useMoodColors();
  const item = { flexDirection: "row", alignItems: "center", gap: 8 } as const;
  const label = { color: mood.headerMeta } as const;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 8 }}>
      <View testID="legend-delivery" style={item}>
        <View
          testID="legend-delivery-swatch"
          style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: mood.headerMeta }}
        />
        <Text variant="meta" style={label}>
          {labels.delivery}
        </Text>
      </View>
      <View testID="legend-unset" style={item}>
        <View
          testID="legend-unset-swatch"
          style={{ width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: UNSET_RING, borderColor: mood.markerIdle }}
        />
        <Text variant="meta" style={label}>
          {labels.unset}
        </Text>
      </View>
    </View>
  );
}
