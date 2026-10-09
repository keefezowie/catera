import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Line, Path } from "react-native-svg";
import { nativeMotion } from "@catera/design-tokens";
import { useMoodColors } from "../mood";
import { useMoodProgress } from "./useMoodProgress";

const HEIGHT = 70;
const BASELINE = 62;
const RISE = 46;
const INSET = 20;
const IDLE = 32;
const ACTIVE = 40;
// Where the sun and the moon sit along the half ellipse, as a fraction of the way from the left end to the right.
const SUN_AT = 0.3;
const MOON_AT = 0.72;

/** The point a fraction `t` of the way along the half ellipse, in the arc's own coordinates. */
function pointAt(t: number, width: number): { x: number; y: number } {
  "worklet";
  const rx = (width - INSET * 2) / 2;
  const angle = Math.PI * t;
  return { x: width / 2 - rx * Math.cos(angle), y: BASELINE - RISE * Math.sin(angle) };
}

/**
 * The day, drawn: a dashed half ellipse with a sun on the left and a moon on the right, and a disc that sits on the
 * one the mood is on and travels along the arc to the other when the mood changes. Decorative; the headline carries
 * the meaning, so the whole arc is hidden from screen readers.
 */
export function DayArc() {
  const [width, setWidth] = useState(0);
  const palette = useMoodColors();
  const header = palette.header;
  const { progress, target, reduced } = useMoodProgress(nativeMotion.feature);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const disc = useAnimatedStyle(() => {
    const p = pointAt(SUN_AT + progress.value * (MOON_AT - SUN_AT), width);
    return { transform: [{ translateX: p.x - ACTIVE / 2 }, { translateY: p.y - ACTIVE / 2 }] };
  });
  const sunGlyph = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const moonGlyph = useAnimatedStyle(() => ({ opacity: progress.value }));

  const rx = (width - INSET * 2) / 2;
  const sun = pointAt(SUN_AT, width);
  const moon = pointAt(MOON_AT, width);
  const rest = pointAt(SUN_AT + target * (MOON_AT - SUN_AT), width);

  return (
    <View
      testID="day-arc"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      onLayout={onLayout}
      style={{ width: "100%", height: HEIGHT }}
    >
      {width > 0 ? (
        <>
          <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
            <Path
              d={`M ${INSET} ${BASELINE} A ${rx} ${RISE} 0 0 1 ${width - INSET} ${BASELINE}`}
              fill="none"
              stroke={palette.arcTrack}
              strokeWidth={2}
              strokeDasharray="3 7"
              strokeLinecap="round"
            />
            <Line
              x1={0}
              y1={BASELINE}
              x2={width}
              y2={BASELINE}
              stroke={palette.headerText}
              strokeOpacity={0.4}
              strokeWidth={1.5}
            />
          </Svg>
          <View
            testID="day-arc-idle-sun"
            style={[styles.idle, { left: sun.x - IDLE / 2, top: sun.y - IDLE / 2, borderColor: palette.markerIdle }]}
          >
            <Ionicons name="sunny" size={16} color={palette.markerIdle} />
          </View>
          <View
            testID="day-arc-idle-moon"
            style={[styles.idle, { left: moon.x - IDLE / 2, top: moon.y - IDLE / 2, borderColor: palette.markerIdle }]}
          >
            <Ionicons name="moon" size={16} color={palette.markerIdle} />
          </View>
          <Animated.View
            testID="day-arc-active"
            style={[
              styles.active,
              { backgroundColor: palette.markerActive },
              reduced
                ? { transform: [{ translateX: rest.x - ACTIVE / 2 }, { translateY: rest.y - ACTIVE / 2 }] }
                : disc,
            ]}
          >
            <Animated.View
              testID="day-arc-sun-glyph"
              style={[styles.glyph, reduced ? { opacity: 1 - target } : sunGlyph]}
            >
              <Ionicons name="sunny" size={20} color={header} />
            </Animated.View>
            <Animated.View
              testID="day-arc-moon-glyph"
              style={[styles.glyph, reduced ? { opacity: target } : moonGlyph]}
            >
              <Ionicons name="moon" size={20} color={header} />
            </Animated.View>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  idle: {
    position: "absolute",
    width: IDLE,
    height: IDLE,
    borderRadius: IDLE / 2,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  active: {
    position: "absolute",
    left: 0,
    top: 0,
    width: ACTIVE,
    height: ACTIVE,
    borderRadius: ACTIVE / 2,
  },
  glyph: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
});
