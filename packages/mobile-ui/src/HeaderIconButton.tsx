import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable } from "react-native";
import { useColors } from "./theme";

type Glyph = keyof typeof Ionicons.glyphMap;

export type HeaderIcon = "close" | "chat" | "share" | "print" | "settings" | "more";

/**
 * iOS and Android draw share and "more" differently (iOS's horizontal ellipsis, Material's vertical overflow); close,
 * chat and the settings gear are the same glyph on both.
 */
const glyphs: Record<HeaderIcon, { ios: Glyph; android: Glyph }> = {
  close: { ios: "close", android: "close" },
  chat: { ios: "chatbubble-outline", android: "chatbubble-outline" },
  share: { ios: "share-outline", android: "share-social-outline" },
  print: { ios: "print-outline", android: "print-outline" },
  settings: { ios: "settings-outline", android: "settings-outline" },
  more: { ios: "ellipsis-horizontal", android: "ellipsis-vertical" },
};

/**
 * Android's toolbar insets a custom slot by its 16dp content inset, while its own navigation icon sits 4dp from the
 * edge (icon centre 28dp). A 48dp button in the slot would centre at 40dp, so it reaches 12dp outward to sit where the
 * Material back arrow and action icons sit.
 */
const ANDROID_HEADER_SLOT_PULL = -12;

/**
 * An icon-only button for a native header slot (`headerLeft`, `headerRight`): 44pt on iOS with the bar's forest tint
 * and a dim while pressed, 48dp on Android in the bar's ink with a borderless ripple, the Material icon button's state
 * layer. `label` is the translated spoken name; this package has no i18n. `slot` names the edge it sits on, so on
 * Android it lines up with the platform's own navigation and action icons; iOS places bar buttons itself. `tint`
 * replaces the bar's ink where the button sits on another ground, such as a mood header's text colour; such a button
 * leaves `slot` out.
 */
export function HeaderIconButton({
  icon,
  label,
  onPress,
  slot,
  tint: tintOverride,
  flush = false,
  os = process.env.EXPO_OS,
}: {
  icon: HeaderIcon;
  label: string;
  onPress: () => void;
  /** The header edge it sits on: `leading` in `headerLeft`, `trailing` in `headerRight`. */
  slot?: "leading" | "trailing";
  /** The icon colour where the ground is not the bar's (a mood header's `headerText`). */
  tint?: string;
  /** Holds the glyph against the button's end (no `slot`), so it reaches the margin while the whole target stays in its row. */
  flush?: boolean;
  /** The running platform, for tests. */
  os?: string;
}) {
  const palette = useColors();
  const ios = os === "ios";
  const size = ios ? 44 : 48;
  const tint = tintOverride ?? (ios ? palette.forest : palette.charcoal);
  const glyph = <Ionicons name={glyphs[icon][ios ? "ios" : "android"]} size={ios ? 22 : 24} color={tint} />;
  const ripple = { color: palette.line, borderless: true, radius: size / 2 };
  if (ios || !slot)
    return (
      <Pressable
        testID={`header-${icon}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        android_ripple={ripple}
        style={({ pressed }) => ({
          width: size,
          height: size,
          alignItems: flush ? "flex-end" : "center",
          justifyContent: "center",
          opacity: ios && pressed ? 0.5 : 1,
        })}
      >
        {glyph}
      </Pressable>
    );
  // The toolbar clips its slot and only delivers touches inside it, so a button pulled outward would lose 12dp of its
  // target. The spoken 48dp button therefore stays inside the slot, and the icon with its ripple sits in an inner
  // button pulled 12dp outward. A tap on the icon reaches the inner one, a tap on the slot's far side the outer one;
  // both do the same thing, and both answer the touch with the same ripple.
  return (
    <Pressable
      testID={`header-${icon}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={ripple}
      style={{ width: size, height: size }}
    >
      <Pressable
        testID={`header-${icon}-icon`}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        onPress={onPress}
        android_ripple={ripple}
        style={{
          [slot === "leading" ? "marginStart" : "marginEnd"]: ANDROID_HEADER_SLOT_PULL,
          ...(slot === "trailing" ? { alignSelf: "flex-end" as const } : null),
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {glyph}
      </Pressable>
    </Pressable>
  );
}
