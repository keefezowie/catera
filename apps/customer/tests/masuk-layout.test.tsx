import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Keyboard, StyleSheet } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { Masuk } from "../src/account/Masuk";
import { Register } from "../src/account/Register";
import { customerLink } from "../src/links";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

let runtime: MobileRuntime;
beforeEach(() => {
  jest.clearAllMocks();
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "masuk-layout" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: null, demo: false })) } as unknown as MobileRuntime["api"];
});
afterEach(() => jest.restoreAllMocks());

const renderWith = (ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );

type Json = { props?: Record<string, unknown>; children?: (Json | string)[] | null } | string;
/** The page top to bottom as the things a person meets: buttons, fields, tabs, the error and the headings. */
function order(): string[] {
  const out: string[] = [];
  const walk = (n: Json) => {
    if (typeof n === "string") return;
    const p = n.props ?? {};
    const label = p.accessibilityLabel as string | undefined;
    if (p.testID === "masuk-error" || p.testID === "identity-error") out.push("error");
    else if (p.accessibilityRole === "button" && label) out.push(`button:${label}`);
    else if (p.accessibilityRole === "tab" && label !== undefined) out.push(`tab:${label}`);
    else if (p.accessibilityRole === "header") out.push("header");
    else if (p.placeholderTextColor !== undefined && label) out.push(`field:${label}`);
    (n.children ?? []).forEach(walk);
  };
  const tree = screen.toJSON() as Json | Json[];
  (Array.isArray(tree) ? tree : [tree]).forEach(walk);
  return out;
}

const keyboard = () => {
  const handlers: Record<string, () => void> = {};
  jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, fn: () => void) => {
    handlers[event] = fn;
    return { remove: jest.fn() };
  }) as never);
  return {
    show: () => act(() => (handlers.keyboardDidShow ?? handlers.keyboardWillShow)()),
    hide: () => act(() => (handlers.keyboardDidHide ?? handlers.keyboardWillHide)()),
  };
};
const borderOf = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style).borderColor;

describe("Masuk, the OKX layout", () => {
  it("shows the failed password under the fields and above the primary button, never between the links", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByTestId("masuk-error")).toBeTruthy();
    const page = order();
    const at = (s: string) => page.indexOf(s);
    expect(at("error")).toBeGreaterThan(at("field:Kata sandi"));
    expect(at("error")).toBeGreaterThan(at("button:Lupa kata sandi?"));
    expect(at("error")).toBeLessThan(at("button:Masuk"));
    expect(at("error")).toBeLessThan(at("button:Daftar"));
    expect(screen.getByTestId("masuk-error").props.accessibilityLiveRegion).toBe("polite");
  });

  it("outlines the password field in danger after a credentials error, and keeps both drafts", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    const before = borderOf("Kata sandi");
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("masuk-error");
    expect(borderOf("Kata sandi")).not.toBe(before);
    expect(screen.getByLabelText("Email").props.value).toBe("rani@example.test");
    expect(screen.getByLabelText("Kata sandi").props.value).toBe("wrong-password");
  });

  it("puts the sign-up line under the primary button, after the form", async () => {
    renderWith(<Masuk />);
    await screen.findByRole("button", { name: "Kirim kode" });
    const page = order();
    expect(page.indexOf("button:Daftar")).toBeGreaterThan(page.indexOf("button:Kirim kode"));
    expect(screen.getByText("Belum punya akun?")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Daftar" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/register", params: { next: "/" } });
  });

  it("keeps what was typed when the method changes, and says what each method needs", async () => {
    renderWith(<Masuk />);
    expect(await screen.findByText(/Pakai nomor HP yang kamu berikan ke katering/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Nomor HP"), "0812 3456 7890");
    fireEvent.press(screen.getByRole("tab", { name: "Email" }));
    expect(screen.getByText("Masuk dengan email dan kata sandi kamu.")).toBeTruthy();
    expect(screen.queryByText(/Pakai nomor HP yang kamu berikan/)).toBeNull();
    expect(screen.queryByLabelText("Nomor HP")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    fireEvent.press(screen.getByRole("tab", { name: "Nomor HP" }));
    expect(screen.getByLabelText("Nomor HP").props.value).toBe("0812 3456 7890");
    fireEvent.press(screen.getByRole("tab", { name: "Email" }));
    expect(screen.getByLabelText("Email").props.value).toBe("rani@example.test");
    expect(screen.getByLabelText("Kata sandi").props.value).toBe("synthetic-password");
  });

  it("marks the chosen method as selected and sets the title at the start", async () => {
    renderWith(<Masuk />);
    expect((await screen.findByRole("tab", { name: "Nomor HP" })).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("tab", { name: "Email" }).props.accessibilityState.selected).toBe(false);
    const title = screen.getByRole("header", { name: "Masuk" });
    expect(StyleSheet.flatten(title.props.style).textAlign).not.toBe("center");
  });

  it("shows the 56dp mascot mark, hides it while the keyboard is up and brings it back", async () => {
    const kb = keyboard();
    renderWith(<Masuk />);
    const mark = await screen.findByTestId("mascot-melambai", { includeHiddenElements: true });
    expect(StyleSheet.flatten(mark.props.style).alignSelf).toBe("flex-start");
    expect(StyleSheet.flatten(screen.getByTestId("mascot-art", { includeHiddenElements: true }).props.style).height).toBe(56);
    kb.show();
    expect(screen.queryByTestId("mascot-melambai", { includeHiddenElements: true })).toBeNull();
    kb.hide();
    expect(screen.getByTestId("mascot-melambai", { includeHiddenElements: true })).toBeTruthy();
  });

  it("offers Lupa kata sandi? under the password field on the email path only", async () => {
    renderWith(<Masuk />);
    await screen.findByRole("button", { name: "Kirim kode" });
    expect(screen.queryByRole("button", { name: "Lupa kata sandi?" })).toBeNull();
    fireEvent.press(screen.getByRole("tab", { name: "Email" }));
    const page = order();
    const gap = page.slice(page.indexOf("field:Kata sandi") + 1, page.indexOf("button:Lupa kata sandi?"));
    expect(page.indexOf("button:Lupa kata sandi?")).toBeGreaterThan(-1);
    expect(gap.every((s) => s === "button:Tampilkan kata sandi")).toBe(true);
  });

  it("shows and hides the password", async () => {
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    expect(screen.getByLabelText("Kata sandi").props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: "Tampilkan kata sandi" }));
    expect(screen.getByLabelText("Kata sandi").props.secureTextEntry).toBe(false);
    expect(screen.getByRole("button", { name: "Sembunyikan kata sandi" })).toBeTruthy();
  });

  it("a wrong code shows its error above Masuk and keeps the typed number and code", async () => {
    runtime.sendPhoneOtp = jest.fn(async () => undefined);
    runtime.verifyPhoneOtp = jest.fn(async () => {
      throw Object.assign(new Error("INVALID_OTP"), { code: "INVALID_OTP" });
    });
    renderWith(<Masuk />);
    fireEvent.changeText(await screen.findByLabelText("Nomor HP"), "0812 3456 7890");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    fireEvent.changeText(await screen.findByLabelText("Kode dari SMS"), "123456");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => expect(screen.getByTestId("masuk-error")).toBeTruthy());
    const page = order();
    expect(page.indexOf("error")).toBeLessThan(page.indexOf("button:Masuk"));
    expect(page.indexOf("error")).toBeGreaterThan(page.indexOf("field:Kode dari SMS"));
    expect(screen.getByLabelText("Kode dari SMS").props.value).toBe("123456");
  });
});

describe("Daftar, the same layout", () => {
  it("titles the screen Daftar and puts Sudah punya akun? Masuk under the primary button", async () => {
    renderWith(<Register />);
    expect(await screen.findByRole("header", { name: "Daftar" })).toBeTruthy();
    const page = order();
    expect(page.indexOf("button:Masuk")).toBeGreaterThan(page.indexOf("button:Daftar & verifikasi email"));
    expect(screen.getByText("Sudah punya akun?")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/" } });
  });
});
