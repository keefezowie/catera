import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoodFill } from "./MoodFill";

/**
 * A fixed strip the height of the status-bar inset, in the mood header colour, laid over the top of a screen whose
 * header scrolls with the page. Once that header has scrolled away, content would run under the translucent status
 * bar, and in light Malam the light status glyphs would sit on a light canvas. Its fill is the header's own two-layer
 * fade, so it changes with the header instead of snapping. Decorative: no touches, no screen reader.
 */
export function StatusBand() {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="status-band"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top }}
    >
      <MoodFill surface="header" testID="status-band-fill" />
    </View>
  );
}
