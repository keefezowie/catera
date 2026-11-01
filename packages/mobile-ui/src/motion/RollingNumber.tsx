import { useLayoutEffect, useRef, useState } from "react";
import { View, type AccessibilityRole, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { Text } from "../components";
import { useReduced } from "./useReduced";

type Variant = Parameters<typeof Text>[0]["variant"];
type Dir = "up" | "down";

const ease = Easing.bezier(...nativeMotion.ease);
const isDigit = (ch: string) => ch >= "0" && ch <= "9";
const LADDER = Array.from({ length: 20 }, (_, i) => i % 10);
const HIDDEN = { position: "absolute", opacity: 0 } as const;

/** Where one column starts and ends on its 0-9-0-9 ladder so it travels the way the number moves (up when it grows). */
export function rollPath(from: number, to: number, dir: Dir): [number, number] {
  if (dir === "up") return [from, to >= from ? to : to + 10];
  return to <= from ? [from, to] : [from + 10, to];
}

/** Which way a number moved: by digits only, so "Rp 99.000" to "Rp 101.000" counts as up. */
export function rollDirection(before: string, after: string): Dir {
  const [a, b] = [before.replace(/\D/g, ""), after.replace(/\D/g, "")];
  return a.length !== b.length ? (b.length > a.length ? "up" : "down") : b >= a ? "up" : "down";
}

function DigitColumn({
  digit,
  dir,
  size,
  variant,
  style,
}: {
  digit: number;
  dir: Dir;
  size: { w: number; h: number };
  variant: Variant;
  style: StyleProp<TextStyle>;
}) {
  const position = useSharedValue(digit);
  const last = useRef(digit);
  useLayoutEffect(() => {
    if (last.current === digit) return;
    const [from, to] = rollPath(last.current, digit, dir);
    last.current = digit;
    position.value = from;
    position.value = withTiming(to, { duration: nativeMotion.control, easing: ease });
  }, [digit, dir, position]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: -position.value * size.h }] }));
  return (
    <View testID="rolling-column" style={{ width: size.w, height: size.h, overflow: "hidden" }}>
      <Animated.View style={slide}>
        {LADDER.map((d, i) => (
          <View key={i} style={{ height: size.h }}>
            <Text variant={variant} style={style}>
              {String(d)}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * A formatted number whose digits roll to their new value (SwiftUI's numericText): each digit is a clipped column that
 * slides up when the number grows and down when it shrinks over `nativeMotion.control`; "Rp", dots and spaces stay still,
 * and characters that arrive with a longer number fade in. The column size is measured from a hidden "0" in the same
 * style, so it follows the font and the system font scale. The first render, reduced motion and the moment before the
 * measure show plain text.
 *
 * The full value stays as one Text (visible until measured, then an invisible twin, so selection and tests still find
 * it) and the wrapper carries it as its accessibility label; the columns are hidden from accessibility.
 */
export function RollingNumber({
  value,
  variant,
  style,
  containerStyle,
  testID,
  selectable,
  accessibilityRole,
  accessibilityLabel,
}: {
  value: string;
  variant?: Variant;
  style?: StyleProp<TextStyle>;
  /** Layout of the wrapper (alignment, minWidth), not of the text. */
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
  selectable?: boolean;
  accessibilityRole?: AccessibilityRole;
  /** Read instead of `value`, for a figure that reads differently from how it looks. */
  accessibilityLabel?: string;
}) {
  const reduced = useReduced();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const seen = useRef<{ value: string; dir: Dir; keys: Set<string> | null }>({ value, dir: "up", keys: null });
  if (seen.current.value !== value) {
    seen.current = { ...seen.current, value, dir: rollDirection(seen.current.value, value) };
  }
  const { dir, keys: before } = seen.current;
  const chars = Array.from(value);
  const keyed = chars.map((ch, i) => ({ ch, key: `${chars.length - i}${isDigit(ch) ? "d" : "s"}` }));
  seen.current.keys = new Set(keyed.map((k) => k.key));

  const rolling = !reduced && size !== null;
  const measure = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize((s) => (s && s.w === width && s.h === height ? s : { w: width, h: height }));
  };
  return (
    <View accessible accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel ?? value} style={containerStyle}>
      <Text
        testID={testID}
        variant={variant}
        selectable={selectable}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel ?? value}
        style={[style, rolling && HIDDEN]}
      >
        {value}
      </Text>
      {!reduced ? (
        <View
          testID="rolling-measure"
          onLayout={measure}
          style={HIDDEN}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text variant={variant} style={[style, { opacity: 0 }]}>
            0
          </Text>
        </View>
      ) : null}
      {rolling ? (
        <View
          testID="rolling-row"
          style={{ flexDirection: "row" }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {keyed.map(({ ch, key }) => {
            const fresh = before !== null && !before.has(key);
            return isDigit(ch) ? (
              <Animated.View key={key} entering={fresh && !reduced ? FadeIn.duration(nativeMotion.control).easing(ease) : undefined}>
                <DigitColumn digit={Number(ch)} dir={dir} size={size} variant={variant} style={style} />
              </Animated.View>
            ) : (
              <Animated.View key={key} entering={fresh && !reduced ? FadeIn.duration(nativeMotion.control).easing(ease) : undefined}>
                <Text variant={variant} style={style}>
                  {ch}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
