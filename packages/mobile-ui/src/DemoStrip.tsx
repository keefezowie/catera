import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./components";
import { themedStyles, useColors } from "./theme";

/** Height of the strip below the status bar. */
const STRIP_HEIGHT = 24;

/**
 * The persistent "Demo · data sintetis" strip for demo mode. It sits directly under the status bar, above the
 * stack, and owns the top safe-area inset (wrap it and the stack in `TopInsetOwner owned`).
 * `label` is the caller's translated text; this package has no i18n.
 */
export function DemoStrip({ label }: { label: string }) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const styles = useStyles();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.strip, { paddingTop: insets.top, minHeight: insets.top + STRIP_HEIGHT }]}
    >
      <Text variant="caption" style={{ color: c.forest }}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  strip: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.sage,
  },
}));
