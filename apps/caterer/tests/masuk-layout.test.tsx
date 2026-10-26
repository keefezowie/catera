import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Keyboard, StyleSheet } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import { Masuk } from "../src/auth/Masuk";
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
beforeEach(() => {
  jest.clearAllMocks();
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "dapur-masuk-layout" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: null, demo: false })) } as unknown as MobileRuntime["api"];
});
const renderMasuk = () =>
  render(
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

describe("Dapur Masuk, the OKX layout", () => {
  it("shows the failure under the fields and above Masuk, with the sign-up line last", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderMasuk();
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    fireEvent.changeText(screen.getByLabelText("Email"), "dapur@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("form-error");
    const page = order();
    expect(page.indexOf("error")).toBeGreaterThan(page.indexOf("field:Kata sandi"));
    expect(page.indexOf("error")).toBeLessThan(page.indexOf("button:Masuk"));
    expect(page.indexOf("button:Daftar")).toBeGreaterThan(page.indexOf("button:Masuk"));
    expect(screen.getByLabelText("Email").props.value).toBe("dapur@example.test");
  });

  it("keeps typed values across the method tabs and words each method", async () => {
    renderMasuk();
    expect(await screen.findByText("Kami kirim kode lewat SMS ke nomor WhatsApp kamu.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "0812 3456 7890");
    fireEvent.press(screen.getByRole("tab", { name: "Email" }));
    expect(screen.getByText("Masuk dengan email dan kata sandi kamu.")).toBeTruthy();
    fireEvent.press(screen.getByRole("tab", { name: "Nomor HP" }));
    expect(screen.getByLabelText("Nomor WhatsApp").props.value).toBe("0812 3456 7890");
    fireEvent.press(screen.getByRole("button", { name: "Daftar" }));
    expect(router.push).toHaveBeenCalledWith("/daftar");
  });
});

describe("Dapur Masuk on the 16 rhythm", () => {
  const flatStyle = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
  it("spaces the fields of both methods 16 apart, the group gap that matches Daftar's", async () => {
    renderMasuk();
    const phone = await screen.findByTestId("masuk-fields");
    expect(flatStyle(phone)).toMatchObject({ gap: 16 });
    fireEvent.press(screen.getByRole("tab", { name: "Email" }));
    expect(flatStyle(await screen.findByTestId("masuk-fields"))).toMatchObject({ gap: 16 });
  });

  it("shows a failure under the fields with the keyboard open, and the padding holds one inset", async () => {
    const handlers: Record<string, ((e?: never) => void)[]> = {};
    jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, fn: () => void) => {
      (handlers[event] ??= []).push(fn);
      return { remove: jest.fn() };
    }) as never);
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderMasuk();
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    act(() => ["keyboardDidShow", "keyboardWillShow"].forEach((name) => handlers[name]?.forEach((fn) => fn({ endCoordinates: { height: 300 } } as never))));
    fireEvent.changeText(screen.getByLabelText("Email"), "dapur@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("form-error");
    expect(StyleSheet.flatten(screen.getByTestId("screen-scroll").props.contentContainerStyle).paddingBottom).toBe(32 + 24 + 300);
  });
});

describe("Dapur Masuk heading and labels", () => {
  it("follows the v2 keyboard padding: the screen pays the bottom inset once, the keyboard adds only its height", async () => {
    const handlers: Record<string, ((e?: never) => void)[]> = {};
    jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, fn: () => void) => {
      (handlers[event] ??= []).push(fn);
      return { remove: jest.fn() };
    }) as never);
    renderMasuk();
    await screen.findByRole("tab", { name: "Email" });
    const pad = () => StyleSheet.flatten(screen.getByTestId("screen-scroll").props.contentContainerStyle).paddingBottom as number;
    const down = pad();
    // 32 under the content and the 24 gesture-bar inset a full-screen flow pays on Android.
    expect(down).toBe(32 + 24);
    act(() => ["keyboardDidShow", "keyboardWillShow"].forEach((name) => handlers[name]?.forEach((fn) => fn({ endCoordinates: { height: 300 } } as never))));
    expect(pad()).toBe(down + 300);
    act(() => ["keyboardDidHide", "keyboardWillHide"].forEach((name) => handlers[name]?.forEach((fn) => fn())));
    expect(pad()).toBe(down);
  });

  it("has one heading, Masuk, with the Catera Dapur wordmark where the mascot sits elsewhere", async () => {
    renderMasuk();
    expect(await screen.findByText("Catera Dapur")).toBeTruthy();
    expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual(["Masuk"]);
    expect(screen.queryByTestId("masuk-header")).toBeNull();
    expect(screen.queryByTestId("mascot-melambai", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lupa kata sandi?" })).toBeNull();
  });

  it("names the phone tab Nomor HP and keeps the field Nomor WhatsApp", async () => {
    renderMasuk();
    expect(await screen.findByRole("tab", { name: "Nomor HP" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "WhatsApp" })).toBeNull();
    expect(screen.getByLabelText("Nomor WhatsApp")).toBeTruthy();
  });

  it("toggles the password with an eye icon whose spoken name follows its state, and outlines both fields on a failure", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderMasuk();
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    fireEvent.press(screen.getByRole("button", { name: "Tampilkan kata sandi" }));
    expect(screen.getByRole("button", { name: "Sembunyikan kata sandi" })).toBeTruthy();
    const edge = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style).borderColor;
    const [e0, p0] = [edge("Email"), edge("Kata sandi")];
    fireEvent.changeText(screen.getByLabelText("Email"), "dapur@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("form-error");
    expect(edge("Email")).not.toBe(e0);
    expect(edge("Kata sandi")).not.toBe(p0);
  });
});
