import { useMemo, useState } from "react";
import { Text as RNText, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Path } from "react-native-svg";
import { nativeMotion, type Mood } from "@catera/design-tokens";
import { useMood, useMoodColors } from "../mood";
import { PressableScale } from "../motion";
import { fontFor } from "../type";
import { useMoodProgress } from "./useMoodProgress";

/** One end of the arc: its visible title ("Siang"), the line under it, and the meal name a screen reader says first. */
export type MoodArcEnd = { title: string; detail: string; label?: string };
export type MoodArcProps = { siang: MoodArcEnd; malam: MoodArcEnd };

// Each end is a column this wide: the marker on top, the title and detail wrapping under it.
const COLUMN = 96;
const MARKER = 50;
const RING = 44;
const RISE = 24;
// The marker centres sit on this line; the disc at the top of the arc still clears the top edge by 2dp.
const BASE = RISE + RING / 2 + 2;
// The dashed track stops this far short of each marker centre, so it never runs through a ring.
const TRACK_CLEAR = RING / 2 + 4;
const STEPS = 48;
// Title and detail line heights. With the marker they make a 104dp block at font scale 1.0 (23 + 50 + 16 + 15).
const TITLE_LINE = 16;
const DETAIL_LINE = 15;

/** The point a fraction `t` of the way along the half ellipse from the sun marker to the moon marker. */
function pointAt(t: number, width: number): { x: number; y: number } {
  "worklet";
  const rx = (width - COLUMN) / 2;
  const angle = Math.PI * t;
  return { x: width / 2 - rx * Math.cos(angle), y: BASE - RISE * Math.sin(angle) };
}

/** The dashed track between the two rings, sampled along the same half ellipse the disc travels. */
function trackPath(width: number): string {
  const start = pointAt(0, width);
  let t0 = 0;
  while (t0 < 0.5) {
    const p = pointAt(t0, width);
    if (Math.hypot(p.x - start.x, p.y - start.y) >= TRACK_CLEAR) break;
    t0 += 0.002;
  }
  const points: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const p = pointAt(t0 + ((1 - 2 * t0) * i) / STEPS, width);
    points.push(`${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  }
  return points.join(" ");
}

const ENDS = [
  { mood: "siang", icon: "sunny" },
  { mood: "malam", icon: "moon" },
] as const satisfies readonly { mood: Mood; icon: string }[];

const centred = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" } as const;

/**
 * The day arc as the Siang / Malam switch: a `tablist` whose two `tab`s are the ends of a dashed half ellipse, a sun
 * on the left and a moon on the right, each with its title and a detail line under it. Both ends wear the same
 * `markerIdle` ring so they read as matching buttons; the chosen end is covered by the filled `markerActive` disc,
 * which travels along the arc to the other end when the mood changes (`nativeMotion.feature`, instant under reduced
 * motion) while its colours snap and its glyph cross-fades from the sun to the moon. Reads and writes the app's mood,
 * like `MoodToggle`.
 */
export function MoodArc({ siang, malam }: MoodArcProps) {
  const [width, setWidth] = useState(0);
  const { mood, setMood } = useMood();
  const palette = useMoodColors();
  const { progress, target, reduced } = useMoodProgress(nativeMotion.feature);
  const ends = { siang, malam };
  const track = useMemo(() => (width > 0 ? trackPath(width) : ""), [width]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const travel = useAnimatedStyle(() => {
    const p = pointAt(progress.value, width);
    return { transform: [{ translateX: p.x - RING / 2 }, { translateY: p.y - RING / 2 }] };
  });
  const sunFade = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const moonFade = useAnimatedStyle(() => ({ opacity: progress.value }));
  const rest = pointAt(target, width);

  // The chosen end's filled disc and glyph, also drawn inside its marker until the arc knows its width.
  const glyph = (icon: (typeof ENDS)[number]["icon"]) => <Ionicons name={icon} size={20} color={palette.onToggleActive} />;
  const disc = { width: RING, height: RING, borderRadius: RING / 2, backgroundColor: palette.markerActive } as const;

  return (
    <View testID="mood-arc" accessibilityRole="tablist" onLayout={onLayout} style={{ width: "100%" }}>
      {width > 0 ? (
        <View
          testID="mood-arc-track"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <Svg width={width} height={BASE}>
            <Path d={track} fill="none" stroke={palette.arcTrack} strokeWidth={2} strokeDasharray="3 7" strokeLinecap="round" />
          </Svg>
        </View>
      ) : null}
      <View testID="mood-arc-row" style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {ENDS.map(({ mood: value, icon }) => {
          const end = ends[value];
          const active = value === mood;
          return (
            <PressableScale
              key={value}
              testID={`mood-arc-tab-${value}`}
              accessibilityRole="tab"
              accessibilityLabel={`${end.label ?? end.title}, ${end.detail}`}
              accessibilityState={{ selected: active }}
              // The end that is already chosen has nothing to confirm: no haptic and no press feedback.
              haptic={active ? "none" : "select"}
              pressFeedback={!active}
              onPress={() => setMood(value)}
              style={{ width: COLUMN, alignItems: "center", paddingTop: BASE - MARKER / 2 }}
            >
              <View
                testID={`mood-arc-marker-${value}`}
                style={{ width: MARKER, height: MARKER, alignItems: "center", justifyContent: "center" }}
              >
                <View
                  testID={`mood-arc-ring-${value}`}
                  style={{
                    width: RING,
                    height: RING,
                    borderRadius: RING / 2,
                    borderWidth: 1.5,
                    borderColor: palette.markerIdle,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={icon} size={20} color={palette.markerIdle} />
                </View>
                {active && width === 0 ? (
                  <View testID={`mood-arc-seed-${value}`} pointerEvents="none" style={centred}>
                    <View testID={`mood-arc-seed-${value}-disc`} style={[disc, { alignItems: "center", justifyContent: "center" }]}>
                      {glyph(icon)}
                    </View>
                  </View>
                ) : null}
              </View>
              <RNText
                testID={`mood-arc-title-${value}`}
                style={{
                  maxWidth: COLUMN,
                  textAlign: "center",
                  fontFamily: fontFor("700"),
                  fontSize: 13,
                  lineHeight: TITLE_LINE,
                  color: palette.headerText,
                }}
              >
                {end.title}
              </RNText>
              <RNText
                testID={`mood-arc-detail-${value}`}
                style={{
                  maxWidth: COLUMN,
                  textAlign: "center",
                  fontFamily: fontFor("500"),
                  fontSize: 12,
                  lineHeight: DETAIL_LINE,
                  fontVariant: ["tabular-nums"],
                  color: palette.headerMeta,
                }}
              >
                {end.detail}
              </RNText>
            </PressableScale>
          );
        })}
      </View>
      {width > 0 ? (
        <Animated.View
          testID="mood-arc-disc"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[
            disc,
            { position: "absolute", left: 0, top: 0 },
            reduced ? { transform: [{ translateX: rest.x - RING / 2 }, { translateY: rest.y - RING / 2 }] } : travel,
          ]}
        >
          {/* Both glyphs ride the disc and cross-fade with its travel, so it never shows the moon over the sun. */}
          <Animated.View testID="mood-arc-disc-glyph-siang" style={[centred, reduced ? { opacity: 1 - target } : sunFade]}>
            {glyph("sunny")}
          </Animated.View>
          <Animated.View testID="mood-arc-disc-glyph-malam" style={[centred, reduced ? { opacity: target } : moonFade]}>
            {glyph("moon")}
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}
