import { StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { TestInstance } from "test-renderer";

/** Testing Library 14 renders host elements only: these stand in for the old `findAll` and `UNSAFE_*ByType`. */
export const findAll = (node: TestInstance, match: (n: TestInstance) => boolean) => node.queryAll(match, { includeSelf: true });
export const findInScreen = (match: (n: TestInstance) => boolean) => findAll(screen.container, match);

const glyphMap = Ionicons.getRawGlyphMap() as Record<string, number>;
const nameOfGlyph = new Map<string, string>();
for (const [name, code] of Object.entries(glyphMap)) if (!nameOfGlyph.has(String.fromCodePoint(code))) nameOfGlyph.set(String.fromCodePoint(code), name);

export type IconGlyph = { node: TestInstance; name: string; size?: number; color?: string };
/** The Ionicons drawn under `root`: the vector-icon font renders a host Text holding one glyph, so name, size and colour are read back from it. */
export const iconsIn = (root: TestInstance = screen.container): IconGlyph[] =>
  root
    .queryAll((n) => n.type === "Text" && n.children.length === 1 && typeof n.children[0] === "string" && nameOfGlyph.has(n.children[0] as string), {
      includeSelf: true,
    })
    .map((node) => {
      const style = StyleSheet.flatten(node.props.style) ?? {};
      return { node, name: nameOfGlyph.get(node.children[0] as string)!, size: style.fontSize, color: style.color as string | undefined };
    });

/** The expo-image stand-ins under `root` (a host View that keeps `source`), in tree order. */
export const imagesIn = (root: TestInstance = screen.container) => root.queryAll((n) => n.type === "View" && n.props.source !== undefined, { includeSelf: true });

/** The single match, like the old `UNSAFE_getByType`: it fails when there are none or several. */
export function only<T>(matches: T[], what = "element"): T {
  if (matches.length !== 1) throw new Error(`Expected exactly one ${what}, found ${matches.length}`);
  return matches[0];
}
export const oneImage = (root?: TestInstance) => only(imagesIn(root), "image");
export const oneIcon = (root?: TestInstance) => only(iconsIn(root), "icon");
/** Host elements by host type, e.g. "RNCSafeAreaView" for react-native-safe-area-context's view. */
export const hostsOf = (type: string, root: TestInstance = screen.container) => root.queryAll((n) => n.type === type, { includeSelf: true });

/** The props of the nearest `component` above `node` (a composite is not in the tree any more, but its fiber is): for a callback no host element exposes. */
export function ancestorProps<P>(node: TestInstance, component: unknown): P {
  for (let fiber = node.unstable_fiber; fiber; fiber = fiber.return) if (fiber.type === component) return fiber.memoizedProps as P;
  throw new Error("No ancestor of that component");
}
