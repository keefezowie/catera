import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { useMoodProgress } from "./brand/useMoodProgress";
import { useMoodColors } from "./mood";

/** The hero card's edge, in dp (spec 2.6). */
export const HERO_EDGE = 1.5;

/**
 * The stacked Siang and Malam fills every mood surface paints: the Siang fill underneath, the Malam fill over it,
 * fading in and out when the mood changes. It fills its parent, so the parent supplies the frame (and clips it or not).
 * The headers, the Beranda hero, the Dapur count card and the status band all use this one, so they cross-fade on the
 * same curve and over the same time.
 * - `surface` picks which palette colour the fills read: the header colour or the hero card colour.
 * - `testID` names the pair: `<testID>-siang` and `<testID>-malam`.
 * - A `hero` fill is drawn with the 1.5dp `heroEdge` inside its own box (no layout change), on both layers: the hero is
 *   1.03:1 on the header, so the edge is what lifts it (direction K). The edge value is the same in both moods.
 * - `radius` rounds both fills (a surface whose parent does not clip).
 * - `heroShadow` puts the hero shadow of the current mood on the base fill, so a rest state never stacks two.
 * - `children` render inside the Malam fill and fade with it.
 * Under reduced motion the Malam fill jumps to its opacity instead of easing.
 */
export function MoodFill({
  surface,
  testID,
  radius,
  heroShadow = false,
  duration = nativeMotion.content,
  children,
}: {
  surface: "header" | "hero";
  testID: string;
  radius?: number;
  heroShadow?: boolean;
  duration?: number;
  children?: ReactNode;
}) {
  const siang = useMoodColors("siang");
  const malam = useMoodColors("malam");
  const current = useMoodColors();
  const { progress, target, reduced } = useMoodProgress(duration);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  const shape = radius === undefined ? undefined : ({ borderRadius: radius, borderCurve: "continuous" } as const);
  const edge = surface === "hero" ? { borderWidth: HERO_EDGE, borderColor: current.heroEdge } : undefined;
  return (
    <>
      <View
        testID={`${testID}-siang`}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, shape, edge, { backgroundColor: siang[surface] }, heroShadow && { boxShadow: current.heroShadow }]}
      />
      <Animated.View
        testID={`${testID}-malam`}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, shape, edge, { backgroundColor: malam[surface] }, reduced ? { opacity: target } : fade]}
      >
        {children}
      </Animated.View>
    </>
  );
}
