import { useCallback, useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { nativeMotion, nativeThemes, type ThemeName } from "@catera/design-tokens";
import { decorative } from "./brand/decorative";
import { Sparkle } from "./brand/Sparkle";
import { useReduced } from "./motion";

/**
 * The splash marks the native splash draws (app.config.ts `expo-splash-screen` `image` and `dark.image`): processed
 * transparent derivatives of the generated originals, 1024px square, used here at the splash's own size so the first
 * frame under the lifting splash is the same picture.
 */
const marks: Record<ThemeName, number> = {
  light: require("../../brand/assets/phase-f/splash-mark-light.png"),
  dark: require("../../brand/assets/phase-f/splash-mark-dark.png"),
};

/** The native splash's `imageWidth` in both app configs, in dp. The marks are square, so this is also their height. */
export const SPLASH_MARK_SIZE = 200;

/** How long the cover waits for its mark to decode once the splash has lifted before it steps aside without playing. */
const DECODE_GRACE = 150;

const ease = Easing.bezier(...nativeMotion.ease);

/**
 * Where the three sparkles start (offset from the mark's centre, in dp) and which way they drift. The mascot fills
 * about 80dp of the 200dp mark (x and y within 40 of the centre); the sparkles sit just outside it by the lid's raised
 * corner, the lid's low end and the box's right side, and leave outward along the same line.
 */
const SPARKLES = [
  { kind: "star", x: 46, y: -46, dx: 18, dy: -18, size: 14 },
  { kind: "dot", x: -46, y: -26, dx: -18, dy: -10, size: 6 },
  { kind: "star", x: 52, y: 10, dx: 20, dy: 4, size: 10 },
] as const;

/**
 * The cold-start hand-off (spec 3.2). `scheme` is the scheme the native splash was drawn in (the system's at launch);
 * the cover shows that scheme's canvas with the splash mark at the native splash's size and position,
 * laid over the first screen, which is already mounted underneath. While `hold` is true (the native splash is still
 * up) it stays still; once released it lets every touch through, scales the mark 1 to 1.04 and fades out over
 * `feature` 320ms while three sparkles drift outward and fade, then calls `onDone`. Under reduced motion it renders
 * nothing and calls `onDone` at once; when the mark has not decoded shortly after the release it steps aside without
 * playing. Decorative: hidden from screen readers.
 */
export function LaunchCover({
  scheme,
  onDone,
  hold = false,
}: {
  scheme: ThemeName;
  onDone: () => void;
  /** True while the native splash still covers the app; the beat starts when it turns false. */
  hold?: boolean;
}) {
  const reduced = useReduced();
  const [decoded, setDecoded] = useState(false);
  const progress = useSharedValue(0);
  const done = useRef(onDone);
  done.current = onDone;
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    done.current();
  };
  const playing = !hold && decoded && !reduced;

  useEffect(() => {
    if (reduced) finish();
  }, [reduced]);

  // The splash lifted before the mark could be drawn: no beat, the first screen shows as it is.
  useEffect(() => {
    if (hold || reduced || decoded) return;
    const timer = setTimeout(finish, DECODE_GRACE);
    return () => clearTimeout(timer);
  }, [hold, reduced, decoded]);

  useEffect(() => {
    if (!playing) return;
    progress.value = withTiming(1, { duration: nativeMotion.feature, easing: ease });
    const timer = setTimeout(finish, nativeMotion.feature);
    return () => clearTimeout(timer);
  }, [playing, progress]);

  const cover = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const mark = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.04 * progress.value }] }));
  const sparkleStyles = [
    useAnimatedStyle(() => sparkleFrame(progress.value, SPARKLES[0])),
    useAnimatedStyle(() => sparkleFrame(progress.value, SPARKLES[1])),
    useAnimatedStyle(() => sparkleFrame(progress.value, SPARKLES[2])),
  ];

  if (reduced) return null;
  // The native splash is drawn by the system in its own scheme, which a stored app theme does not change, so the cover
  // reads that scheme's palette rather than the active one: the hand-off must be the same picture as the splash.
  const palette = nativeThemes[scheme];
  // Sparkles in the palette's sunrise ink, sunrise and forest only (spec 7.1); in dark, forest is the light ink.
  const inks = [palette.sunriseInk, palette.sunrise, palette.forest];
  return (
    <View
      testID="launch-cover"
      {...decorative}
      pointerEvents={hold ? "auto" : "none"}
      style={[StyleSheet.absoluteFill, styles.center]}
    >
      <Animated.View testID="launch-cover-canvas" style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: palette.canvas }, cover]}>
        <Animated.View style={mark}>
          <Image
            testID="launch-cover-mark"
            source={marks[scheme]}
            style={{ width: SPLASH_MARK_SIZE, height: SPLASH_MARK_SIZE }}
            resizeMode="contain"
            fadeDuration={0}
            onLoad={() => setDecoded(true)}
            onError={finish}
          />
        </Animated.View>
      </Animated.View>
      {SPARKLES.map((s, i) => (
        <Animated.View
          key={i}
          style={[styles.sparkle, { marginLeft: s.x - s.size / 2, marginTop: s.y - s.size / 2 }, sparkleStyles[i]]}
        >
          <Sparkle kind={s.kind} color={inks[i]} size={s.size} />
        </Animated.View>
      ))}
    </View>
  );
}

/** One sparkle at `p` (0 to 1): it shows quickly, drifts out along its line and fades by the end. */
function sparkleFrame(p: number, s: (typeof SPARKLES)[number]) {
  "worklet";
  return {
    opacity: p === 0 ? 0 : interpolate(p, [0, 0.2, 1], [0, 1, 0]),
    transform: [{ translateX: s.dx * p }, { translateY: s.dy * p }],
  };
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  // Anchored at the centre of the screen, the same point as the mark; the margins place it on the mascot's outline.
  sparkle: { position: "absolute", left: "50%", top: "50%" },
});

/** The longest the native splash is held while the phone's own reads (fonts, theme, session) finish (spec 3.1). */
export const SPLASH_CEILING = 1500;

/**
 * Holds the native splash until `ready` (fonts, the stored theme and the stored session have been read), or for
 * `ceiling` ms after mount, whichever comes first, then calls `hide` once. Returns whether the splash has been
 * released, so a launch cover can start its beat.
 */
export function useSplashHold(ready: boolean, hide: () => void, ceiling = SPLASH_CEILING): boolean {
  const [released, setReleased] = useState(false);
  const hideRef = useRef(hide);
  hideRef.current = hide;
  const once = useRef(false);
  const release = useCallback(() => {
    if (once.current) return;
    once.current = true;
    hideRef.current();
    setReleased(true);
  }, []);
  useEffect(() => {
    const timer = setTimeout(release, ceiling);
    return () => clearTimeout(timer);
  }, [release, ceiling]);
  useEffect(() => {
    if (ready) release();
  }, [ready, release]);
  return released;
}
