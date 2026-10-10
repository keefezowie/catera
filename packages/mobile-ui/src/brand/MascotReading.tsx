import { useEffect, useState } from "react";
import { AppState, Image, View, type ImageStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { nativeArt } from "@catera/design-tokens";
import { readingRig, readingRigBox } from "../../../brand/phaseF";
import { useReduced } from "../motion/useReduced";
import { useScreenFocused } from "../navigation";
import { decorative } from "./decorative";
import { MascotArt, mascotArtFrame } from "./MascotArt";

/** One reading cycle (rig.json `motionRecipes` "reading-loop"). */
export const READING_LOOP_MS = 2400;

const layers = {
  body: require("../../../brand/assets/phase-f/runtime/rig-reading-body.png"),
  eyes: require("../../../brand/assets/phase-f/runtime/rig-reading-eyes.png"),
  magnifier: require("../../../brand/assets/phase-f/runtime/rig-reading-magnifier.png"),
};

/** rig.json `readingRig`: the eyes travel ±0.67% of the canvas and the magnifier swings ±4 degrees. */
const EYE_TRAVEL = 0.0067;
const MAGNIFIER_SWING = 4;
const BLINK_SCALE = 0.16;

function swing(p: number): number {
  "worklet";
  // -1 at the start and end of the cycle, +1 halfway, with no corner at either end.
  return -Math.cos(p * Math.PI * 2);
}

function blink(p: number): number {
  "worklet";
  if (p <= 0.45 || p >= 0.55) return 1;
  return p < 0.5 ? 1 - (1 - BLINK_SCALE) * ((p - 0.45) / 0.05) : BLINK_SCALE + (1 - BLINK_SCALE) * ((p - 0.5) / 0.05);
}

function highlight(p: number): number {
  "worklet";
  if (p <= 0.4 || p >= 0.65) return 0;
  if (p < 0.5) return (p - 0.4) / 0.1;
  if (p <= 0.55) return 1;
  return 1 - (p - 0.55) / 0.1;
}

/**
 * The import assistant's reading mascot, built from the delivered reading rig (`rig.json` `readingRig`): the body, a
 * code-drawn sunrise highlight on the paper line, the same eye PNG twice (clipped at the seam so each eye blinks about
 * its own pupil) and the magnifier swinging about its grip. Sized like `MascotArt`: the rig's visible height is
 * `size`. A waiting loop, so it runs only while its screen is focused and the app is in the foreground; under reduced
 * motion it shows the `membaca` still instead.
 */
export function MascotReading({ size }: { size: number }) {
  const reduced = useReduced();
  const focused = useScreenFocused();
  const [foreground, setForeground] = useState(() => AppState.currentState !== "background");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setForeground(state !== "background"));
    return () => subscription.remove();
  }, []);

  const playing = focused && foreground && !reduced;
  const phase = useSharedValue(0);
  useEffect(() => {
    if (!playing) return;
    phase.value = 0;
    phase.value = withRepeat(withTiming(1, { duration: READING_LOOP_MS, easing: Easing.linear }), -1);
    return () => {
      cancelAnimation(phase);
      phase.value = 0;
    };
    // The shared value is stable; the loop is keyed on whether it may play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const frame = mascotArtFrame(readingRigBox, size);
  const canvas = frame.canvas;
  const eyes = useAnimatedStyle(() => ({
    transform: [{ translateX: EYE_TRAVEL * canvas * swing(phase.value) }, { scaleY: blink(phase.value) }],
  }));
  const magnifier = useAnimatedStyle(() => ({
    transform: [{ rotate: `${MAGNIFIER_SWING * swing(phase.value)}deg` }],
  }));
  const paper = useAnimatedStyle(() => ({ opacity: highlight(phase.value) }));

  if (reduced) return <MascotArt pose="membaca" size={size} />;

  const full: ImageStyle = { position: "absolute", left: 0, top: 0, width: canvas, height: canvas };
  const seam = readingRig.eyeSeam * canvas;
  const [leftPivot, rightPivot] = readingRig.eyePivots;
  const mark = readingRig.paperHighlight;
  // Both eye views span the whole canvas (the right one is shifted back by the seam), so a pivot is in canvas points.
  const pivotAt = (point: { x: number; y: number }) => `${point.x * canvas}px ${point.y * canvas}px`;
  return (
    <View testID="mascot-reading" {...decorative} style={{ width: frame.width, height: frame.height }}>
      <View style={{ position: "absolute", left: frame.left, top: frame.top, width: canvas, height: canvas }}>
        <Image testID="mascot-reading-body" source={layers.body} fadeDuration={0} style={full} />
        <Animated.View
          testID="mascot-reading-highlight"
          style={[
            {
              position: "absolute",
              left: (mark.x - mark.w / 2) * canvas,
              top: (mark.y - mark.h / 2) * canvas,
              width: mark.w * canvas,
              height: mark.h * canvas,
              borderRadius: (mark.h * canvas) / 2,
              // A fixed ink from rig.json, the same in both themes like the art around it.
              backgroundColor: nativeArt.paperHighlight,
              transform: [{ rotate: `${mark.rotate}deg` }],
            },
            paper,
          ]}
        />
        <View
          testID="mascot-reading-eye-left-clip"
          style={{ position: "absolute", left: 0, top: 0, width: seam, height: canvas, overflow: "hidden" }}
        >
          <Animated.View style={[full, { transformOrigin: pivotAt(leftPivot) }, eyes]}>
            <Image testID="mascot-reading-eye-left" source={layers.eyes} fadeDuration={0} style={full} />
          </Animated.View>
        </View>
        <View
          testID="mascot-reading-eye-right-clip"
          style={{ position: "absolute", left: seam, top: 0, width: canvas - seam, height: canvas, overflow: "hidden" }}
        >
          <Animated.View style={[full, { left: -seam, transformOrigin: pivotAt(rightPivot) }, eyes]}>
            <Image testID="mascot-reading-eye-right" source={layers.eyes} fadeDuration={0} style={full} />
          </Animated.View>
        </View>
        <Animated.Image
          testID="mascot-reading-magnifier"
          source={layers.magnifier}
          fadeDuration={0}
          style={[full, { transformOrigin: `${readingRig.magnifierPivot.x * 100}% ${readingRig.magnifierPivot.y * 100}%` }, magnifier]}
        />
      </View>
    </View>
  );
}
