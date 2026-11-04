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

/** A day's order count from `counts`, which only speak for the days in `range`: null (unknown) for any other day. */
export function countOn(
  counts: Record<string, number> | null,
  range: { from: string; to: string },
  day: string,
): number | null {
  return counts && day >= range.from && day <= range.to ? (counts[day] ?? 0) : null;
}

/** Whether `outer` already covers every day of `inner`. */
export const covers = (outer: { from: string; to: string }, inner: { from: string; to: string }) =>
  outer.from <= inner.from && inner.to <= outer.to;

/** The days a read has to cover: the selected week, or the displayed month's whole grid. */
export function visibleRange(expanded: boolean, month: string, selected: string): { from: string; to: string } {
  if (!expanded) return { from: weekStart(selected), to: addDays(weekStart(selected), 6) };
  const grid = monthGrid(month);
  return { from: grid[0][0], to: grid[grid.length - 1][6] };
}

/**
 * One day of the calendar. The selected day's fill fades in over `control` (a layer under the text), and the text
 * changes ink halfway through.
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
  // The text flips ink halfway through the fade, when the fill is as near the new ink's ground as the old one's.
  const [inked, setInked] = useState(selected);
  useEffect(() => {
    if (reduced) return setInked(selected);
    const timer = setTimeout(() => setInked(selected), nativeMotion.control / 2);
    return () => clearTimeout(timer);
  }, [selected, reduced]);

  const isToday = date === today;
  const past = date < today;
  const label = `${longDay(date, locale)}, ${
    orders === null
      ? ""
      : orders > 0
        ? t(`${orders} pengantaran`, plural(orders, "delivery", "deliveries"))
        : t("tidak ada pengantaran", "no deliveries")
  }`.replace(/, $/, "");
  const first_ = inked ? ink.onToggleActive : outside ? ink.markerIdle : past ? ink.heroMeta : ink.heroText;
  const rest = inked ? ink.onToggleActive : outside ? ink.markerIdle : ink.heroMeta;
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
  countsRange,
  onRange,
}: {
  selected: string;
  today: string;
  onSelect: (day: string) => void;
  counts: Record<string, number> | null;
  /** The days `counts` was read for: any other day has no count (yet). */
  countsRange: { from: string; to: string };
  onRange: (range: { from: string; to: string }) => void;
}) {
  const { t, locale } = useMobile();
  const ink = useMoodColors();
  const reduced = useReduced();
  const haptic = useHaptic();
  const [expanded, setExpanded] = useState(false);
  // The month the open calendar shows; null while it is closed, when it follows the selected day.
  const [browsing, setBrowsing] = useState<string | null>(null);
  // A finger is dragging the handle: the month is already showing, so the other months' days take their ink now.
  const [dragging, setDragging] = useState(false);
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

  const forget = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (forget.current) clearTimeout(forget.current);
      if (closing.current) clearTimeout(closing.current);
    },
    [],
  );
  /** `quiet` skips the settle haptic (a picked day already gave its own). */
  const settle = (target: 0 | 1, quiet = false) => {
    const open = target === 1;
    if (forget.current) clearTimeout(forget.current);
    if (open !== expanded && !quiet) haptic.select();
    setExpanded(open);
    setDragging(false);
    if (open) {
      progress.value = reduced ? 1 : withTiming(1, { duration: nativeMotion.content, easing: move });
      setBrowsing(monthOf(selected));
    } else if (browsing === null || reduced) {
      progress.value = 0;
      setBrowsing(null);
    } else if (weeks.some((w) => w.includes(selected))) {
      // The browsed grid still holds the selected week: fold it, then let the grid follow the selected day's month
      // (the same week sits in either, so nothing moves).
      progress.value = withTiming(0, { duration: nativeMotion.content, easing: move });
      forget.current = setTimeout(() => setBrowsing(null), nativeMotion.content);
    } else {
      // Another month's grid has no row for the selected week: show the week at once rather than fold the wrong row.
      progress.value = 0;
      setBrowsing(null);
    }
  };
  const toggle = () => settle(expanded ? 0 : 1);

  // The handle's own responder, claimed on touch so the screen's scroll and pull to refresh never take the gesture. A
  // touch that barely moves is a tap.
  const travel = Math.max(1, (weeks.length - 1) * ROW);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const drag = useRef({ from: 0 });
  const latest = useRef({ settle, toggle, expanded, travel });
  latest.current = { settle, toggle, expanded, travel };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          drag.current.from = progress.value;
        },
        onPanResponderMove: (_e, g) => {
          if (Math.abs(g.dy) > SLOP && Math.abs(g.dy) > Math.abs(g.dx)) setDragging(true);
          if (reducedRef.current) return;
          progress.value = Math.min(1, Math.max(0, drag.current.from + g.dy / latest.current.travel));
        },
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dy) < SLOP && Math.abs(g.dx) < SLOP) return latest.current.toggle();
          const base = latest.current.expanded ? 1 : 0;
          const now = reducedRef.current
            ? Math.min(1, Math.max(0, base + g.dy / latest.current.travel))
            : progress.value;
          latest.current.settle(settleTarget(now, g.vy));
        },
        // A cancelled gesture goes back to the state it began in instead of freezing half open.
        onPanResponderTerminate: () => latest.current.settle(latest.current.expanded ? 1 : 0),
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

  const pick = (day: string) => {
    onSelect(day);
    if (!expanded) return;
    // The fill fades in first, then the month folds back to that day's week; a quick second pick restarts the wait.
    if (closing.current) clearTimeout(closing.current);
    closing.current = setTimeout(() => settle(0, true), reduced ? 0 : nativeMotion.control);
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
                  outside={(expanded || dragging) && monthOf(day) !== month}
                  orders={countOn(counts, countsRange, day)}
                  hidden={!expanded && index !== rowIndex}
                  onPress={() => pick(day)}
                />
              ))}
            </View>
          ))}
        </Animated.View>
      </Animated.View>
      <View
        {...pan.panHandlers}
        testID="week-handle"
        accessible
        accessibilityRole="button"
        accessibilityLabel={expanded ? t("Tutup kalender bulan", "Close month calendar") : t("Buka kalender bulan", "Open month calendar")}
        accessibilityState={{ expanded }}
        style={{ height: HANDLE_TARGET, minHeight: HANDLE_TARGET, alignItems: "center", justifyContent: "center" }}
      >
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: ink.markerIdle }} />
      </View>
    </View>
  );
}
