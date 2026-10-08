import type { TextStyle } from "react-native";

/**
 * Android cannot pick weights from a variable TTF, so every weight is its own registered family.
 * Metro needs static require() paths, which is why they are spelled out here.
 */
export const fonts = {
  regular: "Jakarta",
  medium: "Jakarta-Medium",
  semibold: "Jakarta-SemiBold",
  bold: "Jakarta-Bold",
  extrabold: "Jakarta-ExtraBold",
} as const;

/** Pass to `useFonts` in each app's root layout. */
export const fontAssets: Record<string, number> = {
  [fonts.regular]: require("../../brand/assets/fonts/static/PlusJakartaSans-Regular.ttf"),
  [fonts.medium]: require("../../brand/assets/fonts/static/PlusJakartaSans-Medium.ttf"),
  [fonts.semibold]: require("../../brand/assets/fonts/static/PlusJakartaSans-SemiBold.ttf"),
  [fonts.bold]: require("../../brand/assets/fonts/static/PlusJakartaSans-Bold.ttf"),
  [fonts.extrabold]: require("../../brand/assets/fonts/static/PlusJakartaSans-ExtraBold.ttf"),
};

/** Maps a CSS-style weight to the static family that carries it. */
export function fontFor(weight?: TextStyle["fontWeight"]): string {
  switch (weight) {
    case "500":
      return fonts.medium;
    case "600":
      return fonts.semibold;
    case "bold":
    case "700":
      return fonts.bold;
    case "800":
    case "900":
      return fonts.extrabold;
    default:
      return fonts.regular;
  }
}
