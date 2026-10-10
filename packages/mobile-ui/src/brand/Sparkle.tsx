import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { decorative } from "./decorative";

/**
 * A code-drawn sparkle for the success burst, the launch hand-off and the heart burst: a four-point star with concave
 * sides, or a round dot, `size` points across. The caller passes the colour, which is sunrise ink, sunrise or forest
 * only (spec 7.1), and animates the wrapper. Decorative: hidden from screen readers.
 */
export function Sparkle({ kind, color, size }: { kind: "star" | "dot"; color: string; size: number }) {
  return (
    <View testID="sparkle" {...decorative} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {kind === "star" ? (
          <Path testID="sparkle-star" d="M12 0Q13.4 10.6 24 12Q13.4 13.4 12 24Q10.6 13.4 0 12Q10.6 10.6 12 0Z" fill={color} />
        ) : (
          <Circle testID="sparkle-dot" cx={12} cy={12} r={12} fill={color} />
        )}
      </Svg>
    </View>
  );
}
