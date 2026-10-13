import { act, render } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { MascotLoading, MascotReading, SuccessRig, mascotArtFrame } from "@catera/mobile-ui";
import { readingRig, readingRigBox, successRig, successRigBox } from "../../../packages/brand/phaseF";

// React Native's own parser for `transformOrigin` (react-native/Libraries/StyleSheet/processTransformOrigin.js). Its
// regex reads `\d+(?:%|px)` with no decimals, so a string like "80.94098883572568%" misparses or throws.
const processTransformOrigin: (origin: unknown) => Array<string | number> =
  require("react-native/Libraries/StyleSheet/processTransformOrigin").default;

type Node = { props?: { style?: unknown }; children?: Array<Node | string> | null };

/** Every `transformOrigin` in the rendered host tree, in tree order, run through RN's parser. */
function parsedOrigins(tree: unknown) {
  const found: Array<Array<string | number>> = [];
  const walk = (node: Node | string) => {
    if (typeof node === "string") return;
    const origin = StyleSheet.flatten(node.props?.style as never)?.transformOrigin;
    if (origin !== undefined) found.push(processTransformOrigin(origin));
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of (Array.isArray(tree) ? tree : tree ? [tree] : []) as Node[]) walk(node);
  return found;
}

const points = (point: { x: number; y: number }, canvas: number) => [point.x * canvas, point.y * canvas, 0];
const expectPoints = (got: Array<string | number>, want: number[]) => {
  expect(got.every((part) => typeof part === "number")).toBe(true);
  want.forEach((value, axis) => expect(got[axis] as number).toBeCloseTo(value, 6));
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
});
afterEach(() => jest.useRealTimers());

it("MascotReading: both eyes and the magnifier pivot where the rig says, and RN parses each", () => {
  const view = render(<MascotReading size={120} />);
  const canvas = mascotArtFrame(readingRigBox, 120).canvas;
  const [left, right] = readingRig.eyePivots;
  const result = parsedOrigins(view.toJSON());
  expect(result).toHaveLength(3);
  expectPoints(result[0], points(left, canvas));
  expectPoints(result[1], points(right, canvas));
  expectPoints(result[2], points(readingRig.magnifierPivot, canvas));
});

it("SuccessRig: body, lid and badge pivot in canvas points, the sparkles at the centre, and RN parses each", () => {
  const view = render(<SuccessRig size={180} play={false} />);
  const canvas = mascotArtFrame(successRigBox, 180).canvas;
  const result = parsedOrigins(view.toJSON());
  expect(result).toHaveLength(4);
  expectPoints(result[0], points(successRig.bodyPivot, canvas));
  expectPoints(result[1], points(successRig.lidHinge, canvas));
  expectPoints(result[2], points(successRig.badgePivot, canvas));
  expect(result[3]).toEqual(["50%", "50%", 0]);
});

it("MascotLoading: the body turns on 50% 80% and the sparkles grow from 84% 39%, and RN parses each", () => {
  jest.useFakeTimers();
  const view = render(<MascotLoading label="Memuat" />);
  act(() => jest.advanceTimersByTime(300));
  expect(parsedOrigins(view.toJSON())).toEqual([
    ["50%", "80%", 0],
    ["84%", "39%", 0],
  ]);
});
