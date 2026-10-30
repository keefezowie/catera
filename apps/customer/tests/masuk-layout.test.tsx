import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { Keyboard, ScrollView, StyleSheet } from "react-native";
import { nativeThemes } from "@catera/design-tokens";
import { AuthHeading, ThemeProvider } from "@catera/mobile-ui";
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
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByTestId("masuk-error")).toBeTruthy();
    const page = order();
    const at = (s: string) => page.indexOf(s);
    expect(at("error")).toBeGreaterThan(at("field:Kata sandi"));
    expect(at("error")).toBeGreaterThan(at("button:Lupa kata sandi?"));
    expect(at("error")).toBeLessThan(at("button:Masuk"));
    expect(at("error")).toBeLessThan(at("button:Daftar dengan email"));
    expect(screen.getByTestId("masuk-error").props.accessibilityLiveRegion).toBe("polite");
  });

  it("outlines the password field in danger after a credentials error, keeps the email and clears the password", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    const before = borderOf("Kata sandi");
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("masuk-error");
    expect(borderOf("Kata sandi")).not.toBe(before);
    expect(screen.getByLabelText("Email").props.value).toBe("rani@example.test");
    expect(screen.getByLabelText("Kata sandi").props.value).toBe("");
  });




  it("shows the 56dp mascot mark, gives its room back while the keyboard is up and brings it back", async () => {
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
    // Reduced motion: the room is gone at once, not eased or keyboard-led.
    await waitFor(() => expect(slot()).toMatchObject({ height: 0, opacity: 0 }));
    kb.hide();
    await waitFor(() => expect(slot()).toMatchObject({ height: 56, opacity: 1 }));
  });

  it("lifts the pinned footer over the Android keyboard and scrolls to the error and the button when a sign-in fails", async () => {
    const kb = keyboard();
    const scrollToEnd = jest.spyOn(ScrollView.prototype as never as { scrollToEnd: () => void }, "scrollToEnd").mockImplementation(() => undefined);
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    // The pinned footer (Daftar and Masuk) rises by the keyboard's height; the scroll view above it shrinks.
    const lift = () => (StyleSheet.flatten(screen.getByTestId("screen-footer").props.style).marginBottom ?? 0) as number;
    expect(lift()).toBe(0);
    kb.show(300);
    expect(lift()).toBe(300);
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("masuk-error");
    await waitFor(() => expect(scrollToEnd).toHaveBeenCalled());
    kb.hide();
    expect(lift()).toBe(0);
  });

  it.each([false, true])("does not scroll the page by itself when the keyboard comes up (reduced motion %s)", async (reducedMotion) => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(reducedMotion);
    const kb = keyboard();
    const scrollToEnd = jest.spyOn(ScrollView.prototype as never as { scrollToEnd: (o?: { animated?: boolean }) => void }, "scrollToEnd").mockImplementation(() => undefined);
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    kb.show(300);
    await new Promise((r) => setTimeout(r, 50));
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it("starts the Android collapse from the keyboard's own state, on one timed curve", () => {
    const src = require("node:fs").readFileSync(require.resolve("../../../packages/mobile-ui/src/AuthLayout.tsx"), "utf8");
    expect(src).toContain("useAnimatedKeyboard(");
    expect(src).toContain("state === KeyboardState.OPENING || state === KeyboardState.OPEN");
    expect(src).toContain("keyboard.state}");
  });

  it("keeps the window edge-to-edge in Expo Go: the keyboard hook gets both translucent flags", () => {
    const spy = jest.spyOn(Reanimated, "useAnimatedKeyboard");
    render(<ThemeProvider><AuthHeading title="Masuk" /></ThemeProvider>);
    expect(spy).toHaveBeenCalledWith({ isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true });
    spy.mockRestore();
  });


  it("outlines both the email and the password after a credentials error", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    const [e0, p0] = [borderOf("Email"), borderOf("Kata sandi")];
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("masuk-error");
    expect(borderOf("Email")).not.toBe(e0);
    expect(borderOf("Kata sandi")).not.toBe(p0);
  });


  it("on the email step puts the sign-up line above Masuk, as drawn", async () => {
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    const page = order();
    expect(page.indexOf("button:Daftar dengan email")).toBeLessThan(page.indexOf("button:Masuk"));
    expect(page.indexOf("button:Daftar dengan email")).toBeGreaterThan(page.indexOf("button:Lupa kata sandi?"));
    expect(screen.getByText("Belum punya akun?")).toBeTruthy();
  });

  it("keeps what was typed when going back to the providers and returning", async () => {
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    expect(screen.getByText("Pakai email dan kata sandi akun Catera-mu.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    const back = screen.getByRole("button", { name: "Kembali ke pilihan masuk" });
    expect(StyleSheet.flatten(back.props.style)).toMatchObject({ width: 48, height: 48 });
    fireEvent.press(back);
    expect(screen.queryByLabelText("Email")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Lanjut dengan email" }));
    expect(screen.getByLabelText("Email").props.value).toBe("rani@example.test");
    expect(screen.getByLabelText("Kata sandi").props.value).toBe("synthetic-password");
  });

  it("sets the title at the start, with providers as 52 pills and no method tabs", async () => {
    renderWith(<Masuk />);
    const title = await screen.findByRole("header", { name: "Masuk ke Catera" });
    expect(StyleSheet.flatten(title.props.style).textAlign).not.toBe("center");
    expect(screen.queryByRole("tab")).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId("provider-google").props.style).minHeight).toBe(52);
    // Lupa kata sandi? belongs to the email step only.
    expect(screen.queryByRole("button", { name: "Lupa kata sandi?" })).toBeNull();
  });

  it("puts Lupa kata sandi? right under the password field and gives the toggle a stateful name", async () => {
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    const page = order();
    const gap = page.slice(page.indexOf("field:Kata sandi") + 1, page.indexOf("button:Lupa kata sandi?"));
    expect(page.indexOf("button:Lupa kata sandi?")).toBeGreaterThan(-1);
    expect(gap.every((s) => s === "button:Tampilkan kata sandi")).toBe(true);
    expect(screen.queryByText("Tampilkan")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Tampilkan kata sandi" }));
    expect(screen.getByRole("button", { name: "Sembunyikan kata sandi" })).toBeTruthy();
  });

  it("pins Belum punya akun? Daftar dengan email and Masuk at the bottom of the email step", async () => {
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    const footer = screen.getByTestId("screen-footer");
    expect(within(footer).getByRole("button", { name: "Daftar dengan email" })).toBeTruthy();
    expect(within(footer).getByRole("button", { name: "Masuk" })).toBeTruthy();
    expect(within(footer).queryByLabelText("Email")).toBeNull();
  });

  it("hides the header Close on the email step, so the page's back is the one nav control, and brings it back", async () => {
    const { NavigationContext } = require("expo-router/react-navigation");
    const setOptions = jest.fn();
    const nav = { setOptions, isFocused: () => true, addListener: () => () => undefined, getParent: () => undefined, getState: () => ({ type: "stack", routes: [] }) };
    render(
      <NavigationContext.Provider value={nav as never}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <Masuk />
        </MobileProvider>
      </NavigationContext.Provider>,
    );
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    await waitFor(() => expect(setOptions).toHaveBeenCalled());
    expect(setOptions.mock.calls.at(-1)[0].headerLeft()).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Kembali ke pilihan masuk" }));
    await waitFor(() => expect(setOptions.mock.calls.at(-1)[0].headerLeft()).not.toBeNull());
  });

  it("Android's back on the email step returns to the providers instead of closing Masuk", async () => {
    const { BackHandler } = require("react-native");
    const handlers: (() => boolean)[] = [];
    jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_: string, h: () => boolean) => {
      handlers.push(h);
      return { remove: () => handlers.splice(handlers.indexOf(h), 1) };
    }) as never);
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    expect(handlers).toHaveLength(1);
    let handled = false;
    act(() => {
      handled = handlers[0]();
    });
    expect(handled).toBe(true);
    expect(await screen.findByRole("button", { name: "Lanjut dengan Google" })).toBeTruthy();
    // On the providers the back is the modal's own again.
    expect(handlers).toHaveLength(0);
  });

  it("shows and hides the password", async () => {
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    expect(screen.getByLabelText("Kata sandi").props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: "Tampilkan kata sandi" }));
    expect(screen.getByLabelText("Kata sandi").props.secureTextEntry).toBe(false);
    expect(screen.getByRole("button", { name: "Sembunyikan kata sandi" })).toBeTruthy();
  });

});

describe("Daftar, the same layout", () => {
  it("titles the screen Daftar and puts Sudah punya akun? Masuk under the primary button", async () => {
    renderWith(<Register />);
    expect(await screen.findByRole("header", { name: "Daftar" })).toBeTruthy();
    const page = order();
    expect(page.indexOf("button:Masuk")).toBeGreaterThan(page.indexOf("button:Daftar"));
    expect(screen.getByText("Sudah punya akun?")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/" } });
  });
});
