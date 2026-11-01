import { useWindowDimensions } from "react-native";

/** True when the width left after the text is enlarged (`width / fontScale`) is under `threshold` dp. */
export function isNarrow({ width, fontScale }: { width: number; fontScale: number }, threshold: number): boolean {
  return width / (fontScale || 1) < threshold;
}

/**
 * Whether a row should stack its parts: the effective width is under `threshold`. 340 keeps two half-width buttons
 * on one line each; 400 leaves a text column beside a button wide enough for a one-word name.
 */
export function useStackedLayout(threshold: number): boolean {
  return isNarrow(useWindowDimensions(), threshold);
}

/** Below this effective width a row's one-line texts get more lines before they are cut: 205 at 411dp and font scale 2.0,
 * while 360dp at 1.3 (277) keeps the one-line rows the Dapur spec set. */
export const ROW_LINES_BELOW = 260;

/**
 * How many lines a list row's title and meta take when the row does not wrap them: one each, or at large text (under
 * `ROW_LINES_BELOW` effective width, where one line holds a word or two) two for the title and three for the meta.
 */
export function useRowLines(): { title: number; meta: number } {
  return useStackedLayout(ROW_LINES_BELOW) ? { title: 2, meta: 3 } : { title: 1, meta: 1 };
}
