import { useEffect, useRef } from "react";
import { Image, View, type ImageStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { successRig, successRigBox } from "../../../brand/phaseF";
import { useReduced } from "../motion/useReduced";
import { decorative } from "./decorative";
import { MascotArt, mascotArtFrame } from "./MascotArt";

/** The success beat's length (rig.json `motionRecipes` "success", spec 6.2): it ends on the rig's resting frame. */
export const SUCCESS_RIG_MS = 1200;

const layers = {
  body: require("../../../brand/assets/phase-f/runtime/rig-body.png"),
  lid: require("../../../brand/assets/phase-f/runtime/rig-lid.png"),
  badge: require("../../../brand/assets/phase-f/runtime/rig-badge.png"),
  armsUp: require("../../../brand/assets/phase-f/runtime/rig-arms-up.png"),
  eyesOpen: require("../../../brand/assets/phase-f/runtime/rig-eyes-open.png"),
  eyesClosed: require("../../../brand/assets/phase-f/runtime/rig-eyes-closed.png"),
  sparkles: require("../../../brand/assets/phase-f/runtime/rig-sparkles.png"),
};

/** How far the lid swings open about its hinge at the top of the hop, in degrees. */
const LID_OPEN = 12;

function bezier(s: number, a: number, b: number): number {
  "worklet";
  const r = 1 - s;
  return 3 * a * s * r * r + 3 * b * s * s * r + s * s * s;
}

/** The Catera ease, `cubic-bezier(.16, 1, .3, 1)` (`nativeMotion.ease`), solved by bisection so it runs as a worklet. */
function ease(p: number): number {
  "worklet";
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, 0.16, 0.3) < p) lo = mid;
    else hi = mid;
  }
  return bezier((lo + hi) / 2, 1, 1);
}

/** The mirror of `ease`, for a fall that speeds up. */
function easeIn(p: number): number {
  "worklet";
  return 1 - ease(1 - p);
}

function segment(t: number, from: number, to: number): number {
  "worklet";
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

export type SuccessRigFrame = {
  /** Upward travel as a fraction of the rig's visible height. */
  hop: number;
  bodyScaleY: number;
  /** Lid rotation about its hinge in degrees; negative opens it. */
  lidRotate: number;
  badgeScale: number;
  badgeOpacity: number;
  sparkleScale: number;
  sparkleOpacity: number;
};

const REST: SuccessRigFrame = {
  hop: 0,
  bodyScaleY: 1,
  lidRotate: 0,
  badgeScale: 1,
  badgeOpacity: 1,
  sparkleScale: 1,
  sparkleOpacity: 0,
};

/**
 * The spec 6.2 timeline at `t` milliseconds, transform and opacity only:
 * - 0 to 120: the body squashes to 96% about `bodyPivot`; 120 to 240 it springs back.
 * - 120 to 420: it hops 6% of its height and the lid opens about `lidHinge`; it falls back by 560.
 * - 300 to 620: the badge appears and pops 0.6, 1.07, 1 about `badgePivot`.
 * - 560 to 700: it lands, 98% then 100%; the lid has closed by 700.
 * - 450 to 1050: the sparkle layer grows 0.8 to 1 and fades out.
 * From 1050 every value is the resting frame, which is also what the rig shows before and after a play.
 */
export function successRigFrame(t: number): SuccessRigFrame {
  "worklet";
  if (t >= 1050) return { ...REST };
  let bodyScaleY = 1;
  if (t < 120) bodyScaleY = 1 - 0.04 * ease(segment(t, 0, 120));
  else if (t < 240) bodyScaleY = 0.96 + 0.04 * ease(segment(t, 120, 240));
  else if (t >= 560 && t < 620) bodyScaleY = 1 - 0.02 * ease(segment(t, 560, 620));
  else if (t >= 620) bodyScaleY = 0.98 + 0.02 * ease(segment(t, 620, 700));

  let hop = 0;
  if (t >= 120 && t < 420) hop = 0.06 * ease(segment(t, 120, 420));
  else if (t >= 420 && t < 560) hop = 0.06 * (1 - easeIn(segment(t, 420, 560)));

  let lidRotate = 0;
  if (t >= 120 && t < 420) lidRotate = 0 - LID_OPEN * ease(segment(t, 120, 420));
  else if (t >= 420) lidRotate = LID_OPEN * (ease(segment(t, 420, 700)) - 1);

  let badgeScale = 0.6;
  if (t >= 300 && t < 500) badgeScale = 0.6 + 0.47 * ease(segment(t, 300, 500));
  else if (t >= 500) badgeScale = 1.07 - 0.07 * ease(segment(t, 500, 620));
  const badgeOpacity = segment(t, 300, 360);

  const sparkleScale = 0.8 + 0.2 * ease(segment(t, 450, 1050));
  const sparkleOpacity = t < 510 ? segment(t, 450, 510) : 1 - segment(t, 510, 1050);

  return { hop, bodyScaleY, lidRotate, badgeScale, badgeOpacity, sparkleScale, sparkleOpacity };
}

const percent = (point: { x: number; y: number }) => `${point.x * 100}% ${point.y * 100}%`;

/**
 * The delivered success rig: seven registered layers stacked at one origin in `rig.json` draw order, never trimmed,
 * sized so the rig's visible height at rest is `size` (as `MascotArt`), the frame as wide as the rig.
 *
 * Before any play, and after one, it shows its own resting frame (badge shown, sparkles gone). It does not swap to the
 * `merayakan` still, which is a separately generated drawing. When `play` turns true it runs the timeline once from
 * its first frame, and `onDone` is called once when it ends; turning `play` false and true again plays it again.
 * Under reduced motion it shows the `merayakan` still at the same size, never moves, and still calls `onDone` once
 * per play. The beat's haptic and the facts beside it belong to the caller.
 */
export function SuccessRig({ size, play, onDone }: { size: number; play: boolean; onDone?: () => void }) {
  const reduced = useReduced();
  const clock = useSharedValue(SUCCESS_RIG_MS);
  const done = useRef(onDone);
  const reducedNow = useRef(reduced);
  useEffect(() => {
    done.current = onDone;
    reducedNow.current = reduced;
  });

  useEffect(() => {
    if (!play) return;
    if (reducedNow.current) {
      done.current?.();
      return;
    }
    cancelAnimation(clock);
    clock.value = 0;
    clock.value = withTiming(SUCCESS_RIG_MS, { duration: SUCCESS_RIG_MS, easing: Easing.linear });
    const timer = setTimeout(() => done.current?.(), SUCCESS_RIG_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimation(clock);
      clock.value = SUCCESS_RIG_MS;
    };
    // The shared value is stable; a play is keyed on `play` alone, so a new `onDone` or a re-render is not a new play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const frame = mascotArtFrame(successRigBox, size);
  const body = useAnimatedStyle(() => {
    const f = successRigFrame(clock.value);
    return { transform: [{ translateY: -f.hop * size }, { scaleY: f.bodyScaleY }] };
  });
  const lid = useAnimatedStyle(() => ({ transform: [{ rotate: `${successRigFrame(clock.value).lidRotate}deg` }] }));
  const badge = useAnimatedStyle(() => {
    const f = successRigFrame(clock.value);
    return { opacity: f.badgeOpacity, transform: [{ scale: f.badgeScale }] };
  });
  const sparkles = useAnimatedStyle(() => {
    const f = successRigFrame(clock.value);
    return { opacity: f.sparkleOpacity, transform: [{ scale: f.sparkleScale }] };
  });

  if (reduced) return <MascotArt pose="merayakan" size={size} />;

  const layer: ImageStyle = { position: "absolute", left: 0, top: 0, width: frame.canvas, height: frame.canvas };
  const fill = { position: "absolute", left: 0, top: 0, width: frame.canvas, height: frame.canvas } as const;
  return (
    <View testID="success-rig" {...decorative} style={{ width: frame.width, height: frame.height }}>
      <View style={{ position: "absolute", left: frame.left, top: frame.top, width: frame.canvas, height: frame.canvas }}>
        <Animated.View style={[fill, { transformOrigin: percent(successRig.bodyPivot) }, body]}>
          <Image testID="success-rig-layer-body" source={layers.body} fadeDuration={0} style={layer} />
          <Animated.Image
            testID="success-rig-layer-lid"
            source={layers.lid}
            fadeDuration={0}
            style={[layer, { transformOrigin: percent(successRig.lidHinge) }, lid]}
          />
          <Animated.Image
            testID="success-rig-layer-badge"
            source={layers.badge}
            fadeDuration={0}
            style={[layer, { transformOrigin: percent(successRig.badgePivot) }, badge]}
          />
          <Image testID="success-rig-layer-arms-up" source={layers.armsUp} fadeDuration={0} style={layer} />
          <Image testID="success-rig-layer-eyes-open" source={layers.eyesOpen} fadeDuration={0} style={layer} />
          <Image
            testID="success-rig-layer-eyes-closed"
            source={layers.eyesClosed}
            fadeDuration={0}
            style={[layer, { opacity: 0 }]}
          />
        </Animated.View>
        <Animated.Image
          testID="success-rig-layer-sparkles"
          source={layers.sparkles}
          fadeDuration={0}
          style={[layer, { transformOrigin: "50% 50%" }, sparkles]}
        />
      </View>
    </View>
  );
}
