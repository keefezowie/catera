import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { nativeMotion } from "@catera/design-tokens";
import { useMoodProgress } from "./brand/useMoodProgress";
import { useMoodColors } from "./mood";

/**
 * The stacked Siang and Malam fills every mood surface paints: the Siang fill underneath, the Malam fill over it,
 * fading in and out when the mood changes. It fills its parent, so the parent supplies the frame (and clips it or not).
 * The headers, the Beranda hero, the Dapur count card and the status band all use this one, so they cross-fade on the
 * same curve and over the same time.
 * - `surface` picks which palette colour the fills read: the header colour or the hero card colour.
 * - `testID` names the pair: `<testID>-siang` and `<testID>-malam`.
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
  return (
    <>
      <View
        testID={`${testID}-siang`}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, shape, { backgroundColor: siang[surface] }, heroShadow && { boxShadow: current.heroShadow }]}
      />
      <Animated.View
        testID={`${testID}-malam`}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, shape, { backgroundColor: malam[surface] }, reduced ? { opacity: target } : fade]}
      >
        {children}
      </Animated.View>
    </>
  );
}
