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
  await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
};
const fill = async (email = "rani@example.test", password = "synthetic-password") => {
  await fireEvent.changeText(screen.getByLabelText("Email"), email);
  await fireEvent.changeText(screen.getByLabelText("Kata sandi"), password);
};
const borderOf = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style).borderColor;

describe("Masuk validation and errors", () => {
  it("Masuk submit with a bad email shows the field message and sends nothing", async () => {
    runtime.signInPassword = jest.fn();
    await renderWith(<Masuk />);
    await emailTab();
    await fill("rani@", "synthetic-password");
    await submit();
    expect(await screen.findByText("Format email belum benar. Contoh: nama@gmail.com")).toBeTruthy();
    expect(runtime.signInPassword).not.toHaveBeenCalled();
    // Empty is the only password rule on sign in.
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "");
    await submit();
    expect(await screen.findByText("Isi kata sandimu dulu.")).toBeTruthy();
  });

  it("second wrong password adds Lupa kata sandi?", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    await renderWith(<Masuk />);
    await emailTab();
    await fill();
    await submit();
    const error = await screen.findByTestId("masuk-error");
    expect(within(error).getByText("Email atau kata sandinya salah.")).toBeTruthy();
    expect(within(error).queryByText("Lupa kata sandi?")).toBeNull();
    // The password is cleared; the email stays.
    expect(screen.getByLabelText("Kata sandi").props.value).toBe("");
    expect(screen.getByLabelText("Email").props.value).toBe("rani@example.test");
    // The app emptied the field, so it is not also blamed for being empty.
    expect(screen.queryByText("Isi kata sandimu dulu.")).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "another-password");
    await submit();
    await waitFor(() => expect(runtime.signInPassword).toHaveBeenCalledTimes(2));
    await fireEvent.press(await within(await screen.findByTestId("masuk-error")).findByText("Lupa kata sandi?"));
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/recover" }));
  });

  it("unverified offers Kirim ulang tautan and opens CheckEmail", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("EMAIL_NOT_CONFIRMED");
    });
    await renderWith(<Masuk />);
    await emailTab();
    await fill();
    await submit();
    const error = await screen.findByTestId("masuk-error");
    expect(within(error).getByText("Emailmu belum diverifikasi.")).toBeTruthy();
    await fireEvent.press(within(error).getByText("Kirim ulang tautan"));
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
    await renderWith(<Masuk />);
    await emailTab();
    const before = borderOf("Email");
    await fill();
    await submit();
    const error = await screen.findByTestId("masuk-error");
    expect(within(error).getByText("Belum ada koneksi. Cek internetmu, lalu coba lagi.")).toBeTruthy();
    expect(screen.getByLabelText("Email").props.value).toBe("rani@example.test");
    expect(screen.getByLabelText("Kata sandi").props.value).toBe("synthetic-password");
    expect(borderOf("Email")).toBe(before);
    expect(borderOf("Kata sandi")).toBe(before);
    expect(screen.getByTestId("auth-mascot-mencari", hidden)).toBeTruthy();
    // Coba lagi repeats the step.
    await fireEvent.press(within(error).getByText("Coba lagi"));
    await waitFor(() => expect(runtime.signInPassword).toHaveBeenCalledTimes(2));
  });

  it("429 shows a 60s countdown on the button", async () => {
    jest.useFakeTimers();
    try {
      runtime.signInPassword = jest.fn(async () => {
        throw new Error("AUTH_RATE_LIMITED");
      });
      await renderWith(<Masuk />);
      await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
      await fill();
      await submit();
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
    await renderWith(<Masuk />);
    await emailTab();
    await fill();
    await submit();
    const error = await screen.findByTestId("masuk-error");
    expect(within(error).getByText("Ada gangguan di sisi kami. Coba lagi sebentar lagi.")).toBeTruthy();
    await fireEvent.press(within(error).getByText("Coba lagi"));
    await waitFor(() => expect(runtime.signInPassword).toHaveBeenCalledTimes(2));
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    await submit();
    await waitFor(() => expect(within(screen.getByTestId("masuk-error")).queryByText("Coba lagi")).toBeNull());
  });




  it("mascot is bingung after a failure and melambai after the next edit", async () => {
    await renderWith(<Masuk />);
    await emailTab();
    expect(screen.getByTestId("auth-mascot-melambai", hidden)).toBeTruthy();
    await submit();
    expect(screen.getByTestId("auth-mascot-bingung", hidden)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Email"), "r");
    expect(screen.getByTestId("auth-mascot-melambai", hidden)).toBeTruthy();
  });

  it("server trouble keeps the mascot waving, offline searches, a wrong password is bingung", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("AUTH_UNAVAILABLE");
    });
    await renderWith(<Masuk />);
    await emailTab();
    await fill();
    await submit();
    await screen.findByTestId("masuk-error");
    expect(screen.getByTestId("auth-mascot-melambai", hidden)).toBeTruthy();
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("OFFLINE");
    });
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    await submit();
    await screen.findByText("Belum ada koneksi. Cek internetmu, lalu coba lagi.");
    expect(screen.getByTestId("auth-mascot-mencari", hidden)).toBeTruthy();
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    await submit();
    await screen.findByText("Email atau kata sandinya salah.");
    expect(screen.getByTestId("auth-mascot-bingung", hidden)).toBeTruthy();
  });

  it("Coba lagi retries with what is typed now, not what was typed at the failure", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("OFFLINE");
    });
    await renderWith(<Masuk />);
    await emailTab();
    await fill();
    await submit();
    const error = await screen.findByTestId("masuk-error");
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "typed-after-the-failure");
    await fireEvent.press(within(error).getByText("Coba lagi"));
    await waitFor(() => expect(runtime.signInPassword).toHaveBeenCalledTimes(2));
    expect(runtime.signInPassword).toHaveBeenLastCalledWith("rani@example.test", "typed-after-the-failure", expect.any(String), "Pelanggan");
  });


  it("a registered email offers its Masuk action, never Coba lagi", async () => {
    supabase.auth.signUp.mockResolvedValueOnce({ data: { session: null, user: { id: "u-old", identities: [] } }, error: null } as never);
    await renderWith(<Register />);
    await fireEvent.changeText(await screen.findByLabelText("Nama"), "Rani");
    await fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    await fireEvent.press(screen.getByRole("button", { name: "Daftar" }));
    const error = await screen.findByTestId("identity-error");
    expect(within(error).getByText("Masuk dengan email ini")).toBeTruthy();
    expect(within(error).queryByText("Coba lagi")).toBeNull();
  });

  it("opens on the email step with the address filled when Daftar sends it", async () => {
    mockParams = { email: "rani@example.test" };
    await renderWith(<Masuk />);
    expect((await screen.findByLabelText("Email")).props.value).toBe("rani@example.test");
    expect(screen.queryByRole("button", { name: "Lanjut dengan Google" })).toBeNull();
  });

});

describe("Masuk providers", () => {
  const customer = { id: "u-g1", role: "customer", name: "Sari Wulandari", phone: "+6281234567890" };

  it("offers Google and email, Apple only where the device has it, and the legal line", async () => {
    await renderWith(<Masuk />);
    expect(await screen.findByText("Masuk ke Catera")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lanjut dengan Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lanjut dengan email" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lanjut dengan Apple" })).toBeNull();
    expect(screen.getByTestId("legal-line")).toBeTruthy();
    for (const link of screen.getAllByRole("link")) expect(StyleSheet.flatten(link.props.style).textDecorationLine).toBe("underline");
    expect(screen.getAllByRole("link")).toHaveLength(2);
    // No phone sign-in is left.
    expect(screen.queryByLabelText("Nomor WhatsApp")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("shows Apple when the device offers it, and signs in with it", async () => {
    jest.replaceProperty(require("react-native").Platform, "OS", "ios");
    (require("expo-apple-authentication").isAvailableAsync as jest.Mock).mockResolvedValueOnce(true);
    runtime.signInWithApple = jest.fn(async () => customer) as never;
    await renderWith(<Masuk />);
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan Apple" }));
    await waitFor(() => expect(mockLeave).toHaveBeenCalledWith("/"));
    expect(runtime.signInWithApple).toHaveBeenCalledWith(expect.any(String));
  });

  it("Google success signs in and leaves for next", async () => {
    mockParams = { next: "/jadwal" };
    runtime.signInWithGoogle = jest.fn(async () => customer) as never;
    await renderWith(<Masuk />);
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan Google" }));
    await waitFor(() => expect(mockLeave).toHaveBeenCalledWith("/jadwal"));
    expect(runtime.signInWithGoogle).toHaveBeenCalledWith("catera://auth/callback", expect.any(String));
  });

  it("a cancelled Google page is silent; a failure shows under the buttons with Coba lagi", async () => {
    runtime.signInWithGoogle = jest
      .fn()
      .mockRejectedValueOnce(new Error("CANCELLED"))
      .mockRejectedValueOnce(new Error("AUTH_UNAVAILABLE"))
      .mockResolvedValueOnce(customer) as never;
    await renderWith(<Masuk />);
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan Google" }));
    await waitFor(() => expect(runtime.signInWithGoogle).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("masuk-error")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Lanjut dengan Google" }));
    const error = await screen.findByTestId("masuk-error");
    expect(within(error).getByText("Ada gangguan di sisi kami. Coba lagi sebentar lagi.")).toBeTruthy();
    await fireEvent.press(within(error).getByText("Coba lagi"));
    await waitFor(() => expect(mockLeave).toHaveBeenCalledTimes(1));
  });

  it("NOT_AVAILABLE is said plainly", async () => {
    runtime.signInWithGoogle = jest.fn(async () => {
      throw new Error("NOT_AVAILABLE");
    }) as never;
    await renderWith(<Masuk />);
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan Google" }));
    expect(await screen.findByText("Cara masuk ini belum bisa dipakai di HP ini. Pilih cara lain.")).toBeTruthy();
  });

  it("the email step has its back, Lupa kata sandi and Daftar dengan email", async () => {
    await renderWith(<Masuk />);
    await emailTab();
    expect(screen.getByText("Masuk dengan email")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Daftar dengan email" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/register", params: { next: "/" } });
    await fireEvent.press(screen.getByRole("button", { name: "Kembali ke pilihan masuk" }));
    expect(await screen.findByRole("button", { name: "Lanjut dengan Google" })).toBeTruthy();
  });

  it("opens on the email step when asked to (the claim's email button)", async () => {
    mockParams = { method: "email", next: "/claim/abc" };
    await renderWith(<Masuk />);
    expect(await screen.findByLabelText("Email")).toBeTruthy();
  });
});

describe("Lengkapi akun", () => {
  const session = (user: Record<string, unknown>) =>
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user } } } as never);
  const google = { app_metadata: { provider: "google" }, user_metadata: { full_name: "Sari Wulandari" } };
  const fresh = { id: "u-g2", role: "customer", name: "Pelanggan", phone: null };

  beforeEach(() => {
    (supabase.auth as Record<string, unknown>).updateUser = jest.fn(async () => ({ data: {}, error: null }));
  });

  const signIn = async () => {
    runtime.signInWithGoogle = jest.fn(async () => fresh) as never;
    await renderWith(<Masuk />);
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan Google" }));
  };

  it("shows after a first Google sign-in, prefilled, and saves name and WhatsApp", async () => {
    session(google);
    runtime.api = { ...runtime.api, command: jest.fn(async () => ({})) } as never;
    mockParams = { next: "/jadwal" };
    await signIn();
    expect(await screen.findByText("Siapa namamu?")).toBeTruthy();
    expect(screen.getByLabelText("Nama").props.value).toBe("Sari Wulandari");
    expect(screen.getByText("Dari akun Google-mu. Ubah kalau perlu.")).toBeTruthy();
    expect(screen.getByTestId("step-bar").props.accessibilityLabel).toBe("Langkah 1 dari 2");
    expect(mockLeave).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Lanjut" }));
    expect(await screen.findByText("Nomor WhatsApp-mu")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "0812");
    await fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
    expect(await screen.findByText("Nomornya belum benar. Contoh: 0812 3456 7890")).toBeTruthy();
    expect(runtime.api.command).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "0812 3456 7890");
    await fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
    await waitFor(() => expect(mockLeave).toHaveBeenCalledWith("/jadwal"));
    expect(runtime.api.command).toHaveBeenCalledWith(
      "profile.update",
      { name: "Sari Wulandari", phone: "+6281234567890" },
      expect.any(String),
    );
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { catera_onboarded: true } });
    expect(store.get("catera.onboarded.u-g2")).toBe("1");
  });

  it("Nanti saja keeps the name, skips the number and never shows again", async () => {
    session(google);
    runtime.api = { ...runtime.api, command: jest.fn(async () => ({})) } as never;
    await signIn();
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Nanti saja" }));
    await waitFor(() => expect(mockLeave).toHaveBeenCalledWith("/"));
    expect(runtime.api.command).toHaveBeenCalledWith("profile.update", { name: "Sari Wulandari" }, expect.any(String));
    await screen.unmount();
    mockLeave.mockClear();
    await signIn();
    await waitFor(() => expect(mockLeave).toHaveBeenCalledWith("/"));
    expect(screen.queryByText("Siapa namamu?")).toBeNull();
  });

  it("Nanti saja with the name unchanged sends nothing, so it works offline", async () => {
    session({ app_metadata: { provider: "google" }, user_metadata: {} });
    runtime.api = { ...runtime.api, command: jest.fn(async () => Promise.reject(new Error("OFFLINE"))) } as never;
    runtime.signInWithGoogle = jest.fn(async () => ({ ...fresh, name: "Sari" })) as never;
    await renderWith(<Masuk />);
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan Google" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Nanti saja" }));
    await waitFor(() => expect(mockLeave).toHaveBeenCalledWith("/"));
    expect(runtime.api.command).not.toHaveBeenCalled();
    expect(store.get("catera.onboarded.u-g2")).toBe("1");
  });

  it("Android's back on step 2 returns to step 1", async () => {
    const { BackHandler } = require("react-native");
    const handlers: (() => boolean)[] = [];
    jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_: string, h: () => boolean) => {
      handlers.push(h);
      return { remove: () => handlers.splice(handlers.indexOf(h), 1) };
    }) as never);
    session(google);
    await signIn();
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut" }));
    expect(await screen.findByText("Nomor WhatsApp-mu")).toBeTruthy();
    let handled = false;
    await act(() => {
      handled = handlers[handlers.length - 1]();
    });
    expect(handled).toBe(true);
    expect(await screen.findByText("Siapa namamu?")).toBeTruthy();
  });

  it("a provider sign-in forgets a pending email link, whose PKCE verifier it replaced", async () => {
    store.set("catera.auth.pending", JSON.stringify({ purpose: "signup", next: "/", at: Date.now(), email: "rani@example.test" }));
    session({ ...google, user_metadata: { catera_onboarded: true } });
    await signIn();
    await waitFor(() => expect(mockLeave).toHaveBeenCalled());
    expect(store.has("catera.auth.pending")).toBe(false);
  });

  it("step 2's back returns to the name", async () => {
    session(google);
    await signIn();
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Kembali" }));
    expect(await screen.findByText("Siapa namamu?")).toBeTruthy();
  });

  it("is skipped when the account says it was done, or already has a name and a number", async () => {
    session({ ...google, user_metadata: { ...google.user_metadata, catera_onboarded: true } });
    await signIn();
    await waitFor(() => expect(mockLeave).toHaveBeenCalledWith("/"));
    await screen.unmount();
    mockLeave.mockClear();
    store.clear();
    session(google);
    runtime.signInWithGoogle = jest.fn(async () => ({ ...fresh, id: "u-g3", name: "Sari", phone: "+6281234567890" })) as never;
    await renderWith(<Masuk />);
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan Google" }));
    await waitFor(() => expect(mockLeave).toHaveBeenCalledWith("/"));
  });

  it("an email account with no number gets no provider hint", async () => {
    session({ app_metadata: { provider: "email" }, user_metadata: { name: "Rani" } });
    runtime.signInPassword = jest.fn(async () => ({ id: "u-e1", role: "customer", name: "Rani", phone: null })) as never;
    await renderWith(<Masuk />);
    await emailTab();
    await fill();
    await submit();
    expect(await screen.findByText("Siapa namamu?")).toBeTruthy();
    expect(screen.getByLabelText("Nama").props.value).toBe("Rani");
    expect(screen.queryByText(/Dari akun/)).toBeNull();
  });
});

describe("Daftar validation and errors", () => {
  it("Daftar registered email action opens Masuk with the email filled", async () => {
    mockParams = { next: "/beli/p-1" };
    supabase.auth.signUp.mockResolvedValueOnce({ data: { session: null, user: { id: "u-old", identities: [] } }, error: null } as never);
    await renderWith(<Register />);
    await fireEvent.changeText(await screen.findByLabelText("Nama"), "Rani");
    await fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    await fireEvent.press(screen.getByRole("button", { name: "Daftar" }));
    await fireEvent.press(await screen.findByText("Masuk dengan email ini"));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/beli/p-1", email: "rani@example.test" } });
  });

  it("a press with short fields shows every message, sends nothing and confuses the mascot", async () => {
    await renderWith(<Register />);
    await fireEvent.changeText(await screen.findByLabelText("Nama"), "R");
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "short");
    await fireEvent.press(screen.getByRole("button", { name: "Daftar" }));
    expect(await screen.findByText("Tulis namamu, minimal 2 huruf.")).toBeTruthy();
    expect(screen.getByText("Isi emailmu dulu.")).toBeTruthy();
    expect(screen.getByText("Minimal 8 karakter")).toBeTruthy();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-mascot-bingung", hidden)).toBeTruthy();
  });
});

describe("Daftar password outline and pending intent", () => {
  const pendingKeys = () => [...store.keys()].filter((k) => k.includes("pending"));
  const signUpWith = async () => {
    await renderWith(<Register />);
    await fireEvent.changeText(await screen.findByLabelText("Nama"), "Rani");
    await fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    await fireEvent.press(screen.getByRole("button", { name: "Daftar" }));
  };

  it("a short password gets the danger outline together with its red rule line", async () => {
    await renderWith(<Register />);
    await fireEvent.changeText(await screen.findByLabelText("Kata sandi"), "short");
    const neutral = borderOf("Kata sandi");
    await fireEvent(screen.getByLabelText("Kata sandi"), "blur");
    await waitFor(() => expect(borderOf("Kata sandi")).not.toBe(neutral));
  });

  it("a failed sign-up leaves no pending intent, a sent one keeps it", async () => {
    supabase.auth.signUp.mockResolvedValueOnce({ data: { session: null, user: { id: "u-old", identities: [] } }, error: null } as never);
    await signUpWith();
    await screen.findByTestId("identity-error");
    expect(pendingKeys()).toEqual([]);
  });

  it("a sent sign-up keeps its pending intent", async () => {
    await signUpWith();
    await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled());
    await waitFor(() => expect(pendingKeys().length).toBe(1));
  });
});

describe("Daftar and Pemulihan rate wait", () => {
  it("Daftar counts down a 429 on its button", async () => {
    jest.useFakeTimers();
    try {
      supabase.auth.signUp.mockResolvedValueOnce({ data: { session: null, user: null }, error: { status: 429, code: "over_request_rate_limit" } } as never);
      await renderWith(<Register />);
      await fireEvent.changeText(await screen.findByLabelText("Nama"), "Rani");
      await fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
      await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
      await fireEvent.press(screen.getByRole("button", { name: "Daftar" }));
      expect(await screen.findByRole("button", { name: "Coba lagi dalam 1:00" })).toBeDisabled();
      expect(screen.getByText("Terlalu banyak percobaan. Coba lagi dalam 1:00.")).toBeTruthy();
      expect(within(screen.getByTestId("identity-error")).queryByText("Coba lagi")).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByRole("button", { name: "Daftar" })).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Pemulihan validation and neutrality", () => {
  it("Pemulihan stays neutral for an unknown email", async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { code: "user_not_found", status: 400 } } as never);
    await renderWith(<Recover />);
    await fireEvent.changeText(await screen.findByLabelText("Email"), "nobody@example.test");
    await fireEvent.press(screen.getByRole("button", { name: "Kirim tautan pemulihan" }));
    expect(await screen.findByText("Cek emailmu")).toBeTruthy();
    expect(screen.queryByTestId("identity-error")).toBeNull();
  });

  it("a bad email shows the message and sends nothing", async () => {
    await renderWith(<Recover />);
    await fireEvent.changeText(await screen.findByLabelText("Email"), "nope");
    await fireEvent.press(screen.getByRole("button", { name: "Kirim tautan pemulihan" }));
    expect(await screen.findByText("Format email belum benar. Contoh: nama@gmail.com")).toBeTruthy();
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
