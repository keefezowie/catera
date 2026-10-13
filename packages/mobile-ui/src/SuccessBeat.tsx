import { useLayoutEffect, useRef, type ReactNode } from "react";
import { AccessibilityInfo, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { nativeArt, nativeMotion } from "@catera/design-tokens";
import { successRigBox } from "../../brand/phaseF";
import { MascotArt } from "./brand/MascotArt";
import { Sparkle } from "./brand/Sparkle";
import { SuccessRig } from "./brand/SuccessRig";
import { SuccessRing } from "./brand/SuccessRing";
import { decorative } from "./brand/decorative";
import { Text } from "./components";
import { Confetti } from "./Confetti";
import { useHaptic } from "./motion/useHaptic";
import { useReduced } from "./motion/useReduced";
import { useColors, useThemePreference } from "./theme";

/** The rig's visible height in the beat (spec 6.2). */
const RIG = 180;
/** The disc behind it: a little wider than the rig's body, so the ring reads around the bento. */
const RING = 196;
/** The stage the rig, the disc and the burst share. */
const STAGE = 212;
/** The disc grows over 420ms (spec 6.2). */
export const SUCCESS_RING_MS = 420;
/** The five sparkles burst from 450 to 1050ms (spec 6.2). */
const BURST_AT = 450;
const BURST_MS = 600;
/** The facts fade up as one block from about 620ms, over `content` (spec 6.2). */
export const SUCCESS_FACTS_AT = 620;
/** How far the facts rise while they fade in, in dp. */
const FACTS_RISE = 8;

const ease = Easing.bezier(...nativeMotion.ease);

type Burst = { angle: number; kind: "star" | "dot"; size: number; tone: "ink" | "sun" | "forest" };
/** Five sparkles over the top half of the disc, from upper left to upper right, alternating star and dot. */
const BURST: Burst[] = [
  { angle: -160, kind: "star", size: 16, tone: "ink" },
  { angle: -122, kind: "dot", size: 8, tone: "sun" },
  { angle: -90, kind: "star", size: 14, tone: "forest" },
  { angle: -58, kind: "dot", size: 8, tone: "sun" },
  { angle: -20, kind: "star", size: 16, tone: "ink" },
];
/** Where a sparkle starts and ends, from the stage's centre, in dp. */
const BURST_FROM = 70;
const BURST_TO = 112;

function BurstSparkle({ burst, progress, color }: { burst: Burst; progress: SharedValue<number>; color: string }) {
  const rad = (burst.angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const distance = BURST_FROM + (BURST_TO - BURST_FROM) * p;
    // In fast over the first sixth, then out by the end: at rest (1) the sparkle is gone.
    const opacity = p <= 0 ? 0 : p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
    return {
      opacity,
      transform: [
        { translateX: Math.cos(rad) * distance },
        { translateY: Math.sin(rad) * distance },
        { scale: 0.6 + 0.4 * p },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: "absolute", left: STAGE / 2 - burst.size / 2, top: STAGE / 2 - burst.size / 2 },
        style,
      ]}
    >
      <Sparkle kind={burst.kind} color={color} size={burst.size} />
    </Animated.View>
  );
}

/**
 * The success beat (spec 6.2): the delivered success rig at 180 in front of the code-drawn disc, which grows over
 * 420ms; five sparkles burst from 450 to 1050ms; the title and `children` (the facts) fade up as one block from about
 * 620ms over `content`. One `success` haptic on the first frame of a play, and the title announced to the screen
 * reader at the same moment (as a toast is), so the arrival is heard as well as felt.
 *
 * `play` true starts a play: on mount, or when it turns true later. The caller sets it only on the transition into
 * success while the screen is open (ruling D8). `play` false draws the resting frame: the rig at rest, the disc full,
 * no sparkles, the facts shown, no haptic and no announcement (a reader meets the title as a heading in reading order).
 * `confetti` adds the delivered confetti over the beat for a first milestone; it plays with the beat and is never drawn
 * at rest.
 *
 * Reduced motion: the `merayakan` still at 180 and the facts, nothing moves, no disc, no burst, no confetti; the one
 * haptic and the announcement are kept.
 *
 * The title is the outcome's one heading: the screen around it keeps its own title (Bayar stays Bayar), so the words
 * are never said twice.
 */
export function SuccessBeat({
  title,
  play,
  confetti = false,
  children,
}: {
  title: string;
  play: boolean;
  confetti?: boolean;
  children?: ReactNode;
}) {
  const reduced = useReduced();
  const haptic = useHaptic();
  const c = useColors();
  const { scheme } = useThemePreference();
  const moving = play && !reduced;
  // Mounted already playing, the first painted frame is the beat's first frame, never its resting frame.
  const ring = useSharedValue(moving ? 0 : 1);
  const burst = useSharedValue(moving ? 0 : 1);
  const facts = useSharedValue(moving ? 0 : 1);
  const reducedNow = useRef(reduced);
  const success = useRef(haptic.success);
  const said = useRef(title);
  useLayoutEffect(() => {
    reducedNow.current = reduced;
    success.current = haptic.success;
    said.current = title;
  });

  // A layout effect, so a play that starts on a later render resets every value before that render paints.
  useLayoutEffect(() => {
    if (!play) return;
    success.current();
    AccessibilityInfo.announceForAccessibility(said.current);
    if (reducedNow.current) return;
    for (const v of [ring, burst, facts]) {
      cancelAnimation(v);
      v.value = 0;
    }
    ring.value = withTiming(1, { duration: SUCCESS_RING_MS, easing: ease });
    burst.value = withDelay(BURST_AT, withTiming(1, { duration: BURST_MS, easing: ease }));
    facts.value = withDelay(SUCCESS_FACTS_AT, withTiming(1, { duration: nativeMotion.content, easing: ease }));
    return () => {
      // A play cut short (the screen leaves) rests the beat, so nothing is left half drawn.
      for (const v of [ring, burst, facts]) {
        cancelAnimation(v);
        v.value = 1;
      }
    };
    // The shared values are stable; a play is keyed on `play` alone, so a re-render is never a new play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const factsStyle = useAnimatedStyle(() => ({
    opacity: facts.value,
    transform: [{ translateY: (1 - facts.value) * FACTS_RISE }],
  }));

  const rigWidth = (RIG * successRigBox.w) / successRigBox.h;
  return (
    <View testID="success-beat" style={{ alignItems: "center", gap: 12 }}>
      <View {...decorative} style={{ width: Math.max(STAGE, rigWidth), height: STAGE, alignItems: "center", justifyContent: "center" }}>
        {reduced ? (
          <MascotArt pose="merayakan" size={RIG} />
        ) : (
          <>
            <View style={{ position: "absolute", width: STAGE, height: STAGE, alignItems: "center", justifyContent: "center" }}>
              <SuccessRing size={RING} progress={ring} />
            </View>
            <SuccessRig size={RIG} play={play} />
            <View style={{ position: "absolute", width: STAGE, height: STAGE }}>
              {BURST.map((b) => (
                <BurstSparkle key={b.angle} burst={b} progress={burst} color={b.tone === "forest" ? c.forest : nativeArt.sparkles[scheme][b.tone]} />
              ))}
            </View>
          </>
        )}
      </View>
      <Animated.View testID="success-beat-facts" style={[{ alignSelf: "stretch", gap: 16 }, factsStyle]}>
        <Text variant="outcome" style={{ textAlign: "center" }}>
          {title}
        </Text>
        {children}
      </Animated.View>
      {/* Over the beat, square to the vector's own canvas, so its burst rains over the rig and the title. */}
      <Confetti play={play && confetti} style={{ bottom: undefined, aspectRatio: 1 }} />
    </View>
  );
}
