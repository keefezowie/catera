import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  addDays,
  longDay,
  monthOf,
  monthRange,
  monthTitle,
  shiftMonth,
  WEEK_HEADER,
} from "@catera/domain";
import { nativeMotion } from "@catera/design-tokens";
import { plural, useMobile } from "@catera/mobile-core";
import { PressableScale, Text, useHaptic, useMoodColors, useReduced } from "@catera/mobile-ui";

const CELL = 56;
const CELL_GAP = 4;
const ROW = CELL + CELL_GAP;
const CELL_RADIUS = 12;
const EDGE = 1;
const TODAY_EDGE = 2;
const TITLE_ROW = 48;
const HANDLE_TARGET = 48;
/** Text in a cell shrinks at most this far before it would be cut: a 320 phone or font scale 1.3 keeps one line each. */
const MIN_FIT = 0.85;
/** A release faster than this (dp per ms) flings the calendar open or shut whatever its position. */
const FLING = 0.5;
/** A touch that moves less than this is a tap, not a drag. */
const SLOP = 6;
/** How far the month's grid travels while the next month fades in. */
const SLIDE = 24;

const ease = Easing.bezier(...nativeMotion.ease);
const move = Easing.bezier(...nativeMotion.move);

const weekdayIndex = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;

/** True for a real "YYYY-MM-DD" date (a notification's `date` may be anything). */
export function validDay(day: string | undefined): day is string {
  return !!day && /^\d{4}-\d{2}-\d{2}$/.test(day) && addDays(day, 0) === day;
}

/** The Monday of the week that holds `day`. */
export const weekStart = (day: string) => addDays(day, -weekdayIndex(day));

/** Senin to Minggu around `day`. */
export const weekOf = (day: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i));

/** The month as 4 to 6 Monday-first weeks, with the days of the neighbouring months that fill them. */
export function monthGrid(month: string): string[][] {
  const { from, to } = monthRange(month);
  const weeks: string[][] = [];
  for (let monday = weekStart(from); monday <= to; monday = addDays(monday, 7)) weeks.push(weekOf(monday));
  return weeks;
}

/** Where a released drag ends: a fling decides, otherwise the half it was let go in. 1 is open, 0 is the week. */
export function settleTarget(progress: number, velocityY: number): 0 | 1 {
  if (velocityY > FLING) return 1;
  if (velocityY < -FLING) return 0;
  return progress > 0.5 ? 1 : 0;
}

/** The clipped window's height: one row at progress 0, `rows` rows with their gaps at 1 (`rows` is fractional while a month with another number of weeks takes over). */
export function windowHeight(progress: number, rows: number): number {
  "worklet";
  return CELL + (rows * ROW - CELL_GAP - CELL) * progress;
}

/** The days a read has to cover: the selected week, or the displayed month's whole grid. */
export function visibleRange(expanded: boolean, month: string, selected: string): { from: string; to: string } {
  if (!expanded) return { from: weekStart(selected), to: addDays(weekStart(selected), 6) };
  const grid = monthGrid(month);
  return { from: grid[0][0], to: grid[grid.length - 1][6] };
}

/**
 * One day of the calendar. The selected day's fill fades in over `control` (a layer under the text), and the text
 * switches at once.
 */
function DayCell({
  date,
  today,
  selected,
  outside,
  orders,
  hidden,
  onPress,
}: {
  date: string;
  today: string;
  selected: boolean;
  outside: boolean;
  orders: number | null;
  hidden: boolean;
  onPress: () => void;
}) {
  const { t, locale } = useMobile();
  const ink = useMoodColors();
  const reduced = useReduced();
  const fill = useSharedValue(selected ? 1 : 0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const target = selected ? 1 : 0;
    fill.value = reduced ? target : withTiming(target, { duration: nativeMotion.control, easing: ease });
  }, [selected, reduced, fill]);
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

  const isToday = date === today;
  const past = date < today;
  const label = `${longDay(date, locale)}, ${
    orders === null
      ? ""
      : orders > 0
        ? t(`${orders} pengantaran`, plural(orders, "delivery", "deliveries"))
        : t("tidak ada pengantaran", "no deliveries")
  }`.replace(/, $/, "");
  const first_ = selected ? ink.onToggleActive : outside ? ink.markerIdle : past ? ink.heroMeta : ink.heroText;
  const rest = selected ? ink.onToggleActive : outside ? ink.markerIdle : ink.heroMeta;
  const fit = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: MIN_FIT } as const;
  const id = `week-day-${date}`;
  return (
    <PressableScale
      testID={id}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      // The chosen day's press changes nothing, so it neither compresses nor buzzes.
      haptic={selected ? "none" : "select"}
      pressFeedback={!selected}
      onPress={() => {
        if (!selected) onPress();
      }}
      style={{
        flex: 1,
        height: CELL,
        minHeight: CELL,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 4,
        paddingHorizontal: 2,
        borderRadius: CELL_RADIUS,
        borderCurve: "continuous",
        overflow: "hidden",
        borderWidth: isToday ? TODAY_EDGE : EDGE,
        borderColor: selected ? ink.toggleActive : isToday ? ink.todayRing : ink.markerIdle,
        backgroundColor: past && !isToday ? "transparent" : ink.hero,
      }}
    >
      <Animated.View
        testID={`${id}-fill`}
        pointerEvents="none"
        style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: ink.toggleActive }, fillStyle]}
      />
      <Text
        testID={`${id}-number`}
        variant="bodyStrong"
        {...fit}
        style={{ color: first_, lineHeight: 20, fontVariant: ["tabular-nums"], textAlign: "center" }}
      >
        {String(Number(date.slice(8)))}
      </Text>
      {/* The count line keeps its room while the range is unknown, unseen and unheard, so the cell never changes height. */}
      <View
        testID={`${id}-count-line`}
        accessibilityElementsHidden={orders === null}
        importantForAccessibility={orders === null ? "no-hide-descendants" : "auto"}
        style={{ opacity: orders === null ? 0 : 1 }}
      >
        <Text
          testID={`${id}-count`}
          variant="caption"
          {...fit}
          style={{ color: rest, lineHeight: 16, fontVariant: ["tabular-nums"], textAlign: "center" }}
        >
          {String(orders ?? 0)}
        </Text>
      </View>
    </PressableScale>
  );
}

/**
 * The calendar under the Hari ini title: the Monday to Sunday week that holds the selected day, which a handle opens
 * into the whole month. Each cell shows the day number and how many orders the mood's meal has on it. Only today can be
 * acted on; the other days are for looking, which the screen itself enforces.
 *
 * `counts` maps a date to its order count; null while the range is loading or could not be read, when the cells keep
 * their height and simply have no count (an unreadable range is not an error banner, the day itself still works). A day
 * with no orders shows "0": the copy glossary retires the lone en dash as a placeholder, and the spoken label says
 * "tidak ada pengantaran". `onRange` reports the days the counts must cover: the selected week, or the displayed month's
 * grid when the calendar is open.
 *
 * Motion: one `progress` (0 week, 1 month) drives a clipped window over the month's grid; the grid is always laid out
 * in full and slides up so the selected week stays where it is while the others unfold around it. Month arrows slide
 * and fade the grid over `selection`. Reduced motion jumps every change; a drag then snaps on release.
 *
 * Colour: the selected cell is the Siang / Malam toggle's own pair, today sits on the hero surface with a 2dp
 * `todayRing` edge, past days are open frames with `heroMeta` ink, the days of the other months in the grid take
 * `markerIdle` ink.
 */
export function WeekStrip({
  selected,
  today,
  onSelect,
  counts,
  onRange,
}: {
  selected: string;
  today: string;
  onSelect: (day: string) => void;
  counts: Record<string, number> | null;
  onRange: (range: { from: string; to: string }) => void;
}) {
  const { t, locale } = useMobile();
  const ink = useMoodColors();
  const reduced = useReduced();
  const haptic = useHaptic();
  const [expanded, setExpanded] = useState(false);
  // The month the open calendar shows; null while it is closed, when it follows the selected day.
  const [browsing, setBrowsing] = useState<string | null>(null);
  const month = browsing ?? monthOf(selected);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const rowIndex = Math.max(0, weeks.findIndex((w) => w.includes(selected)));

  const progress = useSharedValue(0);
  const rows = useSharedValue(weeks.length);
  const row = useSharedValue(rowIndex);
  const slide = useSharedValue(0);
  const shade = useSharedValue(1);

  useEffect(() => {
    row.value = rowIndex;
    rows.value = reduced ? weeks.length : withTiming(weeks.length, { duration: nativeMotion.selection, easing: ease });
  }, [rowIndex, weeks.length, reduced, row, rows]);

  const range = visibleRange(expanded, month, selected);
  useEffect(() => onRange(range), [range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const windowStyle = useAnimatedStyle(() => ({
    height: windowHeight(progress.value, rows.value),
  }));
  const gridStyle = useAnimatedStyle(() => ({
    opacity: shade.value,
    transform: [{ translateY: -row.value * ROW * (1 - progress.value) }, { translateX: slide.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    height: TITLE_ROW * progress.value,
    opacity: progress.value,
  }));

  const settle = (target: 0 | 1) => {
    progress.value = reduced ? target : withTiming(target, { duration: nativeMotion.content, easing: move });
    const open = target === 1;
    if (open !== expanded) haptic.select();
    setExpanded(open);
    setBrowsing(open ? monthOf(selected) : null);
  };
  const toggle = () => settle(expanded ? 0 : 1);

  // The handle's own responder: a touch that starts anywhere else belongs to the screen's pull to refresh.
  const travel = Math.max(1, (weeks.length - 1) * ROW);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const drag = useRef({ from: 0 });
  const latest = useRef({ settle, expanded, travel });
  latest.current = { settle, expanded, travel };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dy) > SLOP && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          drag.current.from = progress.value;
        },
        onPanResponderMove: (_e, g) => {
          if (reducedRef.current) return;
          progress.value = Math.min(1, Math.max(0, drag.current.from + g.dy / latest.current.travel));
        },
        onPanResponderRelease: (_e, g) => {
          const base = latest.current.expanded ? 1 : 0;
          const now = reducedRef.current
            ? Math.min(1, Math.max(0, base + g.dy / latest.current.travel))
            : progress.value;
          latest.current.settle(settleTarget(now, g.vy));
        },
      }),
    [progress],
  );
  const go = (by: number) => {
    const next = shiftMonth(month, by);
    setBrowsing(next);
    if (reduced) return;
    slide.value = by * SLIDE;
    shade.value = 0;
    slide.value = withTiming(0, { duration: nativeMotion.selection, easing: ease });
    shade.value = withTiming(1, { duration: nativeMotion.selection, easing: ease });
  };

  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (closing.current && clearTimeout(closing.current)), []);
  const pick = (day: string) => {
    onSelect(day);
    if (!expanded) return;
    // The fill fades in first, then the month folds back to that day's week.
    closing.current = setTimeout(() => settle(0), reduced ? 0 : nativeMotion.control);
  };

  const iconButton = (by: number, icon: "chevron-back" | "chevron-forward", label: string) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="select"
      onPress={() => go(by)}
      style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={icon} size={24} color={ink.headerText} />
    </PressableScale>
  );

  const labels = WEEK_HEADER[locale];
  return (
    <View testID="week-strip">
      <Animated.View
        testID="week-month-row"
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
        pointerEvents={expanded ? "auto" : "none"}
        style={[{ overflow: "hidden", flexDirection: "row", alignItems: "center" }, titleStyle]}
      >
        {iconButton(-1, "chevron-back", t("Bulan sebelumnya", "Previous month"))}
        <Text
          testID="week-month-title"
          variant="bodyStrong"
          style={{ flex: 1, textAlign: "center", color: ink.headerText }}
        >
          {monthTitle(month, locale)}
        </Text>
        {iconButton(1, "chevron-forward", t("Bulan berikutnya", "Next month"))}
      </Animated.View>
      <View testID="week-weekdays" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", gap: CELL_GAP, paddingBottom: CELL_GAP }}>
        {labels.map((name) => (
          <Text
            key={name}
            variant="caption"
            numberOfLines={1}
            style={{ flex: 1, textAlign: "center", color: ink.headerMeta, lineHeight: 16 }}
          >
            {name}
          </Text>
        ))}
      </View>
      <Animated.View
        testID="week-window"
        accessibilityRole="tablist"
        style={[{ overflow: "hidden" }, windowStyle]}
      >
        <Animated.View testID="week-grid" style={[{ gap: CELL_GAP }, gridStyle]}>
          {weeks.map((days, index) => (
            <View key={days[0]} testID={`week-row-${index}`} style={{ flexDirection: "row", gap: CELL_GAP }}>
              {days.map((day) => (
                <DayCell
                  key={day}
                  date={day}
                  today={today}
                  selected={day === selected}
                  outside={expanded && monthOf(day) !== month}
                  orders={counts ? (counts[day] ?? 0) : null}
                  hidden={!expanded && index !== rowIndex}
                  onPress={() => pick(day)}
                />
              ))}
            </View>
          ))}
        </Animated.View>
      </Animated.View>
      <View {...pan.panHandlers} testID="week-handle-zone">
        <PressableScale
          testID="week-handle"
          accessibilityRole="button"
          accessibilityLabel={expanded ? t("Tutup kalender bulan", "Close month calendar") : t("Buka kalender bulan", "Open month calendar")}
          accessibilityState={{ expanded }}
          haptic="none"
          pressFeedback={false}
          onPress={toggle}
          style={{ height: HANDLE_TARGET, minHeight: HANDLE_TARGET, alignItems: "center", justifyContent: "center" }}
        >
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: ink.markerIdle }} />
        </PressableScale>
      </View>
    </View>
  );
}
