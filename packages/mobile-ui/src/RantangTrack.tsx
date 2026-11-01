import { useEffect, useRef, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import { nativeMotion } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { PolishArt, type PolishArtName } from "./brand/polishArt";
import { Rantang } from "./brand/Rantang";
import { StopGlyph, type StopGlyphName } from "./brand/StopGlyphs";
import { Text } from "./components";
import { fontFor } from "./type";
import { useMoodInks } from "./mood";
import { useReduced } from "./motion";
import { withAlpha } from "./withAlpha";

export type TrackStage = "scheduled" | "preparing" | "out_for_delivery" | "arrived_unconfirmed" | "delivered" | "issue";
/** Where a meal that failed to arrive got to: the last stop it reached. */
export type TrackReached = "scheduled" | "preparing" | "out_for_delivery";
/** Meals per stage, for Dapur's count card. Sampai holds the sum of the two stages that end there. */
export type TrackCounts = Partial<Record<Exclude<TrackStage, "issue">, number>>;

type Flow = Exclude<TrackStage, "issue">;

const ease = Easing.bezier(...nativeMotion.ease);
/**
 * The track's geometry per size. `regular` is the rantang marker riding above a 36 ring rail (64 with the 4 between);
 * `compact` (Dapur's Hari ini header) is a 40 rail of 32 rings round 24 discs, the marker drawn on the current stop.
 */
const SIZES = {
  regular: { marker: 24, disc: 28, ring: 36, glyph: 16, rail: 64 },
  compact: { marker: 24, disc: 24, ring: 32, glyph: 14, rail: 40 },
  /**
   * `art` (Beranda's hero, polish canvas Lacak): each stop is its picture (36) on a 44 tone disc inside a 56 ring, the
   * 44 being the HIG's 44pt unit (expo-native-ui); the disc at 1.14 (50) still clears the ring's 2.5 border. No marker
   * rides above it (the ring marks where the meal is), so the rail is the ring's height.
   */
  art: { marker: 24, disc: 44, ring: 56, glyph: 36, rail: 56 },
} as const;
type Dims = (typeof SIZES)[keyof typeof SIZES];
/** The rantang drawn on the current stop of a compact track, on a 24 disc. */
const COMPACT_MARKER_GLYPH = 18;
const LINE = 2;
const STOPS = 4;
const LAST = STOPS - 1;
const CURRENT_SCALE = 1.14;
/** Stop centres sit at 0, 1/3, 2/3 and 1 of the rail, so the rail is inset by half of one label column on each side. */
const INSET = `${100 / STOPS / 2}%` as const;
const GLYPHS: StopGlyphName[] = ["calendar", "pot", "motorbike", "house"];
/**
 * The `art` stops. Terjadwal is the rantang with its clock: the data has no packing stage, so the canvas's Dikemas
 * (spot-rantang-dikemas) has no stop to stand for.
 */
const ART: PolishArtName[] = ["spot-rantang-clock", "spot-wok", "spot-scooter", "spot-rantang-sampai"];
/** A stop still ahead shows its picture faded to this. */
const ART_AHEAD = 0.45;
const ORDER: Flow[] = ["scheduled", "preparing", "out_for_delivery", "arrived_unconfirmed", "delivered"];
const REACHED_INDEX: Record<TrackReached, number> = { scheduled: 0, preparing: 1, out_for_delivery: 2 };
/** One pass of the in-progress segment: it grows over the first 60%, holds, then fades over the last 20%. */
const RUN_MS = 1800;
const RUN_GROW = 0.6;
const RUN_FADE = 0.8;

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

/** "Scheduled" at font scale 1.3 is about 74dp against a 64dp pager column: 0.85 lets it fit whole. */
const MIN_LABEL_SCALE = 0.85;
/** Each label column keeps this much air on either side, so a label shrunk to its column (large text) never touches the next. */
const LABEL_GUTTER = 3;

type Translate = (id: string, en: string) => string;
const stopLabels = (t: Translate) => [
  t("Terjadwal", "Scheduled"),
  t("Dimasak", "Cooking"),
  t("Diantar", "On the way"),
  t("Sampai", "Arrived"),
];

/**
 * How many caption lines the stop labels take in this language: 2 when any label has two words (English "On the
 * way" wraps), else 1. Skeletons read it to stand as tall as the track.
 */
export function trackLabelLines(t: Translate): 1 | 2 {
  return stopLabels(t).some((label) => label.includes(" ")) ? 2 : 1;
}

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
 *   at once.
 * - While the meal is on its way to the next stop (Terjadwal, Dimasak, Diantar) the segment after the current stop
 *   fills from its left edge in a loop, in `heroText`, so the order reads as moving. Not under reduced motion, not for
 *   `issue`, not once Sampai is reached, and not with `counts` (Dapur).
 * - A screen reader gets one sentence for the whole track, "Pesanan: {stage}, langkah {n} dari 4", with the caption
 *   (and the counts) as its state; the stops and their labels are decoration for the eye. A failed meal's step is the
 *   stop it reached. Each label keeps to its column: two words wrap, one word shrinks a little to fit.
 * - `counts` (Dapur) puts a figure under each stop and fills the line to the furthest stage any meal has reached; the
 *   words then name that stage too, so the caption never disagrees with the ring.
 * - The caller remounts the track (a `key`) when it starts showing another meal or day, so a switch is not a change.
 * - `art` (Beranda's hero, polish canvas Lacak): each stop is its picture (Terjadwal the rantang with its clock, then
 *   the wok, the scooter and the rantang that arrived) on an opaque tone disc, a stop ahead faded, the current one
 *   ringed (Sampai keeps its ring once reached), with no marker. A short headline names the stage ("Lagi dimasak"); the
 *   caption shows under it only when it adds a fact (a time, an automatic arrival); its words are always in the
 *   accessibility value.
 *   The fill, the loop and their reduced-motion rules are the same as `regular`.
 */
export function RantangTrack({
  stage: given,
  caption,
  counts,
  reached = "out_for_delivery",
  size = "regular",
  testID = "rantang-track",
}: {
  stage: TrackStage;
  /** A line that says what is true now, with its times. Without one the track says the stage in words. */
  caption?: string;
  counts?: TrackCounts;
  reached?: TrackReached;
  /**
   * `compact` (Dapur): a 40 rail with the state-words line left out of the picture (it stays in the accessibility
   * label) and the marker drawn on the current stop. The default is the track as it always was.
   */
  size?: "regular" | "compact" | "art";
  testID?: string;
}) {
  const dims: Dims = SIZES[size];
  const compact = size === "compact";
  const art = size === "art";
  const ink = useMoodInks();
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
  const running = !reduced && !issue && !counts && at < LAST;
  const run = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(run);
    run.value = 0;
    if (!running) return;
    run.value = withRepeat(withTiming(1, { duration: RUN_MS, easing: Easing.linear }), -1);
    return () => cancelAnimation(run);
  }, [running, here, run]);

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
    () => ({ transform: [{ translateX: (Math.min(position.value, LAST) / LAST) * width - dims.marker / 2 }] }),
    [width, dims.marker],
  );
  // A full-width bar grown from its left edge, so the progress is a transform and not a width.
  const progress = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(Math.min(position.value, LAST) / LAST, 0.0001) }] }));
  const dash = useAnimatedStyle(() => ({ opacity: warn.value }));
  const runner = useAnimatedStyle(() => {
    const grow = clamp01(run.value / RUN_GROW);
    return {
      opacity: 1 - clamp01((run.value - RUN_FADE) / (1 - RUN_FADE)),
      // A cubic ease-out (the Catera curve), so the bar starts quick and settles toward the next stop.
      transform: [{ scaleX: Math.max(1 - (1 - grow) ** 3, 0.0001) }],
    };
  });
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
  // The art track's headline: what is happening, in a few words, over the caption's times.
  const headlines: Record<TrackStage, string> = {
    scheduled: t("Belum mulai dimasak", "Not cooking yet"),
    preparing: t("Lagi dimasak", "Being cooked"),
    out_for_delivery: t("Dalam perjalanan", "On its way"),
    arrived_unconfirmed: t("Sudah sampai?", "Has it arrived?"),
    delivered: t("Selamat makan", "Enjoy your meal"),
    issue: t("Gagal diantar", "Not delivered"),
  };
  const labels = stopLabels(t);
  const twoLines = trackLabelLines(t) === 2;
  // A failed meal is counted at the stop it reached.
  const step = here + 1;
  const sentence = t(
    `Pesanan: ${names[stage]}, langkah ${step} dari ${STOPS}`,
    `Order: ${names[stage]}, step ${step} of ${STOPS}`,
  );
  // With counts the line can run past the stage given; a caption written for that stage would then disagree with the
  // ring and the sentence, so the words name the furthest stage instead.
  const words = issue
    ? names.issue
    : caption && stage === given
      ? caption
      : stage === "arrived_unconfirmed" && !counts
        ? t("Ditandai sampai, menunggu konfirmasimu", "Marked as arrived, waiting for you to confirm")
        : names[stage];
  const total = (i: number) =>
    i === LAST ? (counts?.arrived_unconfirmed ?? 0) + (counts?.delivered ?? 0) : (counts?.[ORDER[i] as Flow] ?? 0);
  const state = [words, ...(counts ? labels.map((label, i) => `${label} ${total(i)}`) : [])].join(". ");
  // The stage in a word or two, as the stop labels, the names, the headlines and the journey caption say it.
  const bare = new Set<string>([...labels, ...Object.values(names), ...Object.values(headlines), t("Sedang diantar", "On the way")]);

  // Regular: the rantang rides above the rail. Compact: it is drawn on the current stop, on a disc that hides the
  // stop's own glyph, so it sits after the stops in the tree (on top of them).
  const markerView = (
    <Animated.View
      testID={`${testID}-marker`}
      style={[
        {
          position: "absolute",
          top: compact ? (dims.rail - dims.marker) / 2 : 0,
          left: 0,
          width: dims.marker,
          height: dims.marker,
          opacity: measured ? 1 : 0,
        },
        compact ? { borderRadius: dims.marker / 2, backgroundColor: ink.hero, alignItems: "center", justifyContent: "center" } : null,
        marker,
      ]}
    >
      <Rantang
        size={compact ? COMPACT_MARKER_GLYPH : dims.marker}
        color={issue ? ink.heroWarn : ink.heroText}
        filled={stage !== "scheduled"}
        testID={`${testID}-marker-glyph`}
      />
    </Animated.View>
  );

  return (
    <View testID={testID} accessible accessibilityLabel={sentence} accessibilityValue={{ text: state }} style={{ gap: 8 }}>
      {/* The caption carries the cooking and departure times, so its figures are tabular. A compact track leaves it out
          of the picture: the accessibility value above says the same words. */}
      {art ? (
        <Text
          testID={`${testID}-headline`}
          variant="rowTitle"
          style={{ color: issue ? ink.heroWarn : ink.heroText, fontFamily: fontFor("700") }}
        >
          {headlines[stage]}
        </Text>
      ) : null}
      {/* An art track says the stage once, in its headline (the stop labels name it too). Its caption stays as the one
          supporting line only when it adds a fact (a time, "Berangkat 10.42", or "Ditandai sampai otomatis"); a bare
          stage word lives in the accessibility value alone. */}
      {compact || (art && bare.has(words)) ? null : (
        <Text
          testID={`${testID}-caption`}
          variant="label"
          style={{ color: issue ? ink.heroWarn : ink.heroText, fontVariant: ["tabular-nums"] }}
        >
          {words}
        </Text>
      )}
      <View style={{ paddingHorizontal: INSET }}>
        <View testID={`${testID}-rail`} onLayout={onLayout} style={{ height: dims.rail }}>
          {compact || art ? null : markerView}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: compact || art ? (dims.rail - dims.ring) / 2 : dims.marker + 4,
              height: dims.ring,
              justifyContent: "center",
            }}
          >
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
            {running ? (
              <View
                testID={`${testID}-run`}
                style={{ position: "absolute", left: `${(here * 100) / LAST}%`, width: `${100 / LAST}%`, height: LINE }}
              >
                <Animated.View
                  testID={`${testID}-run-bar`}
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
                    runner,
                  ]}
                />
              </View>
            ) : null}
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
                half={i === LAST && !issue}
                dims={dims}
                art={art ? ART[i] : undefined}
                testID={`${testID}-stop-${i}`}
              />
            ))}
          </View>
          {compact ? markerView : null}
        </View>
      </View>
      <View
        testID={`${testID}-labels`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: "row" }}
      >
        {/* Each label keeps to its own column, centred on its stop, so neighbours never touch. A label of two words
            wraps to two lines; a single word stays whole on one line and shrinks a little if it must ("Scheduled" at
            font scale 1.3 on a 64dp pager column). When any label can wrap, every column holds two lines' room, so
            the track's height does not depend on which label wraps. */}
        {labels.map((label, i) => {
          const words = label.includes(" ");
          const text = (
            <Text
              testID={`${testID}-label-${i}`}
              variant="caption"
              numberOfLines={words ? 2 : 1}
              adjustsFontSizeToFit={!words}
              minimumFontScale={words ? undefined : MIN_LABEL_SCALE}
              style={[
                {
                  color: issue && i === LAST ? ink.heroWarn : !issue && i === here ? ink.heroText : ink.heroMeta,
                  textAlign: "center",
                },
                twoLines ? { position: "absolute", top: 0, left: 0, right: 0 } : { width: "100%" },
              ]}
            >
              {label}
            </Text>
          );
          return (
          <View key={i} testID={`${testID}-label-col-${i}`} style={{ flex: 1, alignItems: "center", paddingHorizontal: LABEL_GUTTER }}>
            {twoLines ? (
              <View testID={`${testID}-label-slot-${i}`} style={{ alignSelf: "stretch" }}>
                {/* Two invisible caption lines hold the room at any font scale; the label sits over them. */}
                <Text variant="caption" style={{ opacity: 0 }}>
                  {" "}
                </Text>
                <Text variant="caption" style={{ opacity: 0 }}>
                  {" "}
                </Text>
                {text}
              </View>
            ) : (
              text
            )}
            {counts ? (
              <Text
                testID={`${testID}-count-${i}`}
                variant="caption"
                numberOfLines={1}
                style={{ color: total(i) > 0 ? ink.heroText : ink.heroMeta, fontVariant: ["tabular-nums"], textAlign: "center" }}
              >
                {String(total(i))}
              </Text>
            ) : null}
          </View>
          );
        })}
      </View>
    </View>
  );
}

const layerOf = (disc: number) =>
  ({
    position: "absolute",
    left: 0,
    top: 0,
    width: disc,
    height: disc,
    borderRadius: disc / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  }) as const;

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
  dims,
  art,
  testID,
}: {
  index: number;
  /** The stop's picture (`art` tracks); without it the stop is the drawn glyph. */
  art?: PolishArtName;
  position: SharedValue<number>;
  warn: SharedValue<number>;
  issue: boolean;
  half: boolean;
  dims: Dims;
  testID: string;
}) {
  const ink = useMoodInks();
  const { disc: DISC, ring: RING, glyph: GLYPH } = dims;
  const layer = layerOf(DISC);
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
  // The stop the fill stands on. `delivered` sits one past the last stop, so nothing is current then: the journey is
  // over and Sunrise marks only a stop the meal is still at.
  // An art track has no marker, so its last stop keeps the ring once the meal is there: the ring is where it is.
  const keepRing = !!art && last;
  const current = (p: number) => {
    "worklet";
    if (issue) return 0;
    if (keepRing) return arrived(p);
    return arrived(p) * (1 - clamp01(p - index));
  };
  const done = useAnimatedStyle(() => ({ opacity: passed(position.value) }), [issue]);
  const now = useAnimatedStyle(() => ({ opacity: arrived(position.value) }), [issue]);
  const ring = useAnimatedStyle(() => ({ opacity: current(position.value) }), [issue]);
  const disc = useAnimatedStyle(
    () => ({ transform: [{ scale: 1 + (CURRENT_SCALE - 1) * current(position.value) }] }),
    [issue],
  );
  const warning = useAnimatedStyle(() => ({ opacity: warn.value }));
  // Sampai half fills as the fill reaches it, over the same timing (instant under reduced motion, like the fill).
  const halfway = useAnimatedStyle(() => ({ opacity: arrived(position.value) }), [issue]);

  // A stop ahead shows its picture faded; once the fill reaches it, in full.
  const reached = useAnimatedStyle(() => ({ opacity: ART_AHEAD + (1 - ART_AHEAD) * arrived(position.value) }), [issue]);

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
      {art ? (
        <Animated.View
          testID={`${testID}-disc`}
          style={[
            {
              width: DISC,
              height: DISC,
              borderRadius: DISC / 2,
              // Opaque, so the rail never shows through the picture; the tint is a layer on top of the hero ink.
              backgroundColor: ink.hero,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            },
            disc,
          ]}
        >
          <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: withAlpha(ink.heroText, 0.08) }} />
          <Animated.View testID={`${testID}-art`} style={reached}>
            <PolishArt name={art} size={GLYPH} />
          </Animated.View>
        </Animated.View>
      ) : (
        <Animated.View testID={`${testID}-disc`} style={[{ width: DISC, height: DISC }, disc]}>
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
            <Animated.View testID={`${testID}-half`} style={[layer, halfway]}>
              <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: DISC / 2, overflow: "hidden", backgroundColor: ink.heroText }}>
                <View style={{ position: "absolute", left: 0, top: 0, width: DISC, height: DISC, alignItems: "center", justifyContent: "center" }}>
                  <StopGlyph name={glyph} size={GLYPH} color={ink.hero} />
                </View>
              </View>
            </Animated.View>
          ) : null}
          <Animated.View testID={`${testID}-done`} style={[layer, { backgroundColor: ink.heroText }, done]}>
            <StopGlyph name={glyph} size={GLYPH} color={ink.hero} />
          </Animated.View>
        </Animated.View>
      )}
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
