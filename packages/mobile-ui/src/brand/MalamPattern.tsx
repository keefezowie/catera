import { StyleSheet, View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { useMoodColors } from "../mood";

const WIDTH = 132;
const HEIGHT = 84;

/** One rantang seen from the front: a 34 by 22 body and its carrying handle, as outlines. */
function Lunchbox({ x, y, angle, stroke }: { x: number; y: number; angle: number; stroke: string }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${angle} 17 11)`}>
      <Rect x={0} y={0} width={34} height={22} rx={5} ry={5} fill="none" stroke={stroke} strokeWidth={1.5} />
      <Path d="M9 0 C9 -8 25 -8 25 0" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
    </G>
  );
}

/**
 * Three outline lunchboxes behind the top-right of a Malam header; `top` is where the group starts, so a header can
 * set it below its toggle row. Decorative: no touches, hidden from screen readers,
 * and absent in Siang, where the mood palette has no pattern ink.
 */
export function MalamPattern({ top = 12 }: { top?: number }) {
  const { pattern } = useMoodColors();
  if (pattern === null) return null;
  return (
    <View
      testID="malam-pattern"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.corner, { top, width: WIDTH, height: HEIGHT }]}
    >
      <Svg width={WIDTH} height={HEIGHT}>
        <Lunchbox x={74} y={14} angle={-8} stroke={pattern} />
        <Lunchbox x={30} y={32} angle={6} stroke={pattern} />
        <Lunchbox x={88} y={52} angle={-3} stroke={pattern} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: "absolute", right: 8 },
});
