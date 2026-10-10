import type { ReactNode } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { CalendarDay, Locale } from "@catera/domain";
import { CalendarPhotoCell, fontFor, Text, useMoodColors } from "@catera/mobile-ui";
import { photoUri } from "../today/Plate";
import { longDay, monthWeeks, WEEK_HEADER } from "./dates";

type Props = {
  month: string;
  today: string;
  selected: string;
  days: ReadonlyMap<string, CalendarDay>;
  /** Where relative photo paths resolve. */
  apiBase: string;
  locale: Locale;
  onSelect: (date: string) => void;
};

/**
 * A cell shares its row down to this floor, so seven of them fit a 360dp screen. At 7 x 48dp plus gaps and margins they
 * would not.
 */
const CELL_MIN_WIDTH = 44;
const GAP = 2;
/**
 * The header pads its content by 20dp; the grid pulls out by this much so the days sit 12dp from the screen edge,
 * which is what lets seven cells at the floor width fit 360dp.
 */
const BLEED = -8;
/** CalendarPhotoCell is always 52dp tall, so a week row is too, with or without days in it. */
const CELL_HEIGHT = 52;
/**
 * Every month is drawn as six weeks, the most a month can span. A four- or five-week month gets empty rows at the end,
 * so the header keeps one height from month to month and while a month loads.
 */
const WEEKS = 6;

/** The meals a day covers, lunch first. */
const covered = (day: CalendarDay | undefined) => [day?.lunch, day?.dinner].filter((m) => m != null);

/**
 * "Jumat 9 Oktober, makan siang dan makan malam, menu belum diisi, sudah sampai, hari ini": the day, what it covers,
 * then only the states that hold, so a screen reader hears what the photo, the dashes and the rings show. Selection is
 * not in the words: the cell's `selected` accessibility state says it, and saying it twice would be read twice.
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
 * One month, Monday first, drawn on the mood header. A covered day is its meal: the lunch photo (else dinner, else the
 * package's), the day in a pill, a moon when dinner is also on. A day whose menu is not set is dashed and keeps its
 * photo hidden. A past day whose meals all arrived is dimmed. Weekday names and the cells read the mood palette because
 * the grid sits on the header. Always six week rows (see `WEEKS`).
 */
export function MonthGrid({ month, today, selected, days, apiBase, locale, onSelect }: Props) {
  const weeks = monthWeeks(month);
  while (weeks.length < WEEKS) weeks.push(Array<null>(7).fill(null));
  return (
    <Frame testID="month-grid" locale={locale}>
      {weeks.map((week, row) => (
        <View key={row} testID="month-week" style={weekRow}>
          {week.map((date, col) => {
            if (!date) return <View key={col} style={{ flex: 1, minWidth: CELL_MIN_WIDTH, height: CELL_HEIGHT }} />;
            const day = days.get(date);
            const meals = covered(day);
            const isToday = date === today;
            const isSelected = date === selected;
            return (
              <CalendarPhotoCell
                key={date}
                day={Number(date.slice(8))}
                // The lunch photo, else the dinner one; "" when the day is covered but neither meal has any photo.
                uri={meals.length ? photoUri(day?.lunch?.image || day?.dinner?.image || "", apiBase) : null}
                menuSet={meals.every((m) => m.menuSet)}
                dinnerToo={!!day?.lunch && !!day.dinner}
                past={date < today && meals.length > 0 && meals.every((m) => m.delivered)}
                today={isToday}
                selected={isSelected}
                onPress={() => onSelect(date)}
                accessibilityLabel={dayLabel(date, locale, day, isToday)}
                style={{ flex: 1, minWidth: CELL_MIN_WIDTH }}
              />
            );
          })}
        </View>
      ))}
    </Frame>
  );
}

/**
 * The grid with no month in it, for while the month loads or when it could not be read: the weekday names and six
 * empty week rows at the loaded grid's height, with `children` (the loading line, or the error and its retry) centred
 * over the rows. The rows carry no day numbers, because a bare number is how the grid draws a day without a meal, and
 * nothing is known about these days yet.
 */
export function MonthFrame({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <Frame testID="month-frame" locale={locale}>
      {Array.from({ length: WEEKS }, (_, row) => (
        <View key={row} testID="month-week" style={weekRow} />
      ))}
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }]}>
        {children}
      </View>
    </Frame>
  );
}

const weekRow = { flexDirection: "row", gap: GAP, height: CELL_HEIGHT } as const;

/**
 * What the loaded grid and the empty frame share, so the two are the same height by construction: the weekday names,
 * then the week rows (and whatever is laid over them) in one column.
 */
function Frame({ testID, locale, children }: { testID: string; locale: Locale; children: ReactNode }) {
  const mood = useMoodColors();
  return (
    <View testID={testID} style={{ gap: GAP, marginHorizontal: BLEED }}>
      <View testID="month-weekdays" style={{ flexDirection: "row", gap: GAP }}>
        {WEEK_HEADER[locale].map((name) => (
          <RNText
            key={name}
            style={{
              flex: 1,
              minWidth: CELL_MIN_WIDTH,
              textAlign: "center",
              fontFamily: fontFor("700"),
              fontSize: 12,
              lineHeight: 16,
              color: mood.headerMeta,
              paddingVertical: 6,
            }}
          >
            {name}
          </RNText>
        ))}
      </View>
      <View testID="month-weeks" style={{ gap: GAP }}>
        {children}
      </View>
    </View>
  );
}

/**
 * What the cells show: a photo tile, a dashed one for a menu not set yet, a moon for a day that also has dinner.
 * Sits on the header, so the swatches read the same mood tokens as the cells they explain.
 */
export function CalendarLegend({ labels }: { labels: { photo: string; unset: string; dinner: string } }) {
  const mood = useMoodColors();
  const item = { flexDirection: "row", alignItems: "center", gap: 6 } as const;
  const label = { color: mood.headerMeta } as const;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 6 }}>
      <View testID="legend-photo" style={item}>
        <View
          testID="legend-photo-swatch"
          style={{ width: 18, height: 18, borderRadius: 6, borderCurve: "continuous", backgroundColor: mood.headerMeta }}
        />
        <Text variant="caption" style={label}>
          {labels.photo}
        </Text>
      </View>
      <View testID="legend-unset" style={item}>
        <View
          testID="legend-unset-swatch"
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            borderCurve: "continuous",
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: mood.markerIdle,
          }}
        />
        <Text variant="caption" style={label}>
          {labels.unset}
        </Text>
      </View>
      <View testID="legend-dinner" style={item}>
        {/* The cell's disc and moon, in the header's own tokens: the cell's forest disc sits on a photo, and on the
            near-black Malam header a forest disc would vanish. */}
        <View
          testID="legend-dinner-disc"
          style={{ width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: mood.headerText }}
        >
          <Ionicons name="moon" size={11} color={mood.header} />
        </View>
        <Text variant="caption" style={label}>
          {labels.dinner}
        </Text>
      </View>
    </View>
  );
}
