import { Ionicons } from "@expo/vector-icons";
import type { ComponentType } from "react";
import { screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { TestInstance } from "test-renderer";

/**
 * Testing Library 14 exposes host elements only. These helpers answer the questions the 13-era suites asked of
 * composite components (`UNSAFE_getByType`, `UNSAFE_getByProps`, `findAll`) from the host tree, and, where a
 * component draws nothing a host can show (a `StatusBar`, a keyed `FadeSwap`), from the fiber each host exposes
 * through `unstable_fiber`.
 */

type Fiber = {
  type: unknown;
  memoizedProps: Record<string, any>;
  child: Fiber | null;
  sibling: Fiber | null;
  return: Fiber | null;
  alternate: Fiber | null;
  stateNode: { current?: Fiber } | null;
};

const asFiber = (node: TestInstance) => node.unstable_fiber as unknown as Fiber | null;

/** Every host element under `root` (the screen when omitted), `root` itself included, in document order. */
export function hosts(root?: TestInstance | null): TestInstance[] {
  const top = root ?? screen.container;
  return top.queryAll(() => true, { includeSelf: true });
}

/** Host elements whose own props match every given prop (`toEqual` semantics per prop). */
export function hostsByProps(root: TestInstance | null | undefined, props: Record<string, unknown>) {
  return hosts(root).filter((n) => Object.entries(props).every(([k, v]) => JSON.stringify(n.props[k]) === JSON.stringify(v)));
}

export const hostsOfType = (root: TestInstance | null | undefined, type: string) =>
  hosts(root).filter((n) => n.type === type);

/** The flattened style of a host element. */
export const styleOf = (node: TestInstance) => StyleSheet.flatten(node.props.style) as Record<string, any>;

export type IconSet = { glyphMap: Record<string, number> };

/** The icon hosts a vector-icon set draws: a `Text` in the set's font whose only child is the glyph. */
export function iconHosts(root: TestInstance | null | undefined, set: IconSet, family: string, name?: string) {
  const glyph = name === undefined ? null : String.fromCodePoint(set.glyphMap[name]);
  return hosts(root).filter(
    (n) =>
      n.type === "Text" &&
      styleOf(n).fontFamily === family &&
      (glyph === null || (n.children.length === 1 && n.children[0] === glyph)),
  );
}

/** The Ionicons glyphs under `root`, all of them or the ones drawing `name`. */
export const ionicons = (root: TestInstance | null | undefined, name?: string) =>
  iconHosts(root, Ionicons as unknown as IconSet, "ionicons", name);

/** The one Ionicons glyph drawing `name` under `root`. */
export function ionicon(root: TestInstance | null | undefined, name: string) {
  const found = ionicons(root, name);
  if (found.length !== 1) throw new Error(`expected one "${name}" icon, found ${found.length}`);
  return found[0];
}

/** A mounted composite: its props as the parent gave them, and the host elements it draws. */
export type Composite = { props: Record<string, any>; hosts: TestInstance[]; host: TestInstance };

function rootFiber(): Fiber {
  const start = asFiber(screen.root as TestInstance);
  if (!start) throw new Error("nothing is rendered");
  let f = start;
  while (f.return) f = f.return;
  // The walk must start from the committed tree: the root reached by `return` can be the stale alternate.
  return f.stateNode?.current ?? f;
}

function sameFiber(a: Fiber, b: Fiber) {
  return a === b || a === b.alternate || a.alternate === b;
}

/** True when the fiber of `inner` sits under the fiber of `outer`. */
function fiberWithin(inner: Fiber, outer: Fiber) {
  for (let f: Fiber | null = inner; f; f = f.return) if (sameFiber(f, outer)) return true;
  return false;
}

/** Whether host `node` is `ancestor` or draws inside it. */
export function isWithin(node: TestInstance, ancestor: TestInstance) {
  const a = asFiber(ancestor);
  const n = asFiber(node);
  return !!a && !!n && fiberWithin(n, a);
}

/** Whether host `node` draws inside the composite. */
export function drawnBy(composite: Composite, node: TestInstance) {
  const n = asFiber(node);
  return !!n && composite.hosts.some((h) => fiberWithin(n, asFiber(h)!));
}

/**
 * Every mounted instance of a component (or of a host type name), as `UNSAFE_getAllByType` found them. `within` limits
 * the search to a host element's subtree.
 */
export function byComponent(type: ComponentType<any> | string, within?: TestInstance): Composite[] {
  const all = hosts();
  const out: Composite[] = [];
  const stack: Fiber[] = [rootFiber()];
  const scope = within ? asFiber(within) : null;
  while (stack.length) {
    const fiber = stack.pop()!;
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
    if (fiber.type !== type) continue;
    const mine = all.filter((h) => fiberWithin(asFiber(h)!, fiber));
    // Inside the scope, or drawing the scope host itself (a testID on the component's own root).
    if (scope && !fiberWithin(fiber, scope) && !mine.some((h) => sameFiber(asFiber(h)!, scope))) continue;
    out.push({ props: fiber.memoizedProps, hosts: mine, host: mine[0] });
  }
  // The walk is depth-first, left to right, so the order is document order.
  return out;
}

/** The Ionicons name a glyph host draws, read back from the font's glyph map. */
export function ionicName(node: TestInstance) {
  const glyph = node.children[0];
  const map = (Ionicons as unknown as IconSet).glyphMap;
  return Object.keys(map).find((k) => String.fromCodePoint(map[k]) === glyph);
}
