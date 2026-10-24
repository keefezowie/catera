import type { ReactNode } from "react";
import { View } from "react-native";
import { themedStyles } from "../theme";
import { GLYPH_CIRCLE } from "./metrics";

/**
 * The 40 circle a row's glyph sits on, for a row built by hand beside the shared `GlyphRow` (Buy's field rows). `tone` is
 * the fill where it is not the plain `sage` (a circle on a sage card sits on the surface).
 */
export function GlyphCircle({ children, tone, testID }: { children: ReactNode; tone?: string; testID?: string }) {
  const styles = useStyles();
  return (
    <View testID={testID} style={tone ? [styles.circle, { backgroundColor: tone }] : styles.circle}>
      {children}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  circle: { width: GLYPH_CIRCLE, height: GLYPH_CIRCLE, borderRadius: GLYPH_CIRCLE / 2, backgroundColor: c.sage, alignItems: "center", justifyContent: "center" },
}));
