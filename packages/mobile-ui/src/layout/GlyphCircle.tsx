import type { ReactNode } from "react";
import { View } from "react-native";
import { themedStyles } from "../theme";
import { GLYPH_CIRCLE } from "./metrics";

/** The 40 circle a row's glyph sits on, for a row built by hand beside the shared `GlyphRow` (Buy's field rows). */
export function GlyphCircle({ children, testID }: { children: ReactNode; testID?: string }) {
  const styles = useStyles();
  return (
    <View testID={testID} style={styles.circle}>
      {children}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  circle: { width: GLYPH_CIRCLE, height: GLYPH_CIRCLE, borderRadius: GLYPH_CIRCLE / 2, backgroundColor: c.sage, alignItems: "center", justifyContent: "center" },
}));
