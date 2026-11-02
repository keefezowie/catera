import { screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

/** Testing Library 14 only exposes host elements, so these replace the old `UNSAFE_*ByType` and `UNSAFE_*ByProps` queries. */
export function allHosts(from: TestInstance | null = screen.container): TestInstance[] {
  if (!from) return [];
  const out: TestInstance[] = [];
  const walk = (node: TestInstance) => {
    for (const child of node.children) {
      if (typeof child === "string") continue;
      out.push(child);
      walk(child);
    }
  };
  walk(from);
  return out;
}

/** Hosts whose type matches, and whose props carry every key/value given (compared with Object.is). */
export function hostsWhere(
  match: { type?: string | RegExp; props?: Record<string, unknown> },
  from: TestInstance | null = screen.container,
): TestInstance[] {
  return allHosts(from).filter((node) => {
    if (match.type !== undefined) {
      if (typeof match.type === "string" ? node.type !== match.type : !match.type.test(node.type)) return false;
    }
    return Object.entries(match.props ?? {}).every(([key, value]) => Object.is(node.props[key], value));
  });
}

let reverseGlyphs: Map<string, string> | undefined;
function glyphNames() {
  if (!reverseGlyphs) {
    const map = (require("@expo/vector-icons/Ionicons") as { default: { glyphMap: Record<string, number> } }).default
      .glyphMap;
    reverseGlyphs = new Map(Object.entries(map).map(([name, code]) => [String.fromCodePoint(code), name]));
  }
  return reverseGlyphs;
}

/** The Ionicons drawn under `from`: Ionicons renders a Text holding one glyph, so the name is read back from it. */
export function iconsIn(from: TestInstance | null = screen.container): { name: string; node: TestInstance }[] {
  return allHosts(from).flatMap((node) => {
    const only = node.children.length === 1 ? node.children[0] : undefined;
    const name = node.type === "Text" && typeof only === "string" ? glyphNames().get(only) : undefined;
    return name ? [{ name, node }] : [];
  });
}

/** The bar styles of every mounted StatusBar (React Native's or expo-status-bar's, which draws through it), in mount order. */
export function statusBarStyles(): (string | undefined)[] {
  const { StatusBar } = require("react-native") as {
    StatusBar: { _propsStack: { barStyle: { value: string } | null }[] };
  };
  return StatusBar._propsStack.map((entry) => entry.barStyle?.value);
}
