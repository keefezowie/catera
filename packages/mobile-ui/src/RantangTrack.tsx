import { useEffect, useRef, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { Rantang } from "./brand/Rantang";
import { Text } from "./components";
import { useMoodColors } from "./mood";
import { useReduced } from "./motion";

export type DeliveryStage = "scheduled" | "preparing" | "out_for_delivery" | "delivered";

const ease = Easing.bezier(...nativeMotion.ease);
const MARKER = 24;
const DOT = 12;
const LINE = 2;
/** The rail is inset by the marker's half width, so the marker over the first and last stop never leaves the track. */
const INSET = MARKER / 2;
const STOPS = 3;

/** Where the marker stands, as a fraction of the rail: scheduled and preparing are both still at the kitchen. */
const POSITION: Record<DeliveryStage, number> = {
  scheduled: 0,
  preparing: 0,
  out_for_delivery: 0.5,
  delivered: 1,
};

/**
 * A meal's journey as a lunchbox on a line: three stops (kitchen, on the road, at the door), a progress line behind the
 * marker and a one-line caption that says what is true now. It sits on a hero surface and reads the hero inks of the
 * current mood: `heroText` for the marker, the progress, the reached stops and the caption, `heroMeta` for the rest.
 * - The stage comes from fulfilment status, never from the clock, so a meal nobody tapped stays "scheduled" and its
 *   marker is an outline; from "preparing" on the box is tinted.
 * - A stage change after mount slides the marker over `nativeMotion.feature` (transform only: the progress line is a
 *   scaled bar); the first render and reduced motion put it in place at once. It never loops.
 * - A screen reader gets the caption as one element; the three stop labels are decoration for the eye.
 */
export function RantangTrack({
  stage,
  caption,
  labels,
  testID = "rantang-track",
}: {
  stage: DeliveryStage;
  caption: string;
  labels: [string, string, string];
  testID?: string;
}) {
  const ink = useMoodColors();
  const reduced = useReduced();
  const target = POSITION[stage];
  const [width, setWidth] = useState(0);
  const position = useSharedValue(target);
  const shown = useRef(target);

  useEffect(() => {
    if (shown.current === target) return;
    shown.current = target;
    position.value = reduced ? target : withTiming(target, { duration: nativeMotion.feature, easing: ease });
  }, [target, reduced, position]);

  const marker = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * width - MARKER / 2 }] }), [width]);
  // A full-width bar grown from its left edge, so the progress is a transform and not a width.
  const progress = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(position.value, 0.0001) }] }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const reached = POSITION[stage] * (STOPS - 1);
  // Until the rail has been measured the marker has no position to stand at, so it stays invisible instead of
  // flashing at the first stop and then jumping to a departed or delivered one.
  const measured = width > 0;

  return (
    <View testID={testID} accessible accessibilityLabel={caption} style={{ gap: 8 }}>
      <Text variant="label" style={{ color: ink.heroText }}>
        {caption}
      </Text>
      <View style={{ paddingHorizontal: INSET }}>
        <View testID={`${testID}-rail`} onLayout={onLayout} style={{ height: MARKER + 4 + DOT }}>
          <Animated.View
            testID={`${testID}-marker`}
            style={[{ position: "absolute", top: 0, left: 0, width: MARKER, height: MARKER, opacity: measured ? 1 : 0 }, marker]}
          >
            <Rantang size={MARKER} color={ink.heroText} filled={stage !== "scheduled"} testID={`${testID}-marker-glyph`} />
          </Animated.View>
          <View style={{ position: "absolute", left: 0, right: 0, top: MARKER + 4, height: DOT, justifyContent: "center" }}>
            <View testID={`${testID}-line`} style={{ height: LINE, borderRadius: LINE / 2, backgroundColor: ink.heroMeta }} />
            <Animated.View
              testID={`${testID}-progress`}
              style={[
                {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: LINE,
                  borderRadius: LINE / 2,
                  backgroundColor: ink.heroText,
                  transformOrigin: "left center",
                  opacity: measured ? 1 : 0,
                },
                progress,
              ]}
            />
            {Array.from({ length: STOPS }, (_, i) => (
              <View
                key={i}
                testID={`${testID}-stop-${i}`}
                style={{
                  position: "absolute",
                  left: `${(i * 100) / (STOPS - 1)}%`,
                  marginLeft: -DOT / 2,
                  width: DOT,
                  height: DOT,
                  borderRadius: DOT / 2,
                  backgroundColor: i <= reached ? ink.heroText : ink.heroMeta,
                }}
              />
            ))}
          </View>
        </View>
      </View>
      <View
        testID={`${testID}-labels`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: "row", gap: 8 }}
      >
        {labels.map((label, i) => (
          <Text
            key={i}
            variant="caption"
            style={{ flex: 1, color: ink.heroMeta, textAlign: i === 0 ? "left" : i === 1 ? "center" : "right" }}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
