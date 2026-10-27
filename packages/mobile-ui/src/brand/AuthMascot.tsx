import { useEffect, useRef } from "react";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { useReduced } from "../motion/useReduced";
import type { MascotPose } from "./MascotArt";
import { decorative } from "./decorative";
import { StateArt } from "./StateArt";

/** The mark above a sign-in title: the waving mascot at 56dp. */
const AUTH_MARK_SIZE = 56;

const ease = Easing.bezier(...nativeMotion.ease);

type Keys = { rotate?: number[]; x?: number[]; y?: number[]; scaleY?: number[] };

/**
 * The one arrival gesture per pose (spec 4, owner pick 6A): evenly spaced keyframes read by one eased progress that
 * runs 0 to 1 over `ms`. Rotation is in degrees.
 */
const GESTURES: Partial<Record<MascotPose, { ms: number; keys: Keys }>> = {
  bingung: { ms: 520, keys: { rotate: [0, -6, 3, 0] } },
  merayakan: { ms: 560, keys: { y: [0, -16, 0], scaleY: [0.98, 1.02, 1] } },
  membaca: { ms: 480, keys: { y: [4, -2, 0] } },
  mencari: { ms: 640, keys: { x: [0, -6, 5, 0] } },
  melambai: { ms: 520, keys: { rotate: [0, 2, 0] } },
};

const along = (p: number, values: number[]) => {
  "worklet";
  return interpolate(p, values.map((_, i) => i / (values.length - 1)), values);
};

/**
 * The auth screens' mascot: a mount draws the pose still. When the pose changes on the mounted mark the art dissolves
 * (MascotArt's 200ms) and the mark plays that pose's one short gesture. No loop; the same pose again plays nothing;
 * reduced motion swaps with no gesture. Decorative (StateArt hides it from screen readers). `testID` `auth-mascot-{pose}`.
 */
export function AuthMascot({ pose, base = AUTH_MARK_SIZE }: { pose: MascotPose; base?: number }) {
  const reduced = useReduced();
  const progress = useSharedValue(1);
  const shown = useRef(pose);
  const gesture = GESTURES[pose];
  useEffect(() => {
    if (shown.current === pose) return;
    shown.current = pose;
    if (reduced || !gesture) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: gesture.ms, easing: ease });
  }, [pose, reduced, gesture, progress]);
  const keys = gesture?.keys ?? {};
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const transform = [];
    if (keys.x) transform.push({ translateX: along(p, keys.x) });
    if (keys.y) transform.push({ translateY: along(p, keys.y) });
    if (keys.rotate) transform.push({ rotate: `${along(p, keys.rotate)}deg` });
    if (keys.scaleY) transform.push({ scaleY: along(p, keys.scaleY) });
    return { transform };
  });
  return (
    <Animated.View testID={`auth-mascot-${pose}`} {...decorative} style={[{ alignSelf: "flex-start" }, style]}>
      <StateArt pose={pose} base={base} style={{ alignSelf: "flex-start" }} />
    </Animated.View>
  );
}
