import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

/**
 * The rantang (lunchbox): a body, a divider and a handle on a 24 unit grid. It is the brand's one drawing, so a covered
 * meal (`PhotoRing`) and the delivery marker (`RantangTrack`) draw the same box.
 * - `filled` false is an outline: the box is closed and has not left yet.
 * - `filled` true tints the body with `color`: the box is on its way.
 * Decorative: hidden from screen readers, the caller's text carries the meaning. `testID` names the wrapper, and the
 * body is `<testID>-body`.
 */
export function Rantang({
  size,
  color,
  filled = false,
  testID = "rantang",
}: {
  size: number;
  color: string;
  filled?: boolean;
  testID?: string;
}) {
  return (
    <View testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Rect
          testID={`${testID}-body`}
          x={4}
          y={8}
          width={16}
          height={11}
          rx={2.5}
          stroke={color}
          strokeWidth={1.6}
          fill={filled ? color : "none"}
          fillOpacity={filled ? 0.3 : 1}
        />
        <Path d="M4 12.5H20" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        <Rect x={10.5} y={11} width={3} height={3} rx={0.8} fill={color} />
      </Svg>
    </View>
  );
}
