import { createContext, use, useEffect, type ReactNode } from "react";
import { View, type DimensionValue } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useMoodColors } from "./mood";
import { useReduced } from "./motion";
import { useColors } from "./theme";

/** One breath of the pulse: 1 to 0.55 and back, 700ms each way. */
const PULSE_LOW = 0.55;
const PULSE_HALF = 700;
/** Under reduced motion the blocks hold still at this opacity. */
const STATIC_OPACITY = 0.75;
// A breathing loop has no entrance, so it eases both ways; the Catera entrance curve would snap at every turn.
const breathe = { duration: PULSE_HALF, easing: Easing.inOut(Easing.quad) };

// The group's one shared value; null outside a group, where a block holds still.
const PulseContext = createContext<SharedValue<number> | null>(null);

/**
 * The loading shape of one screen's data area. Every `Skeleton` inside reads one shared opacity pulse (1 to 0.55 to 1
 * over 1400ms), so the blocks breathe together; the loop runs only while the group is mounted, and under reduced motion
 * the blocks hold still at 0.75. Screen readers meet one progress bar named by `label` ("Memuat paket"); the blocks
 * themselves are hidden from them.
 * Without a `label` the group only lends its pulse: it adds no view and nothing for a screen reader. That is for blocks
 * of the same wait that sit outside the data area (a line in a mood header, the area in a meta row), where the data
 * area's own group names the wait. Groups mounted in the same commit start their loop on the same frame, so they
 * breathe in step.
 */
export function SkeletonGroup({ label, children }: { label?: string; children: ReactNode }) {
  const reduced = useReduced();
  const pulse = useSharedValue(reduced ? STATIC_OPACITY : 1);

  useEffect(() => {
    if (reduced) {
      pulse.value = STATIC_OPACITY;
      return;
    }
    pulse.value = 1;
    pulse.value = withRepeat(withSequence(withTiming(PULSE_LOW, breathe), withTiming(1, breathe)), -1);
    return () => cancelAnimation(pulse);
  }, [reduced, pulse]);

  if (label === undefined) return <PulseContext.Provider value={pulse}>{children}</PulseContext.Provider>;
  return (
    <PulseContext.Provider value={pulse}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
        {children}
      </View>
    </PulseContext.Provider>
  );
}

/**
 * One placeholder block in the theme `sage` fill; the mood's `toggleTrack` when it sits on a mood header fill (`onMood`:
 * a mood header, the Dapur count card); the mood's `arcTrack` when it sits on a hero card fill (`onHero`). Light Malam
 * paints its hero in the toggle track's own colour, so a block there would vanish; the arc's track shows on the hero in
 * every theme and mood. `width` defaults to the full row; `radius` to 8. Place it inside a `SkeletonGroup`, which
 * pulses it and names the wait; alone it holds still.
 */
export function Skeleton({
  width = "100%",
  height,
  radius = 8,
  onMood = false,
  onHero = false,
  testID,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  onMood?: boolean;
  onHero?: boolean;
  testID?: string;
}) {
  const palette = useColors();
  const mood = useMoodColors();
  const pulse = use(PulseContext);
  const animated = useAnimatedStyle(() => ({ opacity: pulse ? pulse.value : 1 }));
  const fill = onHero ? mood.arcTrack : onMood ? mood.toggleTrack : palette.sage;
  return (
    <Animated.View
      testID={testID}
      style={[
        { width, height, borderRadius: radius, borderCurve: "continuous", backgroundColor: fill },
        animated,
      ]}
    />
  );
}
