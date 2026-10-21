import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/** The app's one typeface, copied from packages/brand (OFL-1.1) by scripts/sync-fonts.mjs. */
export const fontFamily = "Plus Jakarta Sans";

loadFont({ family: fontFamily, url: staticFile("fonts/PlusJakartaSans.woff2"), weight: "200 800" });
