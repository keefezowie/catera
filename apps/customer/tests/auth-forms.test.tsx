import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { Register } from "../src/account/Register";
import { Recover } from "../src/account/Recover";
import { Masuk } from "../src/account/Masuk";
import { customerLink } from "../src/links";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));
const mockLeave = jest.fn();
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), leaveFor: (...a: unknown[]) => mockLeave(...a) }));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

/** A synthetic Supabase auth client: no network, no real accounts. */
function fakeSupabase() {
  return {
    auth: {
      signUp: jest.fn(async () => ({ data: { session: null, user: { id: "u-new" } }, error: null })),
      resend: jest.fn(async () => ({ error: null })),
      resetPasswordForEmail: jest.fn(async () => ({ error: null })),
      signOut: jest.fn(async () => ({ error: null })),
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      startAutoRefresh: () => undefined,
      stopAutoRefresh: () => undefined,
    },
    rpc: jest.fn(async () => ({ data: {}, error: null })),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: async () => undefined,
  };
}

let supabase: ReturnType<typeof fakeSupabase>;
let runtime: MobileRuntime;

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  mockParams = {};
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
  supabase = fakeSupabase();
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  (runtime as { supabase: unknown }).supabase = supabase;
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: null, demo: false })) } as unknown as MobileRuntime["api"];
});
afterEach(() => jest.restoreAllMocks());

const renderWith = (ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );

const hidden = { includeHiddenElements: true };
const submit = (name = "Masuk") => fireEvent.press(screen.getByRole("button", { name }));
const emailTab = async () => {
  fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
};
const fill = (email = "rani@example.test", password = "synthetic-password") => {
  fireEvent.changeText(screen.getByLabelText("Email"), email);
  fireEvent.changeText(screen.getByLabelText("Kata sandi"), password);
};
const borderOf = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style).borderColor;

describe("Masuk validation and errors", () => {
  it("Masuk submit with a bad email shows the field message and sends nothing", async () => {
    runtime.signInPassword = jest.fn();
    renderWith(<Masuk />);
    await emailTab();
    fill("rani@", "synthetic-password");
    submit();
    expect(await screen.findByText("Format email belum benar. Contoh: nama@gmail.com")).toBeTruthy();
    expect(runtime.signInPassword).not.toHaveBeenCalled();
    // Empty is the only password rule on sign in.
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "");
    submit();
    expect(await screen.findByText("Isi kata sandimu dulu.")).toBeTruthy();
  });

  it("second wrong password adds Lupa kata sandi?", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderWith(<Masuk />);
    await emailTab();
    fill();
    submit();
    const error = await screen.findByTestId("masuk-error");
    expect(within(error).getByText("Email atau kata sandinya salah.")).toBeTruthy();
    expect(within(error).queryByText("Lupa kata sandi?")).toBeNull();
    // The password is cleared; the email stays.
    expect(screen.getByLabelText("Kata sandi").props.value).toBe("");
    expect(screen.getByLabelText("Email").props.value).toBe("rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "another-password");
    submit();
    await waitFor(() => expect(runtime.signInPassword).toHaveBeenCalledTimes(2));
    fireEvent.press(await within(await screen.findByTestId("masuk-error")).findByText("Lupa kata sandi?"));
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/recover" }));
  });

  it("unverified offers Kirim ulang tautan and opens CheckEmail", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("EMAIL_NOT_CONFIRMED");
    });
    renderWith(<Masuk />);
    await emailTab();
    fill();
    submit();
    const error = await screen.findByTestId("masuk-error");
    expect(within(error).getByText("Emailmu belum diverifikasi.")).toBeTruthy();
    fireEvent.press(within(error).getByText("Kirim ulang tautan"));
    expect(await screen.findByText("Cek emailmu")).toBeTruthy();
    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "rani@example.test",
      options: { emailRedirectTo: "catera://auth/callback" },
    });
    expect(screen.getByText("rani@example.test")).toBeTruthy();
  });

  it("offline keeps typed values, outlines nothing, says Belum ada koneksi", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("OFFLINE");
    });
    renderWith(<Masuk />);
    await emailTab();
    const before = borderOf("Email");
    fill();
    submit();
    const error = await screen.findByTestId("masuk-error");
    expect(within(error).getByText("Belum ada koneksi. Cek internetmu, lalu coba lagi.")).toBeTruthy();
    expect(screen.getByLabelText("Email").props.value).toBe("rani@example.test");
    expect(screen.getByLabelText("Kata sandi").props.value).toBe("synthetic-password");
    expect(borderOf("Email")).toBe(before);
    expect(borderOf("Kata sandi")).toBe(before);
    expect(screen.getByTestId("auth-mascot-mencari", hidden)).toBeTruthy();
    // Coba lagi repeats the step.
    fireEvent.press(within(error).getByText("Coba lagi"));
    await waitFor(() => expect(runtime.signInPassword).toHaveBeenCalledTimes(2));
  });

  it("429 shows a 60s countdown on the button", async () => {
    jest.useFakeTimers();
    try {
      runtime.signInPassword = jest.fn(async () => {
        throw new Error("AUTH_RATE_LIMITED");
      });
      renderWith(<Masuk />);
      fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
      fill();
      submit();
      const wait = await screen.findByRole("button", { name: "Coba lagi dalam 1:00" });
      expect(wait).toBeDisabled();
      expect(screen.getByText("Terlalu banyak percobaan. Coba lagi dalam 1:00.")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(59_000);
      });
      expect(screen.getByRole("button", { name: "Coba lagi dalam 0:01" })).toBeDisabled();
      expect(screen.getByText("Terlalu banyak percobaan. Coba lagi dalam 0:01.")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
      expect(screen.getByRole("button", { name: "Masuk" })).toBeEnabled();
      expect(screen.queryByTestId("masuk-error")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("an unknown failure says so plainly and offers Coba lagi, a field failure does not", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("SOMETHING_ELSE");
    });
    renderWith(<Masuk />);
    await emailTab();
    fill();
    submit();
    const error = await screen.findByTestId("masuk-error");
    expect(within(error).getByText("Ada gangguan di sisi kami. Coba lagi sebentar lagi.")).toBeTruthy();
    fireEvent.press(within(error).getByText("Coba lagi"));
    await waitFor(() => expect(runtime.signInPassword).toHaveBeenCalledTimes(2));
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    submit();
    await waitFor(() => expect(within(screen.getByTestId("masuk-error")).queryByText("Coba lagi")).toBeNull());
  });

  it("the verified ring shows for 400ms before the screen leaves", async () => {
    jest.useFakeTimers();
    try {
      runtime.sendPhoneOtp = jest.fn(async () => undefined);
      runtime.verifyPhoneOtp = jest.fn(async () => ({ id: "u-1" })) as never;
      renderWith(<Masuk />);
      fireEvent.changeText(await screen.findByLabelText("Nomor HP"), "0812 3456 7890");
      fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
      fireEvent.changeText(await screen.findByLabelText("Kode dari SMS"), "123456");
      expect(await screen.findByTestId("code-verified", hidden)).toBeTruthy();
      expect(router.replace).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(399);
      });
      expect(mockLeave).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(mockLeave).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("a phone press with nothing typed shows the field message and sends nothing", async () => {
    runtime.sendPhoneOtp = jest.fn();
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Kirim kode" }));
    expect(await screen.findByText("Isi nomor HP-mu dulu.")).toBeTruthy();
    expect(runtime.sendPhoneOtp).not.toHaveBeenCalled();
  });

  it("mascot is bingung after a failure and melambai after the next edit", async () => {
    renderWith(<Masuk />);
    await emailTab();
    expect(screen.getByTestId("auth-mascot-melambai", hidden)).toBeTruthy();
    submit();
    expect(screen.getByTestId("auth-mascot-bingung", hidden)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Email"), "r");
    expect(screen.getByTestId("auth-mascot-melambai", hidden)).toBeTruthy();
  });

  it("server trouble keeps the mascot waving, offline searches, a wrong password is bingung", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("AUTH_UNAVAILABLE");
    });
    renderWith(<Masuk />);
    await emailTab();
    fill();
    submit();
    await screen.findByTestId("masuk-error");
    expect(screen.getByTestId("auth-mascot-melambai", hidden)).toBeTruthy();
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("OFFLINE");
    });
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    submit();
    await screen.findByText("Belum ada koneksi. Cek internetmu, lalu coba lagi.");
    expect(screen.getByTestId("auth-mascot-mencari", hidden)).toBeTruthy();
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    submit();
    await screen.findByText("Email atau kata sandinya salah.");
    expect(screen.getByTestId("auth-mascot-bingung", hidden)).toBeTruthy();
  });

  it("Coba lagi retries with what is typed now, not what was typed at the failure", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("OFFLINE");
    });
    renderWith(<Masuk />);
    await emailTab();
    fill();
    submit();
    const error = await screen.findByTestId("masuk-error");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "typed-after-the-failure");
    fireEvent.press(within(error).getByText("Coba lagi"));
    await waitFor(() => expect(runtime.signInPassword).toHaveBeenCalledTimes(2));
    expect(runtime.signInPassword).toHaveBeenLastCalledWith("rani@example.test", "typed-after-the-failure", expect.any(String), "Pelanggan");
  });

  it("Coba lagi after a server failure on the code check re-sends the typed code and counts no wrong code", async () => {
    runtime.sendPhoneOtp = jest.fn(async () => undefined);
    let calls = 0;
    runtime.verifyPhoneOtp = jest.fn(async (_phone: string, code: string) => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("AUTH_UNAVAILABLE"), { code: "AUTH_UNAVAILABLE" });
      if (code !== "123456") throw Object.assign(new Error("INVALID_OTP"), { code: "INVALID_OTP" });
      return { id: "u-1" };
    }) as never;
    renderWith(<Masuk />);
    fireEvent.changeText(await screen.findByLabelText("Nomor HP"), "0812 3456 7890");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    fireEvent.changeText(await screen.findByLabelText("Kode dari SMS"), "123456");
    const error = await screen.findByTestId("masuk-error");
    expect(screen.getByLabelText("Kode dari SMS").props.value).toBe("123456");
    fireEvent.press(within(error).getByText("Coba lagi"));
    await waitFor(() => expect(runtime.verifyPhoneOtp).toHaveBeenCalledTimes(2));
    expect((runtime.verifyPhoneOtp as jest.Mock).mock.calls[1][1]).toBe("123456");
    expect(screen.queryByText(/Kodenya salah/)).toBeNull();
  });

  it("a registered email offers its Masuk action, never Coba lagi", async () => {
    supabase.auth.signUp.mockResolvedValueOnce({ data: { session: null, user: { id: "u-old", identities: [] } }, error: null } as never);
    renderWith(<Register />);
    fireEvent.changeText(await screen.findByLabelText("Nama"), "Rani");
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    fireEvent.press(screen.getByRole("button", { name: "Daftar & verifikasi email" }));
    const error = await screen.findByTestId("identity-error");
    expect(within(error).getByText("Masuk dengan email ini")).toBeTruthy();
    expect(within(error).queryByText("Coba lagi")).toBeNull();
  });

  it("opens on the Email tab with the address filled when Daftar sends it", async () => {
    mockParams = { email: "rani@example.test" };
    renderWith(<Masuk />);
    expect((await screen.findByLabelText("Email")).props.value).toBe("rani@example.test");
    expect(screen.getByRole("tab", { name: "Email" }).props.accessibilityState.selected).toBe(true);
  });

});

describe("Daftar validation and errors", () => {
  it("Daftar registered email action opens Masuk with the email filled", async () => {
    mockParams = { next: "/beli/p-1" };
    supabase.auth.signUp.mockResolvedValueOnce({ data: { session: null, user: { id: "u-old", identities: [] } }, error: null } as never);
    renderWith(<Register />);
    fireEvent.changeText(await screen.findByLabelText("Nama"), "Rani");
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    fireEvent.press(screen.getByRole("button", { name: "Daftar & verifikasi email" }));
    fireEvent.press(await screen.findByText("Masuk dengan email ini"));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/beli/p-1", email: "rani@example.test" } });
  });

  it("a press with short fields shows every message, sends nothing and confuses the mascot", async () => {
    renderWith(<Register />);
    fireEvent.changeText(await screen.findByLabelText("Nama"), "R");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "short");
    fireEvent.press(screen.getByRole("button", { name: "Daftar & verifikasi email" }));
    expect(await screen.findByText("Tulis namamu, minimal 2 huruf.")).toBeTruthy();
    expect(screen.getByText("Isi emailmu dulu.")).toBeTruthy();
    expect(screen.getByText("Minimal 8 karakter")).toBeTruthy();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-mascot-bingung", hidden)).toBeTruthy();
  });
});

describe("Daftar and Pemulihan rate wait", () => {
  it("Daftar counts down a 429 on its button", async () => {
    jest.useFakeTimers();
    try {
      supabase.auth.signUp.mockResolvedValueOnce({ data: { session: null, user: null }, error: { status: 429, code: "over_request_rate_limit" } } as never);
      renderWith(<Register />);
      fireEvent.changeText(await screen.findByLabelText("Nama"), "Rani");
      fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
      fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
      fireEvent.press(screen.getByRole("button", { name: "Daftar & verifikasi email" }));
      expect(await screen.findByRole("button", { name: "Coba lagi dalam 1:00" })).toBeDisabled();
      expect(screen.getByText("Terlalu banyak percobaan. Coba lagi dalam 1:00.")).toBeTruthy();
      expect(within(screen.getByTestId("identity-error")).queryByText("Coba lagi")).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByRole("button", { name: "Daftar & verifikasi email" })).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Pemulihan validation and neutrality", () => {
  it("Pemulihan stays neutral for an unknown email", async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { code: "user_not_found", status: 400 } } as never);
    renderWith(<Recover />);
    fireEvent.changeText(await screen.findByLabelText("Email"), "nobody@example.test");
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan pemulihan" }));
    expect(await screen.findByText("Cek emailmu")).toBeTruthy();
    expect(screen.queryByTestId("identity-error")).toBeNull();
  });

  it("a bad email shows the message and sends nothing", async () => {
    renderWith(<Recover />);
    fireEvent.changeText(await screen.findByLabelText("Email"), "nope");
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan pemulihan" }));
    expect(await screen.findByText("Format email belum benar. Contoh: nama@gmail.com")).toBeTruthy();
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
