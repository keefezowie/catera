import { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { nativeMotion } from "@catera/design-tokens";
import { Photo } from "./PhotoRing";
import { Text } from "./components";
import { useTouchTarget } from "./layoutScale";
import { PressableScale, useReduced } from "./motion";
import { useColors } from "./theme";
import { fontFor } from "./type";

const ease = Easing.bezier(...nativeMotion.ease);
const BOX = 48;
const PHOTO = 44;
const DONE_OPACITY = 0.55;
/** The Dapur geometry (a 48 touch target): a 56 row, the quantity in a 48 column so four digits fit without moving the name, a 40 r8 photo. */
const V2_ROW = 56;
const V2_QUANTITY = 48;
const V2_PHOTO = 40;
/** Where the dish photo's right edge and the name begin in a v2 row: the quantity, the gap, the photo and the gap. */
export const CHECK_ROW_INSET = V2_QUANTITY + 12 + V2_PHOTO + 12;

/**
 * One line of the kitchen's checklist: how many, what, and a round box to tick. The whole row is the button (56dp or
 * more), so a thumb anywhere on it ticks it.
 * - Ticking fills the ring forest with a cream check over `nativeMotion.control` and dims only the photo or icon to
 *   0.55 over `nativeMotion.content`. The text never dims, so it keeps 4.5:1: the name turns `muted` and is struck
 *   through and the quantity turns `muted`, at once, since only opacity and transform animate. Instant under reduced
 *   motion; nothing loops.
 * - `image` is the dish photo; without one the meal's icon (sun for lunch, moon for dinner) stands in.
 * - The name wraps and is never truncated. The accessibility label is "8× name" and the state is a checkbox's.
 * - Where the root asks for a 48 touch target (Catera Dapur's) the row is 56 with the same parts at the board's sizes: the quantity is a
 *   48-wide right-aligned `section` figure (it shrinks before it would push the name), the photo or icon 40 with radius
 *   8, the name `bodyStrong`, the tick 48. A `ListCard` of these rows insets its hairlines by `CHECK_ROW_INSET`, and the
 *   caller passes it `clip={false}`: the Dapur photo carries its own radius and has no clipping wrapper, because an image
 *   that finishes loading inside an overflow-hidden rounded view can stay blank on Android. Under any other target (the
 *   customer app's 44, with or without the `v2` scale) the row is exactly as it was, wrapper included.
 * `testID` names the row; its parts are `<testID>-content`, `-media`, `-box`, `-tick`, `-check-mark`, `-icon` and
 * `-image`.
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
  const v2 = useTouchTarget() >= 48;
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
  // A ticked row's text switches to the muted ink at once; colour is not animated.
  const done = checked ? { color: c.muted } : null;
  const photo = v2 ? V2_PHOTO : PHOTO;
  const radius = v2 ? 8 : 10;

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
      <View
        testID={`${testID}-content`}
        style={{ minHeight: V2_ROW, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }}
      >
        {v2 ? (
          <Text
            testID={`${testID}-quantity`}
            variant="section"
            accessibilityRole="text"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[{ width: V2_QUANTITY, textAlign: "right", fontFamily: fontFor("800"), fontVariant: ["tabular-nums"] }, done]}
          >
            {quantity}
          </Text>
        ) : (
          <Text variant="heading" style={[{ minWidth: 40, textAlign: "right", fontVariant: ["tabular-nums"] }, done]}>
            {quantity}
          </Text>
        )}
        {/* Only the picture dims: dimming text would drop the ticked name below 4.5:1 on a light card. */}
        <Animated.View testID={`${testID}-media`} style={dimStyle}>
          {image && v2 ? (
            // The Dapur photo carries its own radius; the canvas ground shows while it loads or if it never does.
            <Photo
              testID={`${testID}-image`}
              uri={image}
              style={{ width: photo, height: photo, borderRadius: radius, borderCurve: "continuous" }}
            />
          ) : image ? (
            // The line colour shows while the photo loads or if it never does.
            <View
              style={{ width: photo, height: photo, borderRadius: radius, borderCurve: "continuous", overflow: "hidden", backgroundColor: c.line }}
            >
              <Photo testID={`${testID}-image`} uri={image} style={{ width: photo, height: photo }} />
            </View>
          ) : (
            <View
              testID={`${testID}-icon`}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: photo,
                height: photo,
                borderRadius: radius,
                borderCurve: "continuous",
                backgroundColor: c.sage,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={icon} size={v2 ? 20 : 22} color={c.forest} />
            </View>
          )}
        </Animated.View>
        <Text variant={v2 ? "bodyStrong" : "body"} style={[{ flex: 1, textDecorationLine: checked ? "line-through" : "none" }, done]}>
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
      </View>
    </PressableScale>
  );
}
