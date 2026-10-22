import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoodFill } from "./MoodFill";
import { useColors } from "./theme";

/**
 * A fixed strip the height of the status-bar inset, in the mood header colour, laid over the top of a screen whose
 * header scrolls with the page. Once that header has scrolled away, content would run under the translucent status
 * bar, and in light Malam the light status glyphs would sit on a light canvas. Its fill is the header's own two-layer
 * fade, so it changes with the header instead of snapping. Decorative: no touches, no screen reader.
 */
export function StatusBand({ plain = false }: { plain?: boolean }) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  return (
    <View
      testID="status-band"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top }}
    >
      {plain ? <View testID="status-band-canvas" style={{ flex: 1, backgroundColor: c.canvas }} /> : <MoodFill surface="header" testID="status-band-fill" />}
    </View>
  );
}
