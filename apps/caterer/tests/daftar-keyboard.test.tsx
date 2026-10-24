import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Keyboard, StyleSheet } from "react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import { Daftar } from "../src/auth/Daftar";
import { withDapurScale } from "./dapur-scale";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));
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
const handlers: Record<string, ((e?: never) => void)[]> = {};
beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(handlers)) delete handlers[k];
  jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, fn: () => void) => {
    (handlers[event] ??= []).push(fn);
    return { remove: jest.fn() };
  }) as never);
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "dapur-daftar-keyboard" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: null, demo: false })) } as unknown as MobileRuntime["api"];
});
const renderDaftar = () =>
  render(
    withDapurScale(
      <MoodProvider now={() => new Date("2026-10-08T08:00:00Z")}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <Daftar />
        </MobileProvider>
      </MoodProvider>,
    ),
  );
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
const show = (height: number) =>
  act(() => ["keyboardDidShow", "keyboardWillShow"].forEach((name) => handlers[name]?.forEach((fn) => fn({ endCoordinates: { height } } as never))));
const hide = () => act(() => ["keyboardDidHide", "keyboardWillHide"].forEach((name) => handlers[name]?.forEach((fn) => fn())));

describe("Dapur Daftar with the Android keyboard", () => {
  it("lifts the pinned Kirim kode footer by the keyboard, and sets it back when the keyboard closes", async () => {
    renderDaftar();
    await screen.findByRole("button", { name: "Kirim kode" });
    expect(flat(screen.getByTestId("screen-footer")).marginBottom ?? 0).toBe(0);
    show(300);
    // The screen pays the gesture-bar inset once (inside the footer), so the keyboard adds only its height.
    expect(flat(screen.getByTestId("screen-footer")).marginBottom).toBe(300);
    expect(screen.getByRole("button", { name: "Kirim kode" })).toBeTruthy();
    hide();
    expect(flat(screen.getByTestId("screen-footer")).marginBottom ?? 0).toBe(0);
  });

  it("keeps the footer's own inset and does not also pad the scroll content", async () => {
    renderDaftar();
    await screen.findByRole("button", { name: "Kirim kode" });
    const pad = () => flat({ props: { style: screen.getByTestId("screen-scroll").props.contentContainerStyle } }).paddingBottom;
    const down = pad();
    const footerPad = flat(screen.getByTestId("screen-footer")).paddingBottom;
    show(300);
    expect(pad()).toBe(down);
    expect(flat(screen.getByTestId("screen-footer")).paddingBottom).toBe(footerPad);
  });

  it("still sends the code and shows Buat dapur saya in the same lifted footer", async () => {
    runtime.sendPhoneOtp = jest.fn(async () => undefined) as never;
    renderDaftar();
    fireEvent.changeText(await screen.findByLabelText("Nama usaha katering"), "Dapur Bu Rina");
    fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "0812 3456 7890");
    fireEvent.press(screen.getAllByRole("button").find((b) => b.props.accessibilityState?.selected !== undefined)!);
    show(280);
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    await screen.findByRole("button", { name: "Buat dapur saya" });
    expect(flat(screen.getByTestId("screen-footer")).marginBottom).toBe(280);
  });
});
