import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { PanResponder, Pressable, useWindowDimensions, View, type GestureResponderEvent } from "react-native";
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
 * - Nothing moves on its own: no timer advances a part. The content region is one press target: a tap on its right half
 *   goes forward and on its left half goes back, wherever on the content it lands. A button inside the content is a
 *   deeper responder and keeps its own press. The region is not an accessibility element (its buttons stay), so
 *   screen readers get the header as an adjustable (swipe up or down) and the close button instead. The first part has
 *   no back and the last has no forward.
 * - `children` must not contain a ScrollView: the content press target owns the touch, and on Android it becomes the
 *   responder over a scroll view, which would then never scroll. A part fits the screen: the photo flexes and long
 *   text wraps.
 * - A downward drag of more than 80dp, or a fast flick down, closes it through `PanResponder` (no gesture library).
 * - It opens with a fade and a scale from 0.92 to 1 over `nativeMotion.feature`; instantly under reduced motion.
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
  const { width } = useWindowDimensions();
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
        // The bubble variant, so a control that wants a move itself can claim it first. It does not make a scroll
        // view in the content work: the content press target below owns the touch (see the docblock). React Native
        // refreshes the gesture state in the capture phase (PanResponder's own capture handler) before this one
        // runs, so dy and dx are current here.
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 10 && g.dy > Math.abs(g.dx) * 1.5,
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
      <Animated.View
        testID="story-viewer-stage"
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16, paddingRight: 4 }}>
          <View
            testID="story-viewer-header"
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={header}
            accessibilityValue={{ min: 1, max: count, now: index + 1, text: `${index + 1}/${count}` }}
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
        <Pressable
          testID="story-viewer-content"
          accessible={false}
          importantForAccessibility="no"
          onPress={(e: GestureResponderEvent) => (e.nativeEvent.pageX < width / 2 ? back() : forward())}
          style={{ flex: 1 }}
        >
          <FadeSwap swapKey={String(index)} style={{ flex: 1 }}>
            {children}
          </FadeSwap>
        </Pressable>
      </Animated.View>
    </View>
  );
}
