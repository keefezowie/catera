import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable } from "react-native";
import { useColors } from "./theme";

type Glyph = keyof typeof Ionicons.glyphMap;

/** iOS and Android draw share differently; close and chat are the same glyph on both. */
const glyphs: Record<"close" | "chat" | "share", { ios: Glyph; android: Glyph }> = {
  close: { ios: "close", android: "close" },
  chat: { ios: "chatbubble-outline", android: "chatbubble-outline" },
  share: { ios: "share-outline", android: "share-social-outline" },
};

/**
 * An icon-only button for a native header slot (`headerLeft`, `headerRight`): 44pt on iOS with the bar's forest tint
 * and a dim while pressed, 48dp on Android in the bar's ink with a borderless ripple, the Material icon button's state
 * layer. `label` is the translated spoken name; this package has no i18n.
 */
export function HeaderIconButton({
  icon,
  label,
  onPress,
  os = process.env.EXPO_OS,
}: {
  icon: "close" | "chat" | "share";
  label: string;
  onPress: () => void;
  /** The running platform, for tests. */
  os?: string;
}) {
  const palette = useColors();
  const ios = os === "ios";
  const size = ios ? 44 : 48;
  const tint = ios ? palette.forest : palette.charcoal;
  return (
    <Pressable
      testID={`header-${icon}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: palette.line, borderless: true, radius: size / 2 }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        opacity: ios && pressed ? 0.5 : 1,
      })}
    >
      <Ionicons name={glyphs[icon][ios ? "ios" : "android"]} size={ios ? 22 : 24} color={tint} />
    </Pressable>
  );
}
