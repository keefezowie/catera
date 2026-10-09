import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { PanResponder, Pressable, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nativeMotion, nativeThemes } from "@catera/design-tokens";
import { Text } from "./components";
import { FadeSwap, PressableScale, useReduced } from "./motion";

// A story sits on black whatever the theme, so its inks do not follow it (as in StoryCover).
const ink = nativeThemes.light;
const ease = Easing.bezier(...nativeMotion.ease);
const BAR_HEIGHT = 3;
const START_SCALE = 0.92;
/** A drag this far down closes the story... */
const DISMISS_DISTANCE = 80;
/** ...and so does a quicker, shorter flick (dp per millisecond), as long as it clearly went down. */
const DISMISS_VELOCITY = 0.6;
const FLICK_MIN_DISTANCE = 20;

/**
 * A full-screen story: one bar per part along the top (the first `index + 1` solid), a header line beside a 48dp close
 * button, and the current part below, which the caller owns (`children`, swapped through `FadeSwap` when `index` changes).
 * - Nothing moves on its own: no timer advances a part. A tap on the right half goes forward and on the left half goes
 *   back; both halves are invisible and hidden from screen readers, who get the header as an adjustable (swipe up or
 *   down) and the close button instead. The first part has no back and the last has no forward.
 * - A downward drag of more than 80dp, or a fast flick down, closes it through `PanResponder` (no gesture library).
 * - It opens with a fade and a scale from 0.92 to 1 over `nativeMotion.feature`; instantly under reduced motion.
 * The tap halves sit behind the content. Content that is only to be looked at (a photo, a title) should set
 * `pointerEvents="none"` so a tap on it still turns the page; content with its own button keeps its touches.
 */
export function StoryViewer({
  count,
  index,
  onIndexChange,
  onClose,
  header,
  closeLabel,
  children,
}: {
  count: number;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  header: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReduced();
  const enter = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (!reduced) enter.value = withTiming(1, { duration: nativeMotion.feature, easing: ease });
    // The opening plays once, when the viewer mounts; a later change of the motion setting does not replay it.
  }, []);
  const stage = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: START_SCALE + (1 - START_SCALE) * enter.value }],
  }));

  const forward = () => {
    if (index < count - 1) onIndexChange(index + 1);
  };
  const back = () => {
    if (index > 0) onIndexChange(index - 1);
  };

  // The responder is built once and reads the latest close handler through this ref.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pan = useMemo(
    () =>
      PanResponder.create({
        // The capture variant, because PanResponder only refreshes the gesture state before the capture check.
        onMoveShouldSetPanResponderCapture: (_e, g) => g.dy > 10 && g.dy > Math.abs(g.dx) * 1.5,
        onPanResponderRelease: (_e, g) => {
          const flung = g.vy > DISMISS_VELOCITY && g.dy > FLICK_MIN_DISTANCE;
          if (g.dy > DISMISS_DISTANCE || flung) closeRef.current();
        },
      }),
    [],
  );

  return (
    <View
      testID="story-viewer"
      {...pan.panHandlers}
      accessibilityViewIsModal
      onAccessibilityEscape={onClose}
      style={{ flex: 1, backgroundColor: "black" }}
    >
      <Pressable
        testID="story-viewer-prev"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
        onPress={back}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "50%" }}
      />
      <Pressable
        testID="story-viewer-next"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
        onPress={forward}
        style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "50%" }}
      />
      <Animated.View
        testID="story-viewer-stage"
        pointerEvents="box-none"
        style={[{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom }, stage]}
      >
        <View
          testID="story-viewer-bars"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: "row", gap: 4, paddingHorizontal: 12 }}
        >
          {Array.from({ length: count }, (_, i) => (
            <View
              key={i}
              testID={`story-viewer-bar-${i}`}
              style={{
                flex: 1,
                height: BAR_HEIGHT,
                borderRadius: BAR_HEIGHT / 2,
                backgroundColor: ink.cream,
                opacity: i <= index ? 1 : 0.4,
              }}
            />
          ))}
        </View>
        <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16, paddingRight: 4 }}>
          <View
            testID="story-viewer-header"
            pointerEvents="none"
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={header}
            accessibilityValue={{ min: 1, max: count, now: index + 1 }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === "increment") forward();
              else if (e.nativeEvent.actionName === "decrement") back();
            }}
            style={{ flex: 1 }}
          >
            <Text variant="label" style={{ color: ink.cream }}>
              {header}
            </Text>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            haptic="tap"
            onPress={onClose}
            style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="close" size={26} color={ink.cream} />
          </PressableScale>
        </View>
        <View pointerEvents="box-none" style={{ flex: 1 }}>
          <FadeSwap swapKey={String(index)}>{children}</FadeSwap>
        </View>
      </Animated.View>
    </View>
  );
}
