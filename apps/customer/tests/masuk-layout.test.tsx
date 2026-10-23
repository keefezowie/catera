import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { Keyboard, ScrollView, StyleSheet } from "react-native";
import { nativeThemes } from "@catera/design-tokens";
import { ThemeProvider } from "@catera/mobile-ui";
import * as Reanimated from "react-native-reanimated";
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
/** The phone the screen is drawn on; a test sets it to try another width or text size. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

let runtime: MobileRuntime;
beforeEach(() => {
  jest.clearAllMocks();
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
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
  // Every component that listens (the page and its heading) hears the event.
  const handlers: Record<string, ((e?: never) => void)[]> = {};
  jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, fn: () => void) => {
    (handlers[event] ??= []).push(fn);
    return { remove: jest.fn() };
  }) as never);
  const fire = (events: string[], e?: unknown) =>
    act(() => events.forEach((name) => handlers[name]?.forEach((fn) => fn(e as never))));
  return {
    show: (height = 280) => fire(["keyboardDidShow", "keyboardWillShow"], { endCoordinates: { height } }),
    hide: () => fire(["keyboardDidHide", "keyboardWillHide"]),
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
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const kb = keyboard();
    renderWith(<Masuk />);
    const mark = await screen.findByTestId("mascot-melambai", { includeHiddenElements: true });
    expect(StyleSheet.flatten(mark.props.style).alignSelf).toBe("flex-start");
    expect(StyleSheet.flatten(screen.getByTestId("mascot-art", { includeHiddenElements: true }).props.style).height).toBe(56);
    const host = () => screen.getByTestId("auth-mark", { includeHiddenElements: true });
    const slot = () => StyleSheet.flatten(host().props.style);
    // Measured once, so the room it gives back is its real height.
    fireEvent(host().children[0] as never, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 56, height: 56 } } });
    expect(slot().height).toBe(56);
    kb.show();
    // Reduced motion: the room is gone at once, not eased out.
    await waitFor(() => expect(slot()).toMatchObject({ height: 0, opacity: 0 }));
    kb.hide();
    await waitFor(() => expect(slot()).toMatchObject({ height: 56, opacity: 1 }));
  });

  it("adds the Android keyboard's height under the page and scrolls to the error and the button when a sign-in fails", async () => {
    const kb = keyboard();
    const scrollToEnd = jest.spyOn(ScrollView.prototype as never as { scrollToEnd: () => void }, "scrollToEnd").mockImplementation(() => undefined);
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    const pad = () => StyleSheet.flatten(screen.getByTestId("screen-scroll").props.contentContainerStyle).paddingBottom as number;
    const down = pad();
    kb.show(300);
    expect(pad()).toBe(down + 300);
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("masuk-error");
    await waitFor(() => expect(scrollToEnd).toHaveBeenCalled());
    kb.hide();
    expect(pad()).toBe(down);
  });

  it("scrolls to the end when the keyboard comes up so the primary button sits above it", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
    const kb = keyboard();
    const scrollToEnd = jest.spyOn(ScrollView.prototype as never as { scrollToEnd: (o?: { animated?: boolean }) => void }, "scrollToEnd").mockImplementation(() => undefined);
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    expect(scrollToEnd).not.toHaveBeenCalled();
    kb.show(300);
    await waitFor(() => expect(scrollToEnd).toHaveBeenCalledWith({ animated: true }));
  });

  it("does not animate that scroll under reduced motion", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const kb = keyboard();
    const scrollToEnd = jest.spyOn(ScrollView.prototype as never as { scrollToEnd: (o?: { animated?: boolean }) => void }, "scrollToEnd").mockImplementation(() => undefined);
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    kb.show(300);
    await waitFor(() => expect(scrollToEnd).toHaveBeenCalledWith({ animated: false }));
  });

  it("gives every tab a 48dp target and the password toggle its visible word in its spoken name", async () => {
    renderWith(<Masuk />);
    for (const name of ["Nomor HP", "Email"]) {
      const tab = await screen.findByRole("tab", { name });
      expect(StyleSheet.flatten(tab.props.style)).toMatchObject({ minWidth: 48, minHeight: 48 });
    }
    fireEvent.press(screen.getByRole("tab", { name: "Email" }));
    const toggle = screen.getByRole("button", { name: "Tampilkan kata sandi" });
    expect(screen.getByText("Tampilkan")).toBeTruthy();
    fireEvent.press(toggle);
    expect(screen.getByText("Sembunyikan")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sembunyikan kata sandi" })).toBeTruthy();
  });

  it("outlines both the email and the password after a credentials error", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    const [e0, p0] = [borderOf("Email"), borderOf("Kata sandi")];
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("masuk-error");
    expect(borderOf("Email")).not.toBe(e0);
    expect(borderOf("Kata sandi")).not.toBe(p0);
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

});

describe("Masuk, the SMS code", () => {
  const slots = () => screen.getAllByTestId(/^code-slot-\d$/, { includeHiddenElements: true });
  const slotText = () =>
    slots().map((s) => (within(s).queryByText(/\d/, { includeHiddenElements: true })?.props.children as string | undefined) ?? "");
  const toCode = async () => {
    if (!jest.isMockFunction(runtime.sendPhoneOtp)) runtime.sendPhoneOtp = jest.fn(async () => undefined);
    fireEvent.changeText(await screen.findByLabelText("Nomor HP"), "0812 3456 7890");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    return screen.findByLabelText("Kode dari SMS");
  };

  it("the SMS code is 6 slots and the sixth digit submits once", async () => {
    let settle: (v: unknown) => void = () => {};
    runtime.verifyPhoneOtp = jest.fn(() => new Promise((resolve) => (settle = resolve))) as never;
    renderWith(<Masuk />);
    const input = await toCode();
    expect(input.props.textContentType).toBe("oneTimeCode");
    expect(input.props.autoComplete).toBe("sms-otp");
    expect(input.props.keyboardType).toBe("number-pad");
    expect(input.props.maxLength).toBe(6);
    expect(slots()).toHaveLength(6);
    // Digits only: what is not a digit is dropped.
    fireEvent.changeText(input, "12-34a5");
    expect(slotText()).toEqual(["1", "2", "3", "4", "5", ""]);
    expect(runtime.verifyPhoneOtp).not.toHaveBeenCalled();
    // The current slot (the sixth, still empty) carries the ring; a filled one does not.
    const edge = (i: number) => StyleSheet.flatten(slots()[i].props.style).borderColor;
    expect(edge(5)).toBe(nativeThemes.light.forest);
    expect(edge(0)).toBe(nativeThemes.light.fieldBorder);
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
    await waitFor(() => expect(runtime.verifyPhoneOtp).toHaveBeenCalledTimes(1));
    expect(runtime.verifyPhoneOtp).toHaveBeenCalledWith("+6281234567890", "123456", "Pelanggan", expect.any(String));
    // While it is checked, pressing Masuk sends nothing more.
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(runtime.verifyPhoneOtp).toHaveBeenCalledTimes(1);
    await act(async () => settle({ id: "u-c1", role: "customer", name: "Rani" }));
  });

  it("a code pasted whole into empty slots submits once, and the slots hold still while it is checked", async () => {
    let settle: (v: unknown) => void = () => {};
    runtime.verifyPhoneOtp = jest.fn(() => new Promise((resolve) => (settle = resolve))) as never;
    renderWith(<Masuk />);
    const input = await toCode();
    expect(input.props.selectTextOnFocus).toBe(false);
    fireEvent.changeText(input, "123456");
    await waitFor(() => expect(runtime.verifyPhoneOtp).toHaveBeenCalledTimes(1));
    expect(slotText()).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(screen.getByLabelText("Kode dari SMS").props.editable).toBe(false);
    await act(async () => settle({ id: "u-c1", role: "customer", name: "Rani" }));
    expect(runtime.verifyPhoneOtp).toHaveBeenCalledTimes(1);
  });

  it("names the code once for a screen reader: the input carries the label, the visible one is hidden", async () => {
    renderWith(<Masuk />);
    await toCode();
    const visible = screen.getByText("Kode dari SMS", { includeHiddenElements: true });
    expect(visible.props.importantForAccessibility).toBe("no");
    expect(visible.props.accessibilityElementsHidden).toBe(true);
    expect(screen.getByLabelText("Kode dari SMS").props.accessibilityLabel).toBe("Kode dari SMS");
  });

  it("a wrong code shows the error and clears the slots", async () => {
    runtime.verifyPhoneOtp = jest.fn(async () => {
      throw Object.assign(new Error("INVALID_OTP"), { code: "INVALID_OTP" });
    });
    renderWith(<Masuk />);
    fireEvent.changeText(await toCode(), "123456");
    await waitFor(() => expect(screen.getByTestId("masuk-error")).toBeTruthy());
    expect(screen.getByText(/Kode belum cocok/)).toBeTruthy();
    expect(screen.getByLabelText("Kode dari SMS").props.value).toBe("");
    expect(slotText()).toEqual(["", "", "", "", "", ""]);
    // The slots carry the danger edge, and the error sits above Masuk.
    expect(StyleSheet.flatten(slots()[1].props.style).borderColor).toBe(nativeThemes.light.danger);
    const page = order();
    expect(page.indexOf("error")).toBeLessThan(page.indexOf("button:Masuk"));
    // The number stays typed.
    expect(screen.getByLabelText("Nomor HP").props.value).toBe("0812 3456 7890");
    // A new code is tried as soon as its sixth digit is in.
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "654321");
    await waitFor(() => expect(runtime.verifyPhoneOtp).toHaveBeenCalledTimes(2));
  });

  it("Kirim ulang counts down 60 seconds then calls sendPhoneOtp", async () => {
    jest.useFakeTimers();
    try {
      renderWith(<Masuk />);
      await toCode();
      expect(runtime.sendPhoneOtp).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Kirim ulang dalam 1:00" })).toBeDisabled();
      act(() => jest.advanceTimersByTime(18_000));
      expect(screen.getByRole("button", { name: "Kirim ulang dalam 0:42" })).toBeDisabled();
      act(() => jest.advanceTimersByTime(42_000));
      const ready = screen.getByRole("button", { name: "Kirim ulang kode" });
      expect(ready).not.toBeDisabled();
      // Ganti nomor stays its own action.
      expect(screen.getByRole("button", { name: "Ganti nomor" })).toBeTruthy();
      fireEvent.press(ready);
      await waitFor(() => expect(runtime.sendPhoneOtp).toHaveBeenCalledTimes(2));
      expect(runtime.sendPhoneOtp).toHaveBeenLastCalledWith("+6281234567890");
      expect(await screen.findByRole("button", { name: "Kirim ulang dalam 1:00" })).toBeDisabled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("fits the 6 slots at 360dp and font scale 1.3, with slots that grow instead of clipping", async () => {
    mockWindow = { width: 360, height: 800, scale: 3, fontScale: 1.3 };
    renderWith(<Masuk />);
    await toCode();
    const widths = slots().map((s) => StyleSheet.flatten(s.props.style).width as number);
    const slot = Math.min(48, (360 - 32 - 5 * 8) / 6);
    for (const w of widths) expect(w).toBeLessThanOrEqual(slot);
    expect(widths.reduce((a, b) => a + b, 0) + 5 * 8).toBeLessThanOrEqual(360 - 32);
    for (const s of slots()) {
      const style = StyleSheet.flatten(s.props.style);
      expect(style.height).toBeUndefined();
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
    // The countdown is a text button whose words wrap rather than truncate.
    const resend = screen.getByRole("button", { name: "Kirim ulang dalam 1:00" });
    for (const text of within(resend).getAllByText(/./)) expect(text.props.numberOfLines).toBeUndefined();
  });

  it("draws the slots from the dark palette", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    render(
      <ThemeProvider storageKey="masuk-dark-test">
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <Masuk />
        </MobileProvider>
      </ThemeProvider>,
    );
    await toCode();
    const dark = nativeThemes.dark;
    const first = StyleSheet.flatten(slots()[0].props.style);
    expect(first.backgroundColor).toBe(dark.inputFill);
    expect(first.borderColor).toBe(dark.forest);
    expect(StyleSheet.flatten(slots()[1].props.style).borderColor).toBe(dark.fieldBorder);
    scheme.mockRestore();
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
