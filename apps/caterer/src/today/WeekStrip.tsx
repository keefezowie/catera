import { View } from "react-native";
import { jakartaDay, longDay, weekdayName } from "@catera/domain";
import { plural, useMobile } from "@catera/mobile-core";
import { PressableScale, Text, useMoodColors } from "@catera/mobile-ui";

/** How many days the strip shows: today and the six after it. */
export const WEEK_DAYS = 7;

const CELL_MIN_HEIGHT = 56;
const CELL_GAP = 4;
const CELL_RADIUS = 12;
const EDGE = 1;
/** Text in a cell shrinks at most this far before it would be cut: a 320 phone or font scale 1.3 keeps one line each. */
const MIN_FIT = 0.85;

/** Which of the next seven Jakarta days `target` is (0 is today), or 0 when it is none of them or not a date. */
export function weekOffset(target: string | undefined, now: Date): number {
  if (!target) return 0;
  for (let offset = 0; offset < WEEK_DAYS; offset += 1) if (jakartaDay(now, offset) === target) return offset;
  return 0;
}

/**
 * The next seven days under the Hari ini title: weekday, day number and how many orders the mood's meal has on that day.
 * Today is the only day the kitchen can act on; the others are for looking ahead, which the screen itself enforces.
 *
 * `counts` maps a date to its order count; null while the week is loading or could not be read, when the cells keep their
 * height and simply have no count line (an unreadable week is not an error banner, the day itself still works). A day
 * with no orders shows "0": the copy glossary retires the lone en dash as a placeholder, and the spoken label says
 * "tidak ada pengantaran".
 *
 * Colour: the selected cell is the Siang / Malam toggle's own pair (`toggleActive` with `onToggleActive`), the others
 * sit on the hero surface that the figure strip below uses, with the 1dp `markerIdle` edge that reads against the header
 * (the sage step is the same colour as the dark Malam header, so it cannot tell a cell from the header). Ratios are in
 * the task report.
 */
export function WeekStrip({
  selected,
  onSelect,
  counts,
}: {
  selected: number;
  onSelect: (offset: number) => void;
  counts: Record<string, number> | null;
}) {
  const { t, locale } = useMobile();
  const ink = useMoodColors();
  const now = new Date();
  return (
    <View testID="week-strip" accessibilityRole="tablist" style={{ flexDirection: "row", gap: CELL_GAP }}>
      {Array.from({ length: WEEK_DAYS }, (_, offset) => {
        const date = jakartaDay(now, offset);
        const on = offset === selected;
        const orders = counts ? (counts[date] ?? 0) : null;
        const label = `${longDay(date, locale)}, ${
          orders === null
            ? ""
            : orders > 0
              ? t(`${orders} pengantaran`, plural(orders, "delivery", "deliveries"))
              : t("tidak ada pengantaran", "no deliveries")
        }`.replace(/, $/, "");
        const first = on ? ink.onToggleActive : ink.heroText;
        const rest = on ? ink.onToggleActive : ink.heroMeta;
        const fit = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: MIN_FIT } as const;
        return (
          <PressableScale
            key={date}
            testID={`week-day-${offset}`}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
            // The chosen day's press changes nothing, so it neither compresses nor buzzes.
            haptic={on ? "none" : "select"}
            pressFeedback={!on}
            onPress={() => {
              if (!on) onSelect(offset);
            }}
            style={{
              flex: 1,
              minHeight: CELL_MIN_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 4,
              paddingHorizontal: 2,
              borderRadius: CELL_RADIUS,
              borderCurve: "continuous",
              borderWidth: EDGE,
              borderColor: on ? ink.toggleActive : ink.markerIdle,
              backgroundColor: on ? ink.toggleActive : ink.hero,
            }}
          >
            <Text
              testID={`week-day-${offset}-weekday`}
              variant="caption"
              {...fit}
              style={{ color: rest, lineHeight: 16, fontVariant: ["tabular-nums"], textAlign: "center" }}
            >
              {weekdayName(date, locale).slice(0, 3)}
            </Text>
            <Text
              testID={`week-day-${offset}-number`}
              variant="bodyStrong"
              {...fit}
              style={{ color: first, lineHeight: 20, fontVariant: ["tabular-nums"], textAlign: "center" }}
            >
              {String(Number(date.slice(8)))}
            </Text>
            {/* The count line keeps its room while the week is unknown, unseen and unheard, so the cell never changes height. */}
            <View
              testID={`week-day-${offset}-count-line`}
              accessibilityElementsHidden={orders === null}
              importantForAccessibility={orders === null ? "no-hide-descendants" : "auto"}
              style={{ opacity: orders === null ? 0 : 1 }}
            >
              <Text
                testID={`week-day-${offset}-count`}
                variant="caption"
                {...fit}
                style={{ color: rest, lineHeight: 16, fontVariant: ["tabular-nums"], textAlign: "center" }}
              >
                {String(orders ?? 0)}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
