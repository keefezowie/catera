import { StatusBar } from "react-native";
import { useScreenFocused } from "./navigation";

/**
 * Status-bar glyphs for one screen. It is mounted only while its screen is in front: the newest mounted status bar
 * wins, and leaving the screen hands the glyphs back to the app's default (the theme's), so a pushed screen never
 * inherits the glyphs of the screen under it. Outside a navigator it is always mounted.
 */
export function ScreenStatusBar({ style }: { style: "light" | "dark" }) {
  const focused = useScreenFocused();
  return focused ? <StatusBar barStyle={style === "light" ? "light-content" : "dark-content"} /> : null;
}
