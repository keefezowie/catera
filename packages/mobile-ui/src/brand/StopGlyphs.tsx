import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type StopGlyphName = "calendar" | "pot" | "motorbike" | "house" | "alert";

/**
 * The four tracker stops and the failed stop, one drawing each on the 24 unit grid and in the stroke style of
 * `brand/Rantang.tsx`: 1.6 wide, round caps and joins, no fill but the dots.
 * - calendar: Terjadwal. - pot: Dimasak, a pot with steam. - motorbike: Diantar. - house: Sampai, a house with a check.
 * - alert: Gagal diantar, a triangle with a bar.
 * Decorative: hidden from screen readers, the track's sentence carries the meaning. The wrapper is `testID`.
 */
export function StopGlyph({
  name,
  size,
  color,
  testID,
}: {
  name: StopGlyphName;
  size: number;
  color: string;
  testID?: string;
}) {
  const stroke = { stroke: color, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <View testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {name === "calendar" ? (
          <>
            <Rect x={4} y={6} width={16} height={14} rx={2.5} {...stroke} />
            <Path d="M4 11H20M8.5 3.5V7.5M15.5 3.5V7.5" {...stroke} />
            <Rect x={8} y={14} width={2.4} height={2.4} rx={0.7} fill={color} />
          </>
        ) : null}
        {name === "pot" ? (
          <>
            <Path d="M5 12H19V15.5A4.5 4.5 0 0 1 14.5 20H9.5A4.5 4.5 0 0 1 5 15.5V12Z" {...stroke} />
            <Path d="M3 12H5M19 12H21" {...stroke} />
            <Path d="M9.5 3.5C8.5 4.8 10.5 5.8 9.5 8M14.5 3.5C13.5 4.8 15.5 5.8 14.5 8" {...stroke} />
          </>
        ) : null}
        {name === "motorbike" ? (
          <>
            <Circle cx={5.5} cy={16.5} r={3} {...stroke} />
            <Circle cx={18.5} cy={16.5} r={3} {...stroke} />
            <Path d="M5.5 16.5L9.5 11H14L18.5 16.5M14 11L12.5 7.5H15.5" {...stroke} />
            <Rect x={3} y={6.5} width={6} height={4} rx={1} {...stroke} />
          </>
        ) : null}
        {name === "house" ? (
          <>
            <Path d="M4 11.5L12 4.5L20 11.5" {...stroke} />
            <Path d="M6 10V19.5A1 1 0 0 0 7 20.5H17A1 1 0 0 0 18 19.5V10" {...stroke} />
            <Path d="M9.5 14.5L11.5 16.5L15 13" {...stroke} />
          </>
        ) : null}
        {name === "alert" ? (
          <>
            <Path d="M12 4.5L3.5 19H20.5L12 4.5Z" {...stroke} />
            <Path d="M12 10V13.5" {...stroke} />
            <Circle cx={12} cy={16.2} r={0.9} fill={color} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
