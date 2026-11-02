import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { Platform, StyleSheet } from "react-native";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { createMobileRuntime, isAppleSignInAvailable, oauthRedirectPending } from "@catera/mobile-core";
import { BUSY_DELAY_MS, ProviderButton, StepHeader, ThemeProvider } from "@catera/mobile-ui";
import { redirectSystemPath } from "../app/+native-intent";

jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "raw-nonce"),
  digestStringAsync: jest.fn(async (_alg: string, v: string) => `sha256(${v})`),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));
const mockAuth = {
  signInWithOAuth: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  signInWithIdToken: jest.fn(),
  updateUser: jest.fn(async () => ({ data: {}, error: null })),
  signOut: jest.fn(async () => ({ error: null })),
};
const mockRpc = jest.fn();
jest.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: mockAuth, rpc: mockRpc }) }));

const runtime = () =>
  createMobileRuntime({ apiUrl: "http://x.test", supabaseUrl: "http://s.test", supabaseKey: "k", storagePrefix: "catera", app: "customer" });
const caught = async (p: Promise<unknown>) => p.then(() => null, (e: Error) => e.message);
const REDIRECT = "catera://auth/callback";
const actor = { id: "actor-1", role: "customer" };
const session = { access_token: "a" };

const openAuth = WebBrowser.openAuthSessionAsync as jest.Mock;
const appleSignIn = AppleAuthentication.signInAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: "https://s.test/auth/v1/authorize?provider=google" }, error: null });
  mockRpc.mockImplementation(async (fn: string) => (fn === "catera_v1_read" ? { data: actor, error: null } : { data: null, error: null }));
});

describe("signInWithGoogle", () => {
  it("opens the auth session, exchanges the code it captured and ensures the profile with the Google name", async () => {
    openAuth.mockImplementationOnce(async () => {
      // The browser is open: an Android deep link to the callback opens nothing.
      expect(oauthRedirectPending()).toBe(true);
      expect(redirectSystemPath({ path: `${REDIRECT}?code=abc`, initial: false })).toBeNull();
      return { type: "success", url: `${REDIRECT}?code=abc` };
    });
    mockAuth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "u1", user_metadata: { full_name: "Sari Wulandari" } }, session },
      error: null,
    });
    await expect(runtime().signInWithGoogle(REDIRECT, "req-1")).resolves.toEqual(actor);
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: REDIRECT, skipBrowserRedirect: true } });
    expect(openAuth).toHaveBeenCalledWith("https://s.test/auth/v1/authorize?provider=google", REDIRECT);
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(mockRpc).toHaveBeenCalledWith("catera_v1_command", { action: "profile.ensure", payload: { name: "Sari Wulandari" }, request_id: "req-1" });
    expect(oauthRedirectPending()).toBe(false);
  });

  it("is CANCELLED when the person closes the browser or declines, and exchanges nothing", async () => {
    openAuth.mockResolvedValueOnce({ type: "cancel" });
    expect(await caught(runtime().signInWithGoogle(REDIRECT, "r"))).toBe("CANCELLED");
    openAuth.mockResolvedValueOnce({ type: "dismiss" });
    expect(await caught(runtime().signInWithGoogle(REDIRECT, "r"))).toBe("CANCELLED");
    openAuth.mockResolvedValueOnce({ type: "success", url: `${REDIRECT}#error=access_denied&error_description=x` });
    expect(await caught(runtime().signInWithGoogle(REDIRECT, "r"))).toBe("CANCELLED");
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(oauthRedirectPending()).toBe(false);
  });

  it("maps a redirect error, a failed exchange, offline and the rate limit to codes", async () => {
    openAuth.mockResolvedValue({ type: "success", url: `${REDIRECT}?error=server_error` });
    expect(await caught(runtime().signInWithGoogle(REDIRECT, "r"))).toBe("AUTH_UNAVAILABLE");
    openAuth.mockResolvedValue({ type: "success", url: `${REDIRECT}?code=abc` });
    mockAuth.exchangeCodeForSession.mockResolvedValueOnce({ data: { user: null, session: null }, error: { status: 400, code: "bad_code_verifier" } });
    expect(await caught(runtime().signInWithGoogle(REDIRECT, "r"))).toBe("AUTH_UNAVAILABLE");
    mockAuth.exchangeCodeForSession.mockRejectedValueOnce(new TypeError("Network request failed"));
    expect(await caught(runtime().signInWithGoogle(REDIRECT, "r"))).toBe("OFFLINE");
    mockAuth.signInWithOAuth.mockResolvedValueOnce({ data: { url: null }, error: { status: 429 } });
    expect(await caught(runtime().signInWithGoogle(REDIRECT, "r"))).toBe("AUTH_RATE_LIMITED");
  });

  it("signs out again when the profile cannot be ensured", async () => {
    openAuth.mockResolvedValueOnce({ type: "success", url: `${REDIRECT}?code=abc` });
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1", user_metadata: {} }, session }, error: null });
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(runtime().signInWithGoogle(REDIRECT, "r")).rejects.toBeTruthy();
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("lets an email link through to the callback when no Google sign-in is open", () => {
    expect(redirectSystemPath({ path: `${REDIRECT}?code=abc`, initial: false })).toMatch(/auth\/callback\?code=abc$/);
  });
});

describe("signInWithApple", () => {
  const onIos = () => jest.replaceProperty(Platform, "OS", "ios");
  afterEach(() => jest.restoreAllMocks());

  it("is NOT_AVAILABLE off iOS", async () => {
    expect(await caught(runtime().signInWithApple("r"))).toBe("NOT_AVAILABLE");
    expect(await isAppleSignInAvailable()).toBe(false);
    expect(AppleAuthentication.isAvailableAsync).not.toHaveBeenCalled();
  });

  it("sends the hashed nonce to Apple and the raw one to Supabase, with the first-sign-in name", async () => {
    onIos();
    appleSignIn.mockResolvedValueOnce({ identityToken: "id-token", fullName: { givenName: "Budi", familyName: "Santoso" } });
    mockAuth.signInWithIdToken.mockResolvedValue({ data: { user: { id: "u1", user_metadata: {} }, session }, error: null });
    await expect(runtime().signInWithApple("req-2")).resolves.toEqual(actor);
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith("SHA-256", "raw-nonce");
    expect(appleSignIn).toHaveBeenCalledWith({ requestedScopes: [0, 1], nonce: "sha256(raw-nonce)" });
    expect(mockAuth.signInWithIdToken).toHaveBeenCalledWith({ provider: "apple", token: "id-token", nonce: "raw-nonce" });
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ data: { full_name: "Budi Santoso" } });
    expect(mockRpc).toHaveBeenCalledWith("catera_v1_command", { action: "profile.ensure", payload: { name: "Budi Santoso" }, request_id: "req-2" });
  });

  it("is CANCELLED when the sheet is cancelled, and AUTH_UNAVAILABLE when Supabase refuses the token", async () => {
    onIos();
    expect(await caught(runtime().signInWithApple("r"))).toBe("CANCELLED");
    expect(mockAuth.signInWithIdToken).not.toHaveBeenCalled();
    appleSignIn.mockResolvedValueOnce({ identityToken: "id-token", fullName: null });
    mockAuth.signInWithIdToken.mockResolvedValueOnce({ data: { user: null, session: null }, error: { status: 400, code: "provider_disabled" } });
    expect(await caught(runtime().signInWithApple("r"))).toBe("AUTH_UNAVAILABLE");
  });

  it("is available on iOS only when the device says so", async () => {
    onIos();
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
    expect(await isAppleSignInAvailable()).toBe(true);
  });
});

describe("ProviderButton", () => {
  const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

  it("draws each provider with its mark, its label as the spoken name and a 52 target", async () => {
    const onPress = jest.fn();
    await render(
      <>
        <ProviderButton provider="apple" label="Lanjut dengan Apple" onPress={onPress} />
        <ProviderButton provider="google" label="Lanjut dengan Google" onPress={onPress} />
        <ProviderButton provider="email" label="Lanjut dengan email" onPress={onPress} />
      </>,
    );
    for (const p of ["apple", "google", "email"]) {
      expect(screen.getByTestId(`provider-mark-${p}`)).toBeTruthy();
      expect(flat(`provider-${p}`).minHeight).toBe(52);
    }
    expect(screen.getByRole("button", { name: "Lanjut dengan Google" })).toBeTruthy();
    expect(flat("provider-apple").backgroundColor).toBe("#000000");
    expect(flat("provider-google").borderWidth).toBe(1.5);
    await fireEvent.press(screen.getByRole("button", { name: "Lanjut dengan email" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("turns Apple white in dark, per Apple's guidelines", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    await render(
      <ThemeProvider storageKey="k">
        <ProviderButton provider="apple" label="Lanjut dengan Apple" onPress={() => {}} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(flat("provider-apple").backgroundColor).toBe("#FFFFFF"));
    jest.restoreAllMocks();
  });

  it("busy shows a spinner after the delay, keeps the label as its name and ignores presses", async () => {
    jest.useFakeTimers();
    const onPress = jest.fn();
    await render(<ProviderButton provider="google" label="Lanjut dengan Google" onPress={onPress} busy />);
    expect(screen.queryByTestId("provider-spinner")).toBeNull();
    await act(() => jest.advanceTimersByTime(BUSY_DELAY_MS));
    expect(screen.getByTestId("provider-spinner")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Lanjut dengan Google" });
    expect(button.props.accessibilityState).toMatchObject({ busy: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe("StepHeader", () => {
  it("fills the segments up to the step, counts n/N and is one progressbar", async () => {
    const onBack = jest.fn();
    await render(<StepHeader step={2} total={4} onBack={onBack} />);
    const fills = [1, 2, 3, 4].map((n) => StyleSheet.flatten(screen.getByTestId(`step-segment-${n}`).props.style).backgroundColor);
    expect(fills[0]).toBe(fills[1]);
    expect(fills[2]).toBe(fills[3]);
    expect(fills[1]).not.toBe(fills[2]);
    expect(StyleSheet.flatten(screen.getByTestId("step-segment-1").props.style)).toMatchObject({ height: 6, borderRadius: 3 });
    expect(screen.getByText("2/4")).toBeTruthy();
    const bar = screen.getByTestId("step-bar");
    expect(bar.props.accessibilityRole).toBe("progressbar");
    expect(bar.props.accessibilityLabel).toBe("Langkah 2 dari 4");
    expect(bar.props.accessibilityValue).toEqual({ min: 1, max: 4, now: 2 });
    await fireEvent.press(screen.getByRole("button", { name: "Kembali" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("uses the platform back glyph and a given back label", async () => {
    await render(<StepHeader step={1} total={3} onBack={() => {}} backLabel="Kembali ke Masuk" os="ios" />);
    expect(screen.getByRole("button", { name: "Kembali ke Masuk" })).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId("step-back").props.style)).toMatchObject({ width: 48, height: 48 });
  });
});
