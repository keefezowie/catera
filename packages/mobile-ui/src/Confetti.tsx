import { View, type StyleProp, type ViewStyle } from "react-native";
import LottieView from "lottie-react-native";
import { useReduced } from "./motion/useReduced";
import { decorative } from "./brand/decorative";

/**
 * The delivered confetti vector (`packages/brand/assets/phase-f/confetti.json`: 60fps, 1.2s, 24 pieces in palette
 * colours, ending fully transparent), kept beside the art it was generated with; it is not a runtime raster copy.
 */
const confetti = require("../../brand/assets/phase-f/confetti.json");

/**
 * Confetti for a first milestone only: a customer's first paid plan and a caterer's first published package (spec
 * 6.2). It plays once when `play` is true and is not drawn otherwise. Absolute over its parent (the caller places that
 * box), never takes a touch, and is hidden from screen readers. Not rendered under reduced motion.
 *
 * LottieView's own props have no `pointerEvents`, so the wrapper holds `pointerEvents="none"` for it.
 */
export function Confetti({ play, style }: { play: boolean; style?: StyleProp<ViewStyle> }) {
  const reduced = useReduced();
  if (!play || reduced) return null;
  return (
    <View
      pointerEvents="none"
      {...decorative}
      style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }, style]}
    >
      <LottieView
        testID="confetti"
        source={confetti}
        autoPlay
        loop={false}
        resizeMode="contain"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}
