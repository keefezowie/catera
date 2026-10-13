import { useEffect, useRef, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import { nativeMotion } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { Rantang } from "./brand/Rantang";
import { StopGlyph, type StopGlyphName } from "./brand/StopGlyphs";
import { Text } from "./components";
import { useMoodColors } from "./mood";
import { useReduced } from "./motion";

export type TrackStage = "scheduled" | "preparing" | "out_for_delivery" | "arrived_unconfirmed" | "delivered" | "issue";
/** Where a meal that failed to arrive got to: the last stop it reached. */
export type TrackReached = "scheduled" | "preparing" | "out_for_delivery";
/** Meals per stage, for Dapur's count card. Sampai holds the sum of the two stages that end there. */
export type TrackCounts = Partial<Record<Exclude<TrackStage, "issue">, number>>;

type Flow = Exclude<TrackStage, "issue">;

const ease = Easing.bezier(...nativeMotion.ease);
const MARKER = 24;
const DISC = 28;
const RING = 36;
const LINE = 2;
const STOPS = 4;
const LAST = STOPS - 1;
const GLYPH = 16;
const CURRENT_SCALE = 1.14;
/** Stop centres sit at 0, 1/3, 2/3 and 1 of the rail, so the rail is inset by half of one label column on each side. */
const INSET = `${100 / STOPS / 2}%` as const;
const GLYPHS: StopGlyphName[] = ["calendar", "pot", "motorbike", "house"];
const ORDER: Flow[] = ["scheduled", "preparing", "out_for_delivery", "arrived_unconfirmed", "delivered"];
const REACHED_INDEX: Record<TrackReached, number> = { scheduled: 0, preparing: 1, out_for_delivery: 2 };

/**
 * Where the fill and the marker stand, counted in stops (a third of the rail each), so the maths stays exact.
 * `delivered` is one past the last stop so the last stop counts as passed and fills; the marker and the line stop at the
 * end of the rail.
 */
const POSITION: Record<Flow, number> = {
  scheduled: 0,
  preparing: 1,
  out_for_delivery: 2,
  arrived_unconfirmed: 3,
  delivered: 4,
};

const clamp01 = (v: number) => {
  "worklet";
  return Math.min(1, Math.max(0, v));
};

/** The domain's journey as a track stage: a meal marked as a problem is `issue`, one marked Sampai and not yet confirmed is `arrived_unconfirmed`. */
export function trackStage(journey: { stage: string; issue?: boolean }): TrackStage {
  if (journey.issue) return "issue";
  if (journey.stage === "arrived") return "arrived_unconfirmed";
  return (ORDER as string[]).includes(journey.stage) ? (journey.stage as TrackStage) : "scheduled";
}

/** The kitchen's per-stage counts (`KitchenSession.counts`, which names the unconfirmed stage `arrived`) as track counts. */
export function trackCounts(counts: Partial<Record<string, number>>): TrackCounts {
  return {
    scheduled: counts.scheduled ?? 0,
    preparing: counts.preparing ?? 0,
    out_for_delivery: counts.out_for_delivery ?? 0,
    arrived_unconfirmed: counts.arrived ?? 0,
    delivered: counts.delivered ?? 0,
  };
}

/** With counts the line fills to the furthest stage any meal has reached, never less than the stage given. */
function furthest(stage: TrackStage, counts?: TrackCounts): TrackStage {
  if (!counts || stage === "issue") return stage;
  let best = ORDER.indexOf(stage);
  ORDER.forEach((s, i) => {
    if ((counts[s] ?? 0) > 0 && i > best) best = i;
  });
  return ORDER[best];
}

const fallbackT = (id: string) => id;

/**
 * A meal's journey as a lunchbox on a line with four stops: Terjadwal (a calendar), Dimasak (a pot with steam), Diantar
 * (a motorbike) and Sampai (a house with a check), at 0, a third, two thirds and the end. It sits on a hero surface and
 * reads the hero inks of the current mood.
 * - A stop already passed is filled in `heroText`; the current stop is larger and wears a ring in `stopActive`, the one
 *   place the track spends Sunrise (direction K); a stop ahead is an outline in `heroMeta`.
 * - `arrived_unconfirmed`: the kitchen marked Sampai and nobody has confirmed yet. Sampai is half filled and the words
 *   say what it waits for. `issue`: the meal will not arrive. The last stop becomes a warning in `heroWarn` with an
 *   alert glyph, the last segment is dashed and the words say "Gagal diantar"; `reached` is where the meal got to.
 * - The stage comes from fulfilment status, never from the clock. The line fill is a full-width bar scaled from its left
 *   edge; a stage change after mount slides the marker and the fill and fades the stops over `nativeMotion.feature`
 *   (transform and opacity only). The first render, a refresh, a tab return and reduced motion put everything in place
 *   at once. It never loops.
 * - A screen reader gets one sentence for the whole track, "Pesanan: {stage}, langkah {n} dari 4", with the caption
 *   (and the counts) as its state; the stops and their labels are decoration for the eye.
 * - `counts` (Dapur) puts a figure under each stop and fills the line to the furthest stage any meal has reached.
 */
export function RantangTrack({
  stage: given,
  caption,
  counts,
  reached = "out_for_delivery",
  testID = "rantang-track",
}: {
  stage: TrackStage;
  /** A line that says what is true now, with its times. Without one the track says the stage in words. */
  caption?: string;
  counts?: TrackCounts;
  reached?: TrackReached;
  testID?: string;
}) {
  const ink = useMoodColors();
  const reduced = useReduced();
  const mobile = useMobile();
  const t = mobile?.t ?? fallbackT;
  const stage = furthest(given, counts);
  const issue = stage === "issue";
  const at = issue ? REACHED_INDEX[reached] : ORDER.indexOf(stage);
  const here = Math.min(at, LAST);
  const target = issue ? REACHED_INDEX[reached] : POSITION[stage as Flow];
  const [width, setWidth] = useState(0);
  const position = useSharedValue(target);
  const warn = useSharedValue(issue ? 1 : 0);
  const shown = useRef(`${target}:${issue}`);

  useEffect(() => {
    const key = `${target}:${issue}`;
    if (shown.current === key) return;
    shown.current = key;
    const next = issue ? 1 : 0;
    if (reduced) {
      position.value = target;
      warn.value = next;
      return;
    }
    position.value = withTiming(target, { duration: nativeMotion.feature, easing: ease });
    warn.value = withTiming(next, { duration: nativeMotion.feature, easing: ease });
  }, [target, issue, reduced, position, warn]);

  // The marker and the line stop at the end of the rail even when the last stop is passed.
  const marker = useAnimatedStyle(
    () => ({ transform: [{ translateX: (Math.min(position.value, LAST) / LAST) * width - MARKER / 2 }] }),
    [width],
  );
  // A full-width bar grown from its left edge, so the progress is a transform and not a width.
  const progress = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(Math.min(position.value, LAST) / LAST, 0.0001) }] }));
  const dash = useAnimatedStyle(() => ({ opacity: warn.value }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  // Until the rail has been measured the marker has no position to stand at, so it stays invisible instead of
  // flashing at the first stop and then jumping to a departed or delivered one.
  const measured = width > 0;

  const names: Record<TrackStage, string> = {
    scheduled: t("Terjadwal", "Scheduled"),
    preparing: t("Dimasak", "Cooking"),
    out_for_delivery: t("Diantar", "On the way"),
    arrived_unconfirmed: t("Ditandai sampai", "Marked as arrived"),
    delivered: t("Sampai", "Arrived"),
    issue: t("Gagal diantar", "Not delivered"),
  };
  const labels = [t("Terjadwal", "Scheduled"), t("Dimasak", "Cooking"), t("Diantar", "On the way"), t("Sampai", "Arrived")];
  const step = issue ? STOPS : here + 1;
  const sentence = t(
    `Pesanan: ${names[stage]}, langkah ${step} dari ${STOPS}`,
    `Order: ${names[stage]}, step ${step} of ${STOPS}`,
  );
  const words = issue
    ? names.issue
    : (caption ??
      (stage === "arrived_unconfirmed"
        ? t("Ditandai sampai, menunggu konfirmasimu", "Marked as arrived, waiting for you to confirm")
        : names[stage]));
  const total = (i: number) =>
    i === LAST ? (counts?.arrived_unconfirmed ?? 0) + (counts?.delivered ?? 0) : (counts?.[ORDER[i] as Flow] ?? 0);
  const state = [words, ...(counts ? labels.map((label, i) => `${label} ${total(i)}`) : [])].join(". ");

  return (
    <View testID={testID} accessible accessibilityLabel={sentence} accessibilityValue={{ text: state }} style={{ gap: 8 }}>
      {/* The caption carries the cooking and departure times, so its figures are tabular. */}
      <Text
        testID={`${testID}-caption`}
        variant="label"
        style={{ color: issue ? ink.heroWarn : ink.heroText, fontVariant: ["tabular-nums"] }}
      >
        {words}
      </Text>
      <View style={{ paddingHorizontal: INSET }}>
        <View testID={`${testID}-rail`} onLayout={onLayout} style={{ height: MARKER + 4 + RING }}>
          <Animated.View
            testID={`${testID}-marker`}
            style={[{ position: "absolute", top: 0, left: 0, width: MARKER, height: MARKER, opacity: measured ? 1 : 0 }, marker]}
          >
            <Rantang
              size={MARKER}
              color={issue ? ink.heroWarn : ink.heroText}
              filled={stage !== "scheduled"}
              testID={`${testID}-marker-glyph`}
            />
          </Animated.View>
          <View style={{ position: "absolute", left: 0, right: 0, top: MARKER + 4, height: RING, justifyContent: "center" }}>
            <View testID={`${testID}-line`} style={{ height: LINE, borderRadius: LINE / 2, backgroundColor: ink.heroMeta }} />
            <Animated.View
              testID={`${testID}-progress`}
              style={[
                {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: LINE,
                  borderRadius: LINE / 2,
                  backgroundColor: ink.heroText,
                  transformOrigin: "left center",
                  opacity: measured ? 1 : 0,
                },
                progress,
              ]}
            />
            {issue ? (
              <Animated.View
                testID={`${testID}-dash`}
                style={[{ position: "absolute", left: `${(at * 100) / LAST}%`, right: 0, height: LINE }, dash]}
              >
                <Svg width="100%" height={LINE}>
                  <Line
                    x1={0}
                    y1={LINE / 2}
                    x2="100%"
                    y2={LINE / 2}
                    stroke={ink.heroWarn}
                    strokeWidth={LINE}
                    strokeDasharray="4 5"
                    strokeLinecap="round"
                  />
                </Svg>
              </Animated.View>
            ) : null}
            {Array.from({ length: STOPS }, (_, i) => (
              <TrackStop
                key={i}
                index={i}
                position={position}
                warn={warn}
                issue={issue}
                half={i === LAST && (stage === "arrived_unconfirmed" || stage === "delivered")}
                testID={`${testID}-stop-${i}`}
              />
            ))}
          </View>
        </View>
      </View>
      <View
        testID={`${testID}-labels`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: "row" }}
      >
        {labels.map((label, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <Text
              testID={`${testID}-label-${i}`}
              variant="caption"
              style={{
                color: issue && i === LAST ? ink.heroWarn : !issue && i === here ? ink.heroText : ink.heroMeta,
                textAlign: "center",
              }}
            >
              {label}
            </Text>
            {counts ? (
              <Text
                testID={`${testID}-count-${i}`}
                variant="caption"
                style={{ color: total(i) > 0 ? ink.heroText : ink.heroMeta, fontVariant: ["tabular-nums"], textAlign: "center" }}
              >
                {String(total(i))}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const layer = {
  position: "absolute",
  left: 0,
  top: 0,
  width: DISC,
  height: DISC,
  borderRadius: DISC / 2,
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
} as const;

/**
 * One stop, drawn in layers that fade by the fill's position: the outline ahead (`heroMeta`), the outline of the stop
 * the fill has reached (`heroText`) with its `stopActive` ring and a slightly larger scale, and the filled disc once
 * the fill has passed. The last stop also holds a half-filled layer (Sampai marked, not confirmed) and, for `issue`,
 * the warning stop in `heroWarn`.
 */
function TrackStop({
  index,
  position,
  warn,
  issue,
  half,
  testID,
}: {
  index: number;
  position: SharedValue<number>;
  warn: SharedValue<number>;
  issue: boolean;
  half: boolean;
  testID: string;
}) {
  const ink = useMoodColors();
  const last = index === LAST;
  const glyph = GLYPHS[index];
  // For `issue` the stop the meal got to counts as passed: the fill ends there and the warning takes over after it.
  const passed = (p: number) => {
    "worklet";
    return clamp01(p + (issue ? 1 : 0) - index);
  };
  const arrived = (p: number) => {
    "worklet";
    return clamp01(p - index + 1);
  };
  const current = (p: number) => {
    "worklet";
    if (issue) return 0;
    return last ? arrived(p) : arrived(p) * (1 - clamp01(p - index));
  };
  const done = useAnimatedStyle(() => ({ opacity: passed(position.value) }), [issue]);
  const now = useAnimatedStyle(() => ({ opacity: arrived(position.value) }), [issue]);
  const ring = useAnimatedStyle(() => ({ opacity: current(position.value) }), [issue]);
  const disc = useAnimatedStyle(
    () => ({ transform: [{ scale: 1 + (CURRENT_SCALE - 1) * current(position.value) }] }),
    [issue],
  );
  const warning = useAnimatedStyle(() => ({ opacity: warn.value }));

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        left: `${(index * 100) / LAST}%`,
        marginLeft: -RING / 2,
        width: RING,
        height: RING,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        testID={`${testID}-ring`}
        style={[
          { position: "absolute", width: RING, height: RING, borderRadius: RING / 2, borderWidth: 2.5, borderColor: ink.stopActive },
          ring,
        ]}
      />
      <Animated.View style={[{ width: DISC, height: DISC }, disc]}>
        <View testID={`${testID}-ahead`} style={[layer, { backgroundColor: ink.hero, borderWidth: 1.6, borderColor: ink.heroMeta }]}>
          <StopGlyph name={glyph} size={GLYPH} color={ink.heroMeta} />
        </View>
        <Animated.View
          testID={`${testID}-now`}
          style={[layer, { backgroundColor: ink.hero, borderWidth: 1.6, borderColor: ink.heroText }, now]}
        >
          <StopGlyph name={glyph} size={GLYPH} color={ink.heroText} />
        </Animated.View>
        {half ? (
          <View testID={`${testID}-half`} style={layer}>
            <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: DISC / 2, overflow: "hidden", backgroundColor: ink.heroText }}>
              <View style={{ position: "absolute", left: 0, top: 0, width: DISC, height: DISC, alignItems: "center", justifyContent: "center" }}>
                <StopGlyph name={glyph} size={GLYPH} color={ink.hero} />
              </View>
            </View>
          </View>
        ) : null}
        <Animated.View testID={`${testID}-done`} style={[layer, { backgroundColor: ink.heroText }, done]}>
          <StopGlyph name={glyph} size={GLYPH} color={ink.hero} />
        </Animated.View>
      </Animated.View>
      {last && issue ? (
        <Animated.View
          testID={`${testID}-warn`}
          style={[
            {
              position: "absolute",
              width: RING,
              height: RING,
              borderRadius: RING / 2,
              borderWidth: 2.5,
              borderColor: ink.heroWarn,
              backgroundColor: ink.hero,
              alignItems: "center",
              justifyContent: "center",
            },
            warning,
          ]}
        >
          <StopGlyph name="alert" size={GLYPH + 2} color={ink.heroWarn} testID={`${testID}-alert`} />
        </Animated.View>
      ) : null}
    </View>
  );
}
