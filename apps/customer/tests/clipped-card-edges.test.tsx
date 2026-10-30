import { render } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet, type ViewStyle } from "react-native";
import type { ReactElement } from "react";
import { createMobileRuntime, MobileProvider } from "@catera/mobile-core";
import { LayoutScaleProvider, ListCard, SettingsRow, SettingsSection, Text, ThemeProvider } from "@catera/mobile-ui";
import { AkunSkeleton, PlanListSkeleton, PlanSkeleton } from "../src/skeletons";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => ({}),
}));

/**
 * Gate 2026-10-30 #10: on Android, a border width that is set in light and simply absent in dark is reset to NaN on a
 * live switch, the clip path from the border insets comes out empty, and an `overflow: "hidden"` card loses everything
 * inside it. So in every clipped view of these primitives, each border width key the light theme sets must still be a
 * number in dark (0 where dark draws no edge), never a key that disappears.
 */
const WIDTHS = ["borderWidth", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStartWidth", "borderEndWidth"] as const;

function clipped(ui: ReactElement, scheme: "light" | "dark") {
  const spy = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t" });
  const view = render(
    <ThemeProvider storageKey="t.theme">
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <LayoutScaleProvider value="v2">{ui}</LayoutScaleProvider>
      </MobileProvider>
    </ThemeProvider>,
  );
  const styles = view.UNSAFE_root.findAll((n) => typeof n.type === "string")
    .map((n) => StyleSheet.flatten(n.props.style as ReactNative.StyleProp<ViewStyle>))
    .filter((s): s is ViewStyle => !!s && s.overflow === "hidden");
  view.unmount();
  spy.mockRestore();
  return styles;
}

const cases: [string, () => ReactElement][] = [
  ["ListCard", () => <ListCard><Text>Rantang</Text><Text>7 porsi</Text></ListCard>],
  ["ListCard sage", () => <ListCard tone="sage"><Text>Rantang</Text></ListCard>],
  ["settings card (v2)", () => <SettingsSection title="Akun"><SettingsRow label="Nama" /><SettingsRow label="Email" /></SettingsSection>],
  ["PlanSkeleton", () => <PlanSkeleton />],
  ["PlanListSkeleton", () => <PlanListSkeleton />],
  ["AkunSkeleton", () => <AkunSkeleton />],
];

it.each(cases)("%s keeps every light border width as a number in dark", (_, ui) => {
  const light = clipped(ui(), "light");
  const dark = clipped(ui(), "dark");
  expect(light.length).toBeGreaterThan(0);
  expect(dark).toHaveLength(light.length);
  light.forEach((style, i) => {
    for (const key of WIDTHS) if (style[key] !== undefined) expect([key, typeof dark[i][key]]).toEqual([key, "number"]);
  });
  // The card edge is there in light: the check above is not vacuous.
  expect(light.some((s) => WIDTHS.some((k) => typeof s[k] === "number" && (s[k] as number) > 0))).toBe(true);
});
