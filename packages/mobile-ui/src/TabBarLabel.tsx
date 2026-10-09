import type { ColorValue } from "react-native";
import { Text as RNText } from "react-native";
import { fonts } from "./type";

/**
 * The label of a bottom tab. The icon carries the meaning, so the label grows with the system font size only up to
 * 1.15 times: at font scale 1.3 on a 360dp phone the four tab labels still fit one line ("Pelanggan" no longer cuts
 * to "Pelangg..."). A function `tabBarLabel` replaces the spoken label the bar would build ("title, tab, 1 of 4" on
 * iOS), so every tab screen must also set `tabBarAccessibilityLabel` (the two tab layouts do, and their tests check it).
 */
export const TAB_LABEL_MAX_SCALE = 1.15;

export function TabBarLabel({ color, children }: { color: ColorValue; children: string }) {
  return (
    <RNText
      maxFontSizeMultiplier={TAB_LABEL_MAX_SCALE}
      numberOfLines={1}
      style={{ color, fontSize: 12, fontFamily: fonts.bold, textAlign: "center" }}
    >
      {children}
    </RNText>
  );
}
