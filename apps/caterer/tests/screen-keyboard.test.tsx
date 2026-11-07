import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react-native";
import { FlatList, Keyboard, StyleSheet, View } from "react-native";
import { NavigationContext } from "expo-router/react-navigation";
import { LayoutScaleProvider, Screen, Text } from "@catera/mobile-ui";

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context/jest/mock").default,
  useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }),
}));

const handlers: Record<string, ((e?: never) => void)[]> = {};
beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, fn: () => void) => {
    (handlers[event] ??= []).push(fn);
    return { remove: jest.fn() };
  }) as never);
});
const show = async (height: number) =>
  await act(() => handlers.keyboardDidShow?.forEach((fn) => fn({ endCoordinates: { height } } as never)));
const hide = async () => await act(() => handlers.keyboardDidHide?.forEach((fn) => fn()));

const nav = (types: string[]) => {
  const at = (i: number): unknown => ({
    getState: () => ({ type: types[i] }),
    getParent: () => (i > 0 ? at(i - 1) : undefined),
    setOptions: () => undefined,
    isFocused: () => true,
    addListener: () => () => undefined,
  });
  return at(types.length - 1) as never;
};
const page = (types: string[], ui: ReactNode, scale: "v2" | "classic" = "v2") => (
  <LayoutScaleProvider value={scale} target={48}>
    <NavigationContext.Provider value={nav(types)}>{ui}</NavigationContext.Provider>
  </LayoutScaleProvider>
);
const flat = (style: unknown) => StyleSheet.flatten(style as never) ?? {};
const padding = () => flat(screen.getByTestId("screen-scroll").props.contentContainerStyle).paddingBottom as number;
const lift = () => flat(screen.getByTestId("screen-footer").props.style).marginBottom ?? 0;

const form = (
  <Screen>
    <Text>Isi</Text>
  </Screen>
);
const pinned = (
  <Screen footer={<Text>Simpan</Text>}>
    <Text>Isi</Text>
  </Screen>
);
const listed = (
  <Screen list={({ scrollProps, header }) => <FlatList {...scrollProps} ListHeaderComponent={<View>{header}</View>} data={[]} renderItem={() => null} />}>
    {null}
  </Screen>
);

describe("Screen with the Android keyboard", () => {
  it("pads a plain form by the keyboard, and takes it back when it closes", async () => {
    await render(page(["stack"], form));
    const down = padding();
    await show(300);
    expect(padding()).toBe(down + 300);
    await hide();
    expect(padding()).toBe(down);
  });

  it("lifts a pinned footer once, without also padding the content", async () => {
    await render(page(["stack"], pinned));
    const down = padding();
    await show(300);
    expect(lift()).toBe(300);
    expect(padding()).toBe(down);
    await hide();
    expect(lift()).toBe(0);
  });

  it("adds the system inset on the classic scale, whose screen does not pay it", async () => {
    await render(page(["stack"], pinned, "classic"));
    await show(300);
    expect(lift()).toBe(324);
  });

  it("inside the tabs takes off the bar the keyboard covers, in both layouts", async () => {
    const view = await render(page(["stack", "tab", "stack"], pinned));
    await show(300);
    // The jest window has font scale 2, so the bar is 96 (androidTabBarHeight).
    expect(lift()).toBe(204);
    await view.unmount();
    await render(page(["stack", "tab", "stack"], form));
    const down = padding();
    await show(300);
    expect(padding()).toBe(down + 204);
    await show(60);
    expect(padding()).toBe(down);
  });

  it("pads a list that is the scroll root", async () => {
    await render(page(["stack"], listed));
    const down = padding();
    await show(300);
    expect(padding()).toBe(down + 300);
  });
});
