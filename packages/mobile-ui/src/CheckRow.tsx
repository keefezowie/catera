import { useEffect, useRef } from "react";
import { Image, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { nativeMotion } from "@catera/design-tokens";
import { Text } from "./components";
import { PressableScale, useReduced } from "./motion";
import { useColors } from "./theme";

const ease = Easing.bezier(...nativeMotion.ease);
const BOX = 48;
const PHOTO = 44;
const DONE_OPACITY = 0.55;

/**
 * One line of the kitchen's checklist: how many, what, and a round box to tick. The whole row is the button (56dp or
 * more), so a thumb anywhere on it ticks it.
 * - Ticking fills the ring forest with a cream check over `nativeMotion.control` and dims the row to 0.55 with the name
 *   struck through over `nativeMotion.content`. Instant under reduced motion; nothing loops.
 * - `image` is the dish photo; without one the meal's icon (sun for lunch, moon for dinner) stands in.
 * - The name wraps and is never truncated. The accessibility label is "8× name" and the state is a checkbox's.
 * `testID` names the row; its parts are `<testID>-content`, `-box`, `-tick`, `-check-mark`, `-icon` and `-image`.
 */
export function CheckRow({
  quantity,
  name,
  image,
  icon,
  checked,
  onToggle,
  testID = "check-row",
}: {
  quantity: number;
  name: string;
  image?: string;
  icon: "sunny-outline" | "moon-outline";
  checked: boolean;
  onToggle: () => void;
  testID?: string;
}) {
  const c = useColors();
  const reduced = useReduced();
  const tick = useSharedValue(checked ? 1 : 0);
  const dim = useSharedValue(checked ? DONE_OPACITY : 1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    tick.value = reduced ? (checked ? 1 : 0) : withTiming(checked ? 1 : 0, { duration: nativeMotion.control, easing: ease });
    dim.value = reduced
      ? checked
        ? DONE_OPACITY
        : 1
      : withTiming(checked ? DONE_OPACITY : 1, { duration: nativeMotion.content, easing: ease });
  }, [checked, reduced, tick, dim]);

  const tickStyle = useAnimatedStyle(() => ({ opacity: tick.value }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={`${quantity}× ${name}`}
      accessibilityState={{ checked }}
      haptic="tap"
      onPress={onToggle}
      style={{ minHeight: 56 }}
    >
      <Animated.View
        testID={`${testID}-content`}
        style={[{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }, dimStyle]}
      >
        <Text variant="heading" style={{ minWidth: 40, textAlign: "right", fontVariant: ["tabular-nums"] }}>
          {quantity}
        </Text>
        {image ? (
          // The line colour shows while the photo loads or if it never does.
          <View
            style={{ width: PHOTO, height: PHOTO, borderRadius: 10, borderCurve: "continuous", overflow: "hidden", backgroundColor: c.line }}
          >
            <Image
              testID={`${testID}-image`}
              accessibilityIgnoresInvertColors
              source={{ uri: image }}
              resizeMode="cover"
              style={{ width: PHOTO, height: PHOTO }}
            />
          </View>
        ) : (
          <View
            testID={`${testID}-icon`}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: PHOTO,
              height: PHOTO,
              borderRadius: 10,
              borderCurve: "continuous",
              backgroundColor: c.sage,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={icon} size={22} color={c.forest} />
          </View>
        )}
        <Text variant="body" style={{ flex: 1, textDecorationLine: checked ? "line-through" : "none" }}>
          {name}
        </Text>
        <View
          testID={`${testID}-box`}
          style={{
            width: BOX,
            height: BOX,
            borderRadius: BOX / 2,
            borderWidth: 2,
            borderColor: c.controlRing,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Animated.View
            testID={`${testID}-tick`}
            style={[
              { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c.forest, alignItems: "center", justifyContent: "center" },
              tickStyle,
            ]}
          >
            <View testID={`${testID}-check-mark`}>
              <Ionicons name="checkmark" size={26} color={c.cream} />
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </PressableScale>
  );
}
