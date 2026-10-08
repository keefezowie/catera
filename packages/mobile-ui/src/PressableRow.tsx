import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

const PRESSED_OPACITY = 0.7;

/**
 * A full-width tappable row (list item, card that opens something). Pressed feedback is an instant dim: no
 * scale, no ripple, no haptic, so it is the same with and without reduced motion. Buttons use `PressableScale`.
 */
export function PressableRow({
  style,
  children,
  ...rest
}: Omit<PressableProps, "style" | "android_ripple"> & { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      {...rest}
      android_ripple={null}
      style={({ pressed }) => [style, pressed && { opacity: PRESSED_OPACITY }]}
    >
      {children}
    </Pressable>
  );
}
