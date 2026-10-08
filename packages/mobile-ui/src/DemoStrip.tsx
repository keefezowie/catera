import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, Text } from "./components";

/** Height of the strip below the status bar. */
const STRIP_HEIGHT = 24;

/**
 * The persistent "Demo · data sintetis" strip for demo mode. It sits directly under the status bar, above the
 * stack, and owns the top safe-area inset (wrap it and the stack in `TopInsetOwner owned`).
 * `label` is the caller's translated text; this package has no i18n.
 */
export function DemoStrip({ label }: { label: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.strip, { paddingTop: insets.top, minHeight: insets.top + STRIP_HEIGHT }]}
    >
      <Text variant="caption" style={{ color: colors.forest }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.sage,
  },
});
