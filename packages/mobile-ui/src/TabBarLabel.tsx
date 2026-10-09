import type { ColorValue } from "react-native";
import { Text as RNText } from "react-native";
import { fonts } from "./type";

/**
 * The label of a bottom tab. The icon carries the meaning, so the label grows with the system font size only up to
 * 1.15 times: at font scale 1.3 on a 360dp phone the four tab labels still fit one line ("Pelanggan" no longer cuts
 * to "Pelangg..."). A function `tabBarLabel` replaces the spoken label the bar would build ("title, tab, 1 of 4" on
 * iOS), so every tab screen also sets `tabBarAccessibilityLabel` through `spokenTabLabel` below (iOS only).
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

/**
 * The spoken label of a tab on iOS: "title, tab, 2 of 4". A function `tabBarLabel` replaces the label the bar would
 * build, so each tab sets this. Android needs none: its tab item already carries the `tab` role, so TalkBack says "tab"
 * by itself and a label with "tab" in it would be read twice. `os` defaults to the running platform.
 */
export function spokenTabLabel(
  title: string,
  position: number,
  count: number,
  t: (id: string, en: string) => string,
  os: string | undefined = process.env.EXPO_OS,
): string | undefined {
  if (os !== "ios") return undefined;
  return t(`${title}, tab, ${position} dari ${count}`, `${title}, tab, ${position} of ${count}`);
}
