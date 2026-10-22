import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

/**
 * An icon that only decorates the row it sits in (a leading glyph, a chevron, a photo's placeholder). Ionicons draws a
 * glyph as a Text node, and a screen reader merges the Text of a row's children into the row's label, so an undrawn
 * private-use character became an empty part of it (", Data akun, "). This one is hidden from accessibility on both
 * platforms; the row names itself (`rowLabel`).
 */
export function DecorativeIcon(props: ComponentProps<typeof Ionicons>) {
  return <Ionicons {...props} accessible={false} importantForAccessibility="no" accessibilityElementsHidden />;
}
