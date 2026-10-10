import { useEffect, useState } from "react";
import { AppState, Image, StyleSheet, Text as RNText, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { mascotMotion as motion } from "../../../brand/motion";
import { Text } from "../components";
import { useReduced } from "../motion";
import { useScreenFocused } from "../navigation";
import { useColors } from "../theme";

/**
 * The registered 480px layers of the approved loop (docs/MASCOT-MOTION.md): the neutral poster, the body, the half and
 * closed eye patches, and the sparkles. They share one square canvas, so each fills the box.
 */
const layers = {
  neutral: require("../../../brand/assets/mascot-motion/neutral.png"),
  body: require("../../../brand/assets/mascot-motion/body.png"),
  half: require("../../../brand/assets/mascot-motion/half.png"),
  closed: require("../../../brand/assets/mascot-motion/closed.png"),
  sparkles: require("../../../brand/assets/mascot-motion/sparkles.png"),
};
type RigLayer = "body" | "half" | "closed" | "sparkles";
const RIG_LAYERS = 4;

const DEFAULT_SIZE = 140;

/**
 * The looping mascot: a 2400ms loop with a rise (4 at 160, scaled to `size`), a 1.5 degree tilt, one blink and a
 * gentle sparkle. It plays only while `active`, the app is in front, its screen is focused, motion is not reduced and
 * every layer has loaded; otherwise it rests on the neutral poster, which is also the fallback when a layer fails.
 * Unmounting cancels the loop and removes its listeners.
 */
function MascotAnimation({ size, active }: { size: number; active: boolean }) {
  const reduced = useReduced();
  const focused = useScreenFocused();
  // One rule for "in front", at mount and on every change: only "active" counts ("inactive" and "background" pause).
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [loaded, setLoaded] = useState<ReadonlySet<RigLayer>>(() => new Set());
  const [failed, setFailed] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);

  const playing = active && foreground && focused && !reduced && !failed && loaded.size === RIG_LAYERS;

  useEffect(() => {
    progress.value = 0;
    if (playing) progress.value = withRepeat(withTiming(1, { duration: motion.duration, easing: Easing.linear }), -1);
    return () => cancelAnimation(progress);
  }, [playing, progress]);

  const rise = (motion.rise * size) / motion.size;
  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: (-rise * (1 - Math.cos(progress.value * Math.PI * 2))) / 2 },
      { rotate: `${-motion.tilt * Math.sin(progress.value * Math.PI * 2)}deg` },
    ],
  }));
  const half = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [...motion.halfOpacityTimes], [0, 0, 1, 1, 0, 0]),
  }));
  const closed = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [...motion.closedOpacityTimes], [0, 0, 1, 1, 0, 0]),
  }));
  const sparkle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (0.05 * (1 - Math.cos(progress.value * Math.PI * 2))) / 2 }],
    opacity: interpolate(progress.value, [0, 0.5, 1], [1, 0.9, 1]),
  }));

  const onLoad = (name: RigLayer) => () =>
    setLoaded((old) => (old.has(name) ? old : new Set(old).add(name)));
  const onError = () => setFailed(true);

  return (
    <View testID="mascot-art" style={{ width: size, height: size }}>
      <Image testID="mascot-poster" source={layers.neutral} style={[styles.layer, { opacity: playing ? 0 : 1 }]} />
      <View testID="mascot-rig" style={[StyleSheet.absoluteFill, { opacity: playing ? 1 : 0 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: "50% 80%" }, body]}>
          <Image testID="mascot-layer" source={layers.body} style={styles.layer} onLoad={onLoad("body")} onError={onError} />
          <Animated.Image
            testID="mascot-layer"
            source={layers.half}
            style={[styles.layer, half]}
            onLoad={onLoad("half")}
            onError={onError}
          />
          <Animated.Image
            testID="mascot-layer"
            source={layers.closed}
            style={[styles.layer, closed]}
            onLoad={onLoad("closed")}
            onError={onError}
          />
        </Animated.View>
        <Animated.Image
          testID="mascot-layer"
          source={layers.sparkles}
          style={[styles.layer, { transformOrigin: "84% 39%" }, sparkle]}
          onLoad={onLoad("sparkles")}
          onError={onError}
        />
      </View>
    </View>
  );
}

/**
 * The full-area wait for when nothing can be shown yet (the launch gate, a code being checked, a payment being
 * checked). Screen readers hear `label` at once as a busy progress bar; the drawing and its words appear only after
 * 300ms, so a fast answer shows nothing, and there is no minimum time on screen. Under reduced motion it is the still
 * neutral pose with its label. `startup` is the launch gate before the app's fonts load: it fills the theme canvas and
 * sets the label in the system font. Navigation and data never wait for the loop.
 */
export function MascotLoading({
  label,
  size = DEFAULT_SIZE,
  startup = false,
}: {
  label: string;
  size?: number;
  startup?: boolean;
}) {
  const palette = useColors();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), motion.delay);
    return () => clearTimeout(timer);
  }, []);

  const words = { color: palette.charcoal, fontSize: 14, lineHeight: 20, textAlign: "center" as const, maxWidth: 280 };
  return (
    <View
      testID="mascot-loading"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      style={[styles.loading, startup && { backgroundColor: palette.canvas }]}
    >
      <View
        testID="mascot-loading-visual"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.visual, { opacity: visible ? 1 : 0 }]}
      >
        <MascotAnimation size={size} active={visible} />
        {/* Before the fonts load only the system face exists, so the startup label must not ask for Jakarta. */}
        {startup ? <RNText style={words}>{label}</RNText> : <Text style={words}>{label}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", width: "100%", height: "100%", resizeMode: "contain" },
  loading: { flex: 1, minHeight: 280, alignItems: "center", justifyContent: "center", padding: 24 },
  visual: { alignItems: "center", gap: 16 },
});
