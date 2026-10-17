import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./components";
import { coveredBySheet, useSheetOnTop } from "./sheets";
import { themedStyles, useColors } from "./theme";

/** Height of the strip below the status bar (the toast reads it to find where a MoodHeader starts). */
export const DEMO_STRIP_HEIGHT = 24;

/**
 * The persistent "Demo (data contoh)" strip for demo mode. It sits directly under the status bar, above the
 * stack, and owns the top safe-area inset (wrap it and the stack in `TopInsetOwner owned`).
 * `label` is the caller's translated text; this package has no i18n.
 * While a sheet is on top it leaves the accessibility tree (spec 4.1): it is the first node in the window, so TalkBack
 * fell back onto it when the page under the sheet was hidden. It returns when the last sheet closes.
 */
export function DemoStrip({ label }: { label: string }) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const styles = useStyles();
  const covered = useSheetOnTop();
  return (
    <View
      testID="demo-strip"
      {...coveredBySheet(covered)}
      accessible={!covered}
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.strip, { paddingTop: insets.top, minHeight: insets.top + DEMO_STRIP_HEIGHT }]}
    >
      <Text variant="caption" style={{ color: c.muted }}>
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
    // Spec 2.3: a neutral band (canvas under muted text, 5.2:1), not a sage block with forest text (audit 9-07).
    backgroundColor: c.canvas,
  },
}));
