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
