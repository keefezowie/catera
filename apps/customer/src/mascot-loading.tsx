import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { mascotMotion as motion } from "../../../packages/brand/motion";

const assets = {
  neutral: require("../../../packages/brand/assets/mascot-motion/neutral.png"),
  body: require("../../../packages/brand/assets/mascot-motion/body.png"),
  half: require("../../../packages/brand/assets/mascot-motion/half.png"),
  closed: require("../../../packages/brand/assets/mascot-motion/closed.png"),
  sparkles: require("../../../packages/brand/assets/mascot-motion/sparkles.png"),
};

export function MascotAnimation({
  size = motion.size,
  active = true,
}: {
  size?: number;
  active?: boolean;
}) {
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState(false);
  const progress = useSharedValue(0);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    const preference = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    const state = AppState.addEventListener("change", (value) =>
      setForeground(value === "active"),
    );
    return () => {
      mounted = false;
      preference.remove();
      state.remove();
    };
  }, []);
  const playing =
    active && foreground && !reduced && !failed && loaded.size === 4;
  useEffect(() => {
    progress.value = 0;
    if (playing)
      progress.value = withRepeat(
        withTiming(1, { duration: motion.duration, easing: Easing.linear }),
        -1,
      );
    return () => cancelAnimation(progress);
  }, [playing, progress]);
  const body = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          (((-motion.rise * size) / motion.size) *
            (1 - Math.cos(progress.value * Math.PI * 2))) /
          2,
      },
      { rotate: `${-motion.tilt * Math.sin(progress.value * Math.PI * 2)}deg` },
    ],
  }));
  const half = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [...motion.halfOpacityTimes],
      [0, 0, 1, 1, 0, 0],
    ),
  }));
  const closed = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [...motion.closedOpacityTimes],
      [0, 0, 1, 1, 0, 0],
    ),
  }));
  const sparkle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: 1 + (0.05 * (1 - Math.cos(progress.value * Math.PI * 2))) / 2,
      },
    ],
    opacity: interpolate(progress.value, [0, 0.5, 1], [1, 0.9, 1]),
  }));
  const loadedLayer = (name: string) => () =>
    setLoaded((old) => new Set(old).add(name));
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Image
        source={assets.neutral}
        style={[styles.layer, { opacity: playing ? 0 : 1 }]}
        resizeMode="contain"
      />
      <View
        testID="mascot-rig"
        style={[StyleSheet.absoluteFill, { opacity: playing ? 1 : 0 }]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transformOrigin: "50% 80%" },
            body,
          ]}
        >
          <Image
            testID="mascot-layer"
            source={assets.body}
            style={styles.layer}
            onLoad={loadedLayer("body")}
            onError={() => setFailed(true)}
          />
          <Animated.Image
            testID="mascot-layer"
            source={assets.half}
            style={[styles.layer, half]}
            onLoad={loadedLayer("half")}
            onError={() => setFailed(true)}
          />
          <Animated.Image
            testID="mascot-layer"
            source={assets.closed}
            style={[styles.layer, closed]}
            onLoad={loadedLayer("closed")}
            onError={() => setFailed(true)}
          />
        </Animated.View>
        <Animated.Image
          testID="mascot-layer"
          source={assets.sparkles}
          style={[styles.layer, { transformOrigin: "84% 39%" }, sparkle]}
          onLoad={loadedLayer("sparkles")}
          onError={() => setFailed(true)}
        />
      </View>
    </View>
  );
}

export function MascotLoading({
  label = motion.label,
  size = motion.size,
  active = true,
  startup = false,
}: {
  label?: string;
  size?: number;
  active?: boolean;
  startup?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), motion.delay);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View
      testID="mascot-loading"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      style={[styles.loading, startup && styles.startup]}
    >
      <View
        testID="mascot-loading-visual"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.visual, { opacity: visible ? 1 : 0 }]}
      >
        <MascotAnimation size={size} active={active && visible} />
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  loading: {
    flex: 1,
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  startup: { backgroundColor: "#FFF7E9" },
  visual: { alignItems: "center", gap: 16 },
  label: { color: "#2E2E2E", fontSize: 14, textAlign: "center", maxWidth: 280 },
});
