import { createContext } from "react";

/** True for content rendered as a `Screen`'s full-bleed `header` (a tab root's MoodHeader). */
export const ScreenHeaderContext = createContext(false);

/**
 * How the screen's scroll view lets the system inset it. iOS keeps `"automatic"` under a full-bleed header too: UIKit
 * then offsets the content below the status bar and, with the floating tab bar, lets the last rows scroll clear of it.
 * A photo header (`bleed`) runs under the transparent bar, so it opts out. Android ignores the prop; it keeps "never"
 * under any header as before. `os` defaults to the running platform (jest compiles it in, so tests pass it).
 */
export function screenInsetBehavior(
  { header, bleed }: { header: boolean; bleed: boolean },
  os: string | undefined = process.env.EXPO_OS,
): "automatic" | "never" {
  if (bleed) return "never";
  if (os === "ios") return "automatic";
  return header ? "never" : "automatic";
}

/**
 * The status-bar inset a MoodHeader pays above its own content. On iOS, as a `Screen` header, UIKit's automatic inset
 * already offsets the page below the status bar (and the screen's StatusBand paints the header colour there), so the
 * header pays none. Elsewhere it pays the inset unless the demo strip already owns it.
 */
export function moodHeaderTopInset(
  { top, topOwned, inScreenHeader }: { top: number; topOwned: boolean; inScreenHeader: boolean },
  os: string | undefined = process.env.EXPO_OS,
): number {
  if (os === "ios" && inScreenHeader) return 0;
  return topOwned ? 0 : top;
}
