import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
type Layer = keyof typeof layers;
const LAYER_COUNT = Object.keys(layers).length;

/**
 * Each layer is its own image, and each loads on its own: from Metro over the network in Expo Go, and decoded one by one
 * in a build. Drawn as they arrive, the mascot assembled itself in pieces. So the rig stays invisible, on its first
 * frame, until every layer has loaded (or failed, or `RIG_LOAD_CEILING_MS` passed), and only then plays. Once all seven
 * have loaded anywhere in the app, later rigs show at once.
 */
let rigLoaded = false;
/** How long a rig waits for its layers before it shows whatever has arrived. */
export const RIG_LOAD_CEILING_MS = 1500;

/**
 * Fetches the seven layers ahead of the beat (the editor that may end on it calls this when it opens), so the images are
 * in the cache by the time the rig mounts. Safe to call often: a failed fetch is harmless, the rig still waits.
 */
export function warmSuccessRig() {
  if (rigLoaded) return;
  for (const source of Object.values(layers)) {
    const uri = Image.resolveAssetSource(source)?.uri;
    if (uri) Image.prefetch(uri).catch(() => {});
  }
}

/** Whether every layer has loaded somewhere in the app already, so a rig mounted now shows at once. */
export const successRigLoaded = () => rigLoaded;

/** Tests only: whether every layer has loaded. Imported by file path, not from the package index. */
export function __setSuccessRigLoadedForTests(value: boolean) {
  rigLoaded = value;
}

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

// A pivot in points on the canvas-sized layer, as numbers. RN parses a string origin with a regex that has no decimals,
// so a percent string built from these fractions misparses (bodyPivot, lidHinge) or throws (badgePivot).
const pivotAt = (point: { x: number; y: number }, canvas: number): [number, number, number] => [
  point.x * canvas,
  point.y * canvas,
  0,
];

/**
 * The delivered success rig: seven registered layers stacked at one origin in `rig.json` draw order, never trimmed,
 * sized so the rig's visible height at rest is `size` (as `MascotArt`), the frame as wide as the rig.
 *
 * Before any play, and after one, it shows its own resting frame (badge shown, sparkles gone). It does not swap to the
 * `merayakan` still, which is a separately generated drawing. When `play` turns true it runs the timeline once from
 * its first frame, and `onDone` is called once when it ends; turning `play` false and true again plays it again.
 * Under reduced motion it shows the `merayakan` still at the same size, never moves, and still calls `onDone` once
 * per play. The beat's haptic and the facts beside it belong to the caller.
 * Until every layer has loaded the rig is invisible and a play waits for it (see `rigLoaded`); `onReady` says when.
 */
export function SuccessRig({
  size,
  play,
  onDone,
  onReady,
}: {
  size: number;
  play: boolean;
  onDone?: () => void;
  /** Called once, when every layer has loaded (at once when they already had, or under reduced motion). */
  onReady?: () => void;
}) {
  const reduced = useReduced();
  // Mounted already playing, the first painted frame is the timeline's first frame, never the resting frame.
  const clock = useSharedValue(play && !reduced ? 0 : SUCCESS_RIG_MS);
  const done = useRef(onDone);
  const ready = useRef(onReady);
  const reducedNow = useRef(reduced);
  useLayoutEffect(() => {
    done.current = onDone;
    ready.current = onReady;
    reducedNow.current = reduced;
  });
  const arrived = useRef(new Set<Layer>());
  const [loaded, setLoaded] = useState(rigLoaded);
  const arrive = (layer: Layer) => {
    arrived.current.add(layer);
    if (arrived.current.size < LAYER_COUNT) return;
    rigLoaded = true;
    setLoaded(true);
  };
  // A layer that never answers does not keep the beat from the screen.
  useEffect(() => {
    if (loaded || reduced) return;
    const ceiling = setTimeout(() => setLoaded(true), RIG_LOAD_CEILING_MS);
    return () => clearTimeout(ceiling);
  }, [loaded, reduced]);
  const shown = loaded || reduced;
  useLayoutEffect(() => {
    if (shown) ready.current?.();
  }, [shown]);

  // A layout effect, so a play that starts on a later render resets the clock before that render paints.
  useLayoutEffect(() => {
    if (!play || !shown) return;
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
    // The shared value is stable; a play is keyed on `play` (and the layers arriving), so a new `onDone` or a re-render
    // is not a new play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, shown]);

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

  const loads = (name: Layer) => ({ onLoad: () => arrive(name), onError: () => arrive(name) });

  const layer: ImageStyle = { position: "absolute", left: 0, top: 0, width: frame.canvas, height: frame.canvas };
  const fill = { position: "absolute", left: 0, top: 0, width: frame.canvas, height: frame.canvas } as const;
  return (
    <View testID="success-rig" {...decorative} style={{ width: frame.width, height: frame.height }}>
      {/* Invisible on its first frame until every layer is in, so the mascot never assembles itself on screen. */}
      <View
        testID="success-rig-layers"
        style={{ position: "absolute", left: frame.left, top: frame.top, width: frame.canvas, height: frame.canvas, opacity: shown ? 1 : 0 }}
      >
        <Animated.View style={[fill, { transformOrigin: pivotAt(successRig.bodyPivot, frame.canvas) }, body]}>
          <Image testID="success-rig-layer-body" source={layers.body} {...loads("body")} fadeDuration={0} style={layer} />
          <Animated.Image
            testID="success-rig-layer-lid"
            source={layers.lid}
            {...loads("lid")}
            fadeDuration={0}
            style={[layer, { transformOrigin: pivotAt(successRig.lidHinge, frame.canvas) }, lid]}
          />
          <Animated.Image
            testID="success-rig-layer-badge"
            source={layers.badge}
            {...loads("badge")}
            fadeDuration={0}
            style={[layer, { transformOrigin: pivotAt(successRig.badgePivot, frame.canvas) }, badge]}
          />
          <Image testID="success-rig-layer-arms-up" source={layers.armsUp} {...loads("armsUp")} fadeDuration={0} style={layer} />
          <Image testID="success-rig-layer-eyes-open" source={layers.eyesOpen} {...loads("eyesOpen")} fadeDuration={0} style={layer} />
          <Image
            testID="success-rig-layer-eyes-closed"
            source={layers.eyesClosed}
            {...loads("eyesClosed")}
            fadeDuration={0}
            style={[layer, { opacity: 0 }]}
          />
        </Animated.View>
        <Animated.Image
          testID="success-rig-layer-sparkles"
          source={layers.sparkles}
          {...loads("sparkles")}
          fadeDuration={0}
          style={[layer, { transformOrigin: "50% 50%" }, sparkles]}
        />
      </View>
    </View>
  );
}
