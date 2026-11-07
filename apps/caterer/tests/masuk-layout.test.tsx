import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Keyboard, StyleSheet } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import { Masuk } from "../src/auth/Masuk";
import { withDapurScale } from "./dapur-scale";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}), router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context/jest/mock").default,
  useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

let runtime: MobileRuntime;
beforeEach(() => {
  jest.clearAllMocks();
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "dapur-masuk-layout" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: null, demo: false })) } as unknown as MobileRuntime["api"];
});
const renderMasuk = async () =>
  await render(
    withDapurScale(
      <MoodProvider now={() => new Date("2026-10-08T08:00:00Z")}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <Masuk />
        </MobileProvider>
      </MoodProvider>,
    ),
  );

type Json = { props?: Record<string, unknown>; children?: (Json | string)[] | null } | string;
function order(): string[] {
  const out: string[] = [];
  const walk = (n: Json) => {
    if (typeof n === "string") return;
    const p = n.props ?? {};
    const label = p.accessibilityLabel as string | undefined;
    if (p.testID === "form-error") out.push("error");
    else if (p.accessibilityRole === "button" && label) out.push(`button:${label}`);
    else if (p.placeholderTextColor !== undefined && label) out.push(`field:${label}`);
    (n.children ?? []).forEach(walk);
  };
  const tree = screen.toJSON() as Json | Json[];
  (Array.isArray(tree) ? tree : [tree]).forEach(walk);
  return out;
}

const flatStyle = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
const keyboard = () => {
  const handlers: Record<string, ((e?: never) => void)[]> = {};
  jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, fn: () => void) => {
    (handlers[event] ??= []).push(fn);
    return { remove: jest.fn() };
  }) as never);
  return {
    show: async (height: number) =>
      await act(() => ["keyboardDidShow", "keyboardWillShow"].forEach((name) => handlers[name]?.forEach((fn) => fn({ endCoordinates: { height } } as never)))),
    hide: async () => await act(() => ["keyboardDidHide", "keyboardWillHide"].forEach((name) => handlers[name]?.forEach((fn) => fn()))),
  };
};
const failSignIn = () =>
  (runtime.signInPassword = jest.fn(async () => {
    throw new Error("INVALID_CREDENTIALS");
  }));

describe("Dapur Masuk layout", () => {
  it("shows the failure under the fields, then the Daftar and Gabung lines, then Masuk last", async () => {
    failSignIn();
    await renderMasuk();
    await fireEvent.changeText(await screen.findByLabelText("Email"), "dapur@example.test");
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    await fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("form-error");
    const page = order();
    expect(page.indexOf("error")).toBeGreaterThan(page.indexOf("field:Kata sandi"));
    expect(page.indexOf("button:Gabung ke dapur")).toBeGreaterThan(page.indexOf("button:Daftar"));
    expect(page.indexOf("button:Masuk")).toBeGreaterThan(page.indexOf("button:Gabung ke dapur"));
    expect(screen.getByLabelText("Email").props.value).toBe("dapur@example.test");
  });

  it("spaces the fields 16 apart, the group gap that matches Daftar's", async () => {
    await renderMasuk();
    expect(flatStyle(await screen.findByTestId("masuk-fields"))).toMatchObject({ gap: 16 });
  });

  it("lifts the pinned Masuk by the keyboard height only; the screen pays the inset once", async () => {
    const kb = keyboard();
    await renderMasuk();
    await screen.findByRole("button", { name: "Masuk" });
    const pad = () => StyleSheet.flatten(screen.getByTestId("screen-scroll").props.contentContainerStyle).paddingBottom as number;
    const down = pad();
    expect(flatStyle(screen.getByTestId("screen-footer")).marginBottom ?? 0).toBe(0);
    await kb.show(300);
    expect(flatStyle(screen.getByTestId("screen-footer")).marginBottom).toBe(300);
    expect(pad()).toBe(down);
    await kb.hide();
    expect(flatStyle(screen.getByTestId("screen-footer")).marginBottom ?? 0).toBe(0);
  });

  it("has one heading, Masuk, under the waving mascot, and no method tabs", async () => {
    await renderMasuk();
    expect(await screen.findByTestId("mascot-melambai", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText("Catera Dapur")).toBeNull();
    expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual(["Masuk"]);
    expect(screen.queryByRole("tab")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Daftar" }));
    expect(router.push).toHaveBeenCalledWith("/daftar");
  });

  it("toggles the password with an eye icon whose spoken name follows its state, and outlines both fields on a failure", async () => {
    failSignIn();
    await renderMasuk();
    await fireEvent.press(await screen.findByRole("button", { name: "Tampilkan kata sandi" }));
    expect(screen.getByRole("button", { name: "Sembunyikan kata sandi" })).toBeTruthy();
    const edge = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style).borderColor;
    const [e0, p0] = [edge("Email"), edge("Kata sandi")];
    await fireEvent.changeText(screen.getByLabelText("Email"), "dapur@example.test");
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    await fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("form-error");
    expect(edge("Email")).not.toBe(e0);
    expect(edge("Kata sandi")).not.toBe(p0);
  });
});
