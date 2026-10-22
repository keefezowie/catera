import { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { decorative } from "./brand/decorative";
import { PressableScale } from "./motion/PressableScale";
import { useHaptic } from "./motion/useHaptic";
import { useReduced } from "./motion/useReduced";
import { themedStyles, useColors } from "./theme";

/** The heart grows to this scale and springs back on a save (spec 6.3). */
const POP = 1.22;
/** The dots burst out and fade within this time (spec 6.3). */
export const HEART_BURST_MS = nativeMotion.feature;
/** Where a dot starts and ends, from the heart's centre, in dp: it ends past the disc's rim (radius 24), so the burst
 * reads outside the control. The 48dp hit area does not grow; the dots are drawn outside it. */
const DOT_FROM = 10;
const DOT_TO = 31;
const DOT = 5;
/** Five dots around the heart, the first straight up. */
const DOT_ANGLES = [-90, -18, 54, 126, 198];

const ease = Easing.bezier(...nativeMotion.ease);

function Dot({ angle, progress, color }: { angle: number; progress: SharedValue<number>; color: string }) {
  const rad = (angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const distance = DOT_FROM + (DOT_TO - DOT_FROM) * p;
    return {
      opacity: p >= 1 ? 0 : 1 - p,
      transform: [{ translateX: Math.cos(rad) * distance }, { translateY: Math.sin(rad) * distance }],
    };
  });
  return (
    <Animated.View
      testID="heart-dot"
      style={[
        { position: "absolute", left: 24 - DOT / 2, top: 24 - DOT / 2, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

/**
 * The save heart (spec 6.3), a 48dp round control. Saving fills it (forest, like every selection: a saved heart is a selection, spec 2.1), scales it 1 to 1.22 and
 * springs it back, and bursts five dots (forest and its pressed step) that fade within 680ms (`nativeMotion.feature`), with the `select` haptic. Unsaving
 * swaps to the outline at once, with no haptic. Under reduced motion both are a plain swap; the save keeps its haptic.
 *
 * The pop follows the press, never a change of `saved` from a read, so a refresh or an undo never pops it. `canSave`
 * false is a press that cannot save here (signed out: the press asks to sign in), so it neither pops nor buzzes.
 */
export function SaveHeart({
  saved,
  onToggle,
  label,
  canSave = true,
  compact = false,
  style,
}: {
  saved: boolean;
  onToggle: () => void;
  label: string;
  canSave?: boolean;
  /** A 44dp target with a 32dp surface disc and a 20 glyph, for a package tile's corner; the default is the 48dp disc. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const styles = useStyles();
  const reduced = useReduced();
  const haptic = useHaptic();
  const scale = useSharedValue(1);
  const burst = useSharedValue(1);
  // The dots are drawn from the first save on; at rest (1) they are gone.
  const [burstShown, setBurstShown] = useState(false);
  const heart = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const press = () => {
    if (!saved && canSave) {
      haptic.select();
      if (!reduced) {
        scale.value = withSequence(
          withTiming(POP, { duration: nativeMotion.control, easing: ease }),
          withSpring(1, nativeMotion.spring),
        );
        burst.value = 0;
        burst.value = withTiming(1, { duration: HEART_BURST_MS, easing: ease });
        setBurstShown(true);
      }
    }
    onToggle();
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: saved }}
      haptic="none"
      onPress={press}
      style={[compact ? styles.target : styles.round, style]}
    >
      {burstShown && !reduced ? (
        <View {...decorative} pointerEvents="none" style={compact ? styles.burstCompact : styles.burst}>
          {DOT_ANGLES.map((angle, i) => (
            <Dot key={angle} angle={angle} progress={burst} color={i % 2 ? c.forestDeep : c.forest} />
          ))}
        </View>
      ) : null}
      {compact ? <View testID="save-heart-disc" pointerEvents="none" style={styles.disc} /> : null}
      <Animated.View style={heart}>
        <Ionicons
          testID="save-heart-icon"
          name={saved ? "heart" : "heart-outline"}
          size={compact ? 20 : 22}
          color={c.forest}
        />
      </Animated.View>
    </PressableScale>
  );
}

const useStyles = themedStyles((c) => ({
  // The look of `RoundButton`: a 48dp surface disc with a hairline, so the heart reads on any photo.
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  burst: { position: "absolute", left: -1, top: -1, width: 48, height: 48 },
  // The compact target is 44, so the same 48 burst box sits 2 outside it to keep its centre on the heart.
  burstCompact: { position: "absolute", left: -2, top: -2, width: 48, height: 48 },
  // A tile's heart: a 44 touch target around a 32 surface disc, so it reads on any photo without a hairline.
  target: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute", width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface },
}));
