import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { BackHandler, Linking, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ToastProvider } from "@catera/mobile-ui";
import { Daftar } from "../src/auth/Daftar";
import { Gabung } from "../src/auth/Gabung";
import { Masuk } from "../src/auth/Masuk";
import { RoleGate } from "../src/RoleGate";
import { withDapurScale } from "./dapur-scale";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
  Link: () => null,
  useNavigation: () => ({ setOptions: jest.fn() }),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
}));

/** A synthetic Supabase auth client: no network, no real accounts. `meta` is the signed-in user's metadata. */
function fakeSupabase(meta: Record<string, unknown> = {}) {
  return {
    auth: {
      signUp: jest.fn(async () => ({ data: { user: { identities: [{ id: "i" }] }, session: null }, error: null })),
      resend: jest.fn(async () => ({ error: null })),
      getSession: jest.fn(async () => ({ data: { session: { access_token: "synthetic", user: { user_metadata: meta } } } })),
      updateUser: jest.fn(async () => ({ data: {}, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      startAutoRefresh: () => undefined,
      stopAutoRefresh: () => undefined,
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: async () => undefined,
  };
}

function makeRuntime(overrides: Record<string, unknown> = {}, supabase = fakeSupabase()) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "auth-dapur", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: null, demo: false })),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({})),
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  (runtime as { supabase: unknown }).supabase = supabase;
  Object.assign(runtime, overrides);
  return runtime;
}
const auth = (runtime: MobileRuntime) => (runtime.supabase as unknown as ReturnType<typeof fakeSupabase>).auth;

const renderWith = (runtime: MobileRuntime, ui: React.ReactNode) =>
  render(
    withDapurScale(
      <MoodProvider now={() => new Date("2026-10-08T08:00:00Z")}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <ToastProvider>{ui}</ToastProvider>
        </MobileProvider>
      </MoodProvider>,
    ),
  );

const held = <T,>() => {
  let settle!: { resolve: (value: T) => void; reject: (error: Error) => void };
  const promise = new Promise<T>((resolve, reject) => (settle = { resolve, reject }));
  return { promise, ...settle };
};
const border = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style as never)?.borderColor;
const busyOf = (name: string) => screen.getByRole("button", { name }).props.accessibilityState.busy;
const stepOf = () => screen.getByTestId("step-bar").props.accessibilityLabel;
const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }));
/** The latest hardware-back listener, as Android would call it. */
const hardwareBack = () =>
  (BackHandler.addEventListener as jest.Mock).mock.calls.filter(([e]) => e === "hardwareBackPress").pop()![1] as () => boolean;

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
// The secure store mock outlives a test; a kept actor from the last one would paint before the first me().
beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
});
afterEach(() => jest.useRealTimers());

async function signInWith(runtime: MobileRuntime, email = "rina@example.com", password = "rahasia123") {
  renderWith(runtime, <Masuk />);
  fireEvent.changeText(await screen.findByLabelText("Email"), email);
  fireEvent.changeText(screen.getByLabelText("Kata sandi"), password);
  press("Masuk");
}

describe("Dapur Masuk, email only", () => {
  it("has no method tabs or phone field, and links to Daftar and Gabung", async () => {
    renderWith(makeRuntime(), <Masuk />);
    await screen.findByLabelText("Email");
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByLabelText("Nomor WhatsApp")).toBeNull();
    expect(screen.getByText("Masuk dengan email dan kata sandi dapurmu.")).toBeTruthy();
    expect(screen.getByText("Belum punya dapur?")).toBeTruthy();
    press("Daftar");
    expect(router.push).toHaveBeenCalledWith("/daftar");
    expect(screen.getByText("Diundang sebagai staf?")).toBeTruthy();
    press("Gabung ke dapur");
    expect(router.push).toHaveBeenCalledWith("/gabung");
  });

  it("signs in with email and password, then opens Hari ini", async () => {
    const actor = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
    const signInPassword = jest.fn(async () => actor);
    await signInWith(makeRuntime({ signInPassword }));
    await waitFor(() => expect(signInPassword).toHaveBeenCalledWith("rina@example.com", "rahasia123", expect.any(String)));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("an empty submit and an invalid address say so under their fields", async () => {
    const signInPassword = jest.fn();
    renderWith(makeRuntime({ signInPassword }), <Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Masuk" }));
    expect(screen.getByText("Isi emailmu dulu.")).toBeTruthy();
    expect(screen.getByText("Isi kata sandimu dulu.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Email"), "rina@");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "x");
    press("Masuk");
    expect(screen.getByText("Format email belum benar. Contoh: nama@gmail.com")).toBeTruthy();
    expect(signInPassword).not.toHaveBeenCalled();
  });

  it("demo button shows its own spinner", async () => {
    const wait = held<void>();
    renderWith(makeRuntime({ demoLogin: jest.fn(() => wait.promise) }), <Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Masuk sebagai pemilik" }));
    await waitFor(() => expect(busyOf("Masuk sebagai pemilik")).toBe(true));
    expect(busyOf("Masuk")).toBeFalsy();
    expect(busyOf("Masuk sebagai staf dapur")).toBeFalsy();
    await act(async () => wait.resolve());
  });

  it("offline says Belum ada koneksi, outlines nothing and offers Coba lagi", async () => {
    const signInPassword = jest.fn().mockRejectedValueOnce(new Error("OFFLINE")).mockResolvedValue({ id: "u-1", role: "owner", name: "R" });
    renderWith(makeRuntime({ signInPassword }), <Masuk />);
    await screen.findByLabelText("Email");
    const quiet = border("Email");
    fireEvent.changeText(screen.getByLabelText("Email"), "rina@example.com");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "rahasia123");
    press("Masuk");
    expect(await screen.findByText("Belum ada koneksi. Cek internetmu, lalu coba lagi.")).toBeTruthy();
    expect(border("Email")).toBe(quiet);
    press("Coba lagi");
    await waitFor(() => expect(signInPassword).toHaveBeenCalledTimes(2));
  });

  it("wrong credentials outline both fields, empty the password, and offer no Coba lagi", async () => {
    const runtime = makeRuntime({ signInPassword: jest.fn(async () => Promise.reject(new Error("INVALID_CREDENTIALS"))) });
    renderWith(runtime, <Masuk />);
    await screen.findByLabelText("Email");
    const quiet = border("Email");
    fireEvent.changeText(screen.getByLabelText("Email"), "rina@example.com");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "salah-salah");
    press("Masuk");
    await screen.findByTestId("form-error");
    expect(border("Email")).not.toBe(quiet);
    expect(border("Kata sandi")).not.toBe(quiet);
    expect(screen.getByLabelText("Kata sandi").props.value).toBe("");
    expect(screen.getByText("Email atau kata sandinya salah.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });

  it("a server failure says so in the spec's words, with Coba lagi", async () => {
    await signInWith(makeRuntime({ signInPassword: jest.fn(async () => Promise.reject(new Error("AUTH_UNAVAILABLE"))) }));
    expect(await screen.findByText("Ada gangguan di sisi kami. Coba lagi sebentar lagi.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  it("a rate limit counts down on the button and in the message", async () => {
    jest.useFakeTimers();
    await signInWith(makeRuntime({ signInPassword: jest.fn(async () => Promise.reject(new Error("AUTH_RATE_LIMITED"))) }));
    expect(await screen.findByText("Terlalu banyak percobaan. Coba lagi dalam 1:00.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba lagi dalam 1:00" })).toBeDisabled();
    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByRole("button", { name: "Masuk" })).toBeEnabled();
  });
});

describe("Dapur Daftar, four steps", () => {
  const toStep = async (runtime: MobileRuntime, last: number) => {
    jest.spyOn(BackHandler, "addEventListener");
    renderWith(runtime, <Daftar />);
    fireEvent.changeText(await screen.findByLabelText("Nama usaha katering"), "Dapur Bu Rina");
    if (last === 1) return;
    press("Lanjut");
    fireEvent.press(await screen.findByText("Jakarta Selatan"));
    if (last === 2) return;
    press("Lanjut");
    fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "0812 3456 7890");
    if (last === 3) return;
    press("Lanjut");
    await screen.findByLabelText("Email");
  };

  it("checks each step on Lanjut and moves one topic at a time", async () => {
    renderWith(makeRuntime(), <Daftar />);
    await screen.findByLabelText("Nama usaha katering");
    expect(stepOf()).toBe("Langkah 1 dari 4");
    expect(screen.getByText("Apa nama usaha kateringmu?")).toBeTruthy();
    expect(screen.getByTestId("auth-mark")).toBeTruthy();
    press("Lanjut");
    expect(screen.getByText("Tulis nama usahamu, minimal 3 huruf.")).toBeTruthy();
    expect(stepOf()).toBe("Langkah 1 dari 4");

    fireEvent.changeText(screen.getByLabelText("Nama usaha katering"), "Dapur Bu Rina");
    press("Lanjut");
    expect(stepOf()).toBe("Langkah 2 dari 4");
    expect(screen.getByText("Di mana dapurmu?")).toBeTruthy();
    expect(screen.getByText("Pelanggan di area ini akan melihat paket Dapur Bu Rina.")).toBeTruthy();
    // The mascot waves on the first step only.
    expect(screen.queryByTestId("auth-mark")).toBeNull();
    press("Lanjut");
    expect(screen.getByTestId("area-error")).toBeTruthy();
    fireEvent.press(screen.getByText("Jakarta Selatan"));
    press("Lanjut");

    expect(stepOf()).toBe("Langkah 3 dari 4");
    expect(screen.getByText("Nomor WhatsApp dapur")).toBeTruthy();
    expect(screen.getByText("Pelanggan dan kurir menghubungimu lewat nomor ini. Kami tidak mengirim kode ke sini.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "0812");
    press("Lanjut");
    expect(screen.getByText("Nomor WhatsApp belum lengkap. Contoh: 0812 3456 7890")).toBeTruthy();
    expect(stepOf()).toBe("Langkah 3 dari 4");
    fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "0812 3456 7890");
    press("Lanjut");

    expect(stepOf()).toBe("Langkah 4 dari 4");
    expect(screen.getByText("Terakhir, buat akunmu")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Daftar" })).toBeTruthy();
    expect(screen.getByTestId("terms")).toHaveTextContent(/Dengan mendaftar, kamu setuju dengan Syarat & Ketentuan dan Kebijakan Privasi Catera\./);
  });

  it("back goes to the step before, keeping what was typed, and Android's back key does the same", async () => {
    await toStep(makeRuntime(), 4);
    fireEvent.press(screen.getByTestId("step-back"));
    expect(stepOf()).toBe("Langkah 3 dari 4");
    expect(screen.getByLabelText("Nomor WhatsApp").props.value).toBe("0812 3456 7890");
    let handled = false;
    act(() => void (handled = hardwareBack()()));
    expect(handled).toBe(true);
    expect(stepOf()).toBe("Langkah 2 dari 4");
    expect(screen.getByRole("button", { name: "Jakarta Selatan" }).props.accessibilityState.selected).toBe(true);
  });

  it("back on the first step leaves the screen", async () => {
    renderWith(makeRuntime(), <Daftar />);
    fireEvent.press(await screen.findByTestId("step-back"));
    expect(router.replace).toHaveBeenCalledWith("/masuk");
    (router.canGoBack as jest.Mock).mockReturnValueOnce(true);
    fireEvent.press(screen.getByTestId("step-back"));
    expect(router.back).toHaveBeenCalled();
    press("Masuk");
    expect(router.replace).toHaveBeenCalledTimes(2);
  });

  it("Cek di WhatsApp opens wa.me with the number's digits", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await toStep(makeRuntime(), 3);
    expect(screen.getByText("Membuka WhatsApp ke nomor ini. Kalau yang muncul chat dengan dirimu sendiri, nomornya benar.")).toBeTruthy();
    press("Cek di WhatsApp");
    expect(open).toHaveBeenCalledWith("https://wa.me/6281234567890");
  });

  it("signs up with the kitchen in the metadata, then shows Cek emailmu with a resend", async () => {
    const runtime = makeRuntime();
    await toStep(runtime, 4);
    fireEvent.changeText(screen.getByLabelText("Email"), "rina@example.com");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "pendek");
    press("Daftar");
    expect(auth(runtime).signUp).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "rahasia123");
    press("Daftar");
    await waitFor(() =>
      expect(auth(runtime).signUp).toHaveBeenCalledWith({
        email: "rina@example.com",
        password: "rahasia123",
        options: {
          emailRedirectTo: "catera-dapur://auth/callback",
          data: {
            name: "Dapur Bu Rina",
            pendingKitchen: { name: "Dapur Bu Rina", area: "Jakarta Selatan", whatsapp: "+6281234567890", slugSuffix: expect.stringMatching(/^[0-9a-f]{4}$/) },
          },
        },
      }),
    );
    expect(await screen.findByText("Cek emailmu")).toBeTruthy();
    expect(screen.getByText(/rina@example.com/)).toBeTruthy();
    // The resend waits its 60s first (CheckEmail's own timer); the expired-link test in auth-recovery covers the resend itself.
    expect(screen.getByRole("button", { name: /Kirim ulang dalam/ })).toBeTruthy();
  });

  it("a registered email says so, offers Masuk, and no Coba lagi", async () => {
    const supabase = fakeSupabase();
    supabase.auth.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null } as never);
    const runtime = makeRuntime({}, supabase);
    await toStep(runtime, 4);
    fireEvent.changeText(screen.getByLabelText("Email"), "rina@example.com");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "rahasia123");
    press("Daftar");
    const error = await screen.findByTestId("form-error");
    expect(within(error).getByText(/Email ini sudah terdaftar/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
    fireEvent.press(within(error).getByText("Masuk dengan email ini"));
    expect(router.replace).toHaveBeenCalledWith("/masuk");
  });
});

describe("Dapur Gabung, two steps", () => {
  it("asks for the invite code, then the account, and signs up with the invite in the metadata", async () => {
    const runtime = makeRuntime();
    renderWith(runtime, <Gabung />);
    await screen.findByLabelText("Kode undangan");
    expect(stepOf()).toBe("Langkah 1 dari 2");
    expect(screen.getByText("Masukkan kode undangan yang dikirim pemilik dapur lewat WhatsApp.")).toBeTruthy();
    press("Lanjut");
    expect(screen.getByText("Isi kode undangan dulu.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Kode undangan"), "DPR-4K9Q");
    press("Lanjut");
    expect(stepOf()).toBe("Langkah 2 dari 2");
    expect(screen.getByText("Buat akunmu")).toBeTruthy();
    press("Gabung");
    expect(screen.getByText("Tulis namamu, minimal 2 huruf.")).toBeTruthy();
    expect(auth(runtime).signUp).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText("Namamu"), "Bima");
    fireEvent.changeText(screen.getByLabelText("Email"), "bima@example.com");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "rahasia123");
    press("Gabung");
    await waitFor(() =>
      expect(auth(runtime).signUp).toHaveBeenCalledWith({
        email: "bima@example.com",
        password: "rahasia123",
        options: { emailRedirectTo: "catera-dapur://auth/callback", data: { name: "Bima", pendingInvite: "DPR-4K9Q" } },
      }),
    );
    expect(await screen.findByText("Cek emailmu")).toBeTruthy();
  });

  it("back from step 2 returns to the code, keeping it", async () => {
    jest.spyOn(BackHandler, "addEventListener");
    renderWith(makeRuntime(), <Gabung />);
    fireEvent.changeText(await screen.findByLabelText("Kode undangan"), "DPR-4K9Q");
    press("Lanjut");
    act(() => void hardwareBack()());
    expect(stepOf()).toBe("Langkah 1 dari 2");
    expect(screen.getByLabelText("Kode undangan").props.value).toBe("DPR-4K9Q");
  });
});

describe("Gabung, Masuk dulu", () => {
  it("keeps the typed code through Masuk, and the gate's invite field has it after sign-in", async () => {
    const runtime = makeRuntime();
    renderWith(runtime, <Gabung />);
    fireEvent.changeText(await screen.findByLabelText("Kode undangan"), "DPR-4K9Q");
    fireEvent.press(screen.getByRole("button", { name: "Masuk dulu" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/masuk"));
    screen.unmount();

    (runtime.api.me as jest.Mock).mockResolvedValue({ actor: { id: "u-3", role: "customer", name: "Bima" }, demo: false });
    renderWith(runtime, <RoleGate><Text>Hari ini</Text></RoleGate>);
    await waitFor(() => expect(screen.getByLabelText("Kode undangan").props.value).toBe("DPR-4K9Q"));
  });
});

describe("the first signed-in session after a sign-up (RoleGate)", () => {
  const customer = { id: "u-9", role: "customer", name: "Dapur Bu Rina" };
  const owner = { id: "u-9", role: "owner", name: "Dapur Bu Rina", catererId: "k-new" };
  const kitchen = { name: "Dapur Bu Rina", area: "Jakarta Selatan", whatsapp: "+6281234567890", slugSuffix: "ab12" };
  /** The account reads as a customer until a command has gone through, then as `next`. */
  const afterCommand = (runtime: MobileRuntime, next: unknown) =>
    (runtime.api.me as jest.Mock).mockImplementation(async () => ({
      actor: (runtime.api.command as jest.Mock).mock.calls.length ? next : customer,
      demo: false,
    }));
  const gate = (runtime: MobileRuntime) => renderWith(runtime, <RoleGate><Text>Hari ini</Text></RoleGate>);

  it("makes the pending kitchen once, clears the metadata and opens the tabs", async () => {
    const supabase = fakeSupabase({ pendingKitchen: kitchen });
    const runtime = makeRuntime({}, supabase);
    afterCommand(runtime, owner);
    gate(runtime);
    // Signed out the gate shows its children, so wait for the metadata to clear, then for the tabs.
    await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalled());
    expect(await screen.findByText("Hari ini")).toBeTruthy();
    const creates = (runtime.api.command as jest.Mock).mock.calls.filter(([action]) => action === "seller.create");
    expect(creates).toEqual([
      ["seller.create", { name: "Dapur Bu Rina", slug: "dapur-bu-rina-ab12", description: "", areas: ["Jakarta Selatan"], whatsapp: "+6281234567890" }, expect.any(String)],
    ]);
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { pendingKitchen: null, pendingInvite: null } });
    expect(screen.queryByText("Buka aplikasi Catera")).toBeNull();
  });

  it("a create that went through but answered with an error (the slug again) counts as done", async () => {
    const supabase = fakeSupabase({ pendingKitchen: kitchen });
    const runtime = makeRuntime({}, supabase);
    let made = false;
    (runtime.api.me as jest.Mock).mockImplementation(async () => ({ actor: made ? owner : customer, demo: false }));
    (runtime.api.command as jest.Mock).mockImplementation(async () => {
      made = true;
      throw Object.assign(new Error("CONFLICT"), { code: "CONFLICT" });
    });
    gate(runtime);
    await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalled());
    expect(await screen.findByText("Hari ini")).toBeTruthy();
    expect(runtime.api.command).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Dapurmu belum siap")).toBeNull();
  });

  it("Coba lagi reads the account first and does not create again when the kitchen now exists", async () => {
    const supabase = fakeSupabase({ pendingKitchen: kitchen });
    const runtime = makeRuntime({}, supabase);
    let serverHas = false;
    (runtime.api.me as jest.Mock).mockImplementation(async () => ({ actor: serverHas ? owner : customer, demo: false }));
    (runtime.api.command as jest.Mock).mockRejectedValue(new Error("OFFLINE"));
    gate(runtime);
    expect(await screen.findByText("Dapurmu belum siap")).toBeTruthy();
    // The create had reached the server after all; the phone only learns it on the next read.
    serverHas = true;
    press("Coba lagi");
    await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalled());
    expect(await screen.findByText("Hari ini")).toBeTruthy();
    expect(runtime.api.command).toHaveBeenCalledTimes(1);
  });

  it("a failed create says so with Coba lagi, which asks again with the same slug", async () => {
    const runtime = makeRuntime({}, fakeSupabase({ pendingKitchen: kitchen }));
    (runtime.api.me as jest.Mock).mockResolvedValue({ actor: customer, demo: false });
    (runtime.api.command as jest.Mock).mockRejectedValueOnce(new Error("OFFLINE")).mockResolvedValue({ id: "k-new" });
    gate(runtime);
    expect(await screen.findByText("Dapurmu belum siap")).toBeTruthy();
    expect(screen.getByText("Belum ada koneksi. Cek internetmu, lalu coba lagi.")).toBeTruthy();
    press("Coba lagi");
    await waitFor(() => expect(runtime.api.command).toHaveBeenCalledTimes(2));
    const [first, second] = (runtime.api.command as jest.Mock).mock.calls;
    expect(second[1]).toEqual(first[1]);
  });

  it("accepts the pending invite and clears the metadata", async () => {
    const supabase = fakeSupabase({ pendingInvite: "DPR-4K9Q" });
    const runtime = makeRuntime({}, supabase);
    afterCommand(runtime, { ...owner, role: "staff" });
    gate(runtime);
    await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalled());
    expect(await screen.findByText("Hari ini")).toBeTruthy();
    expect(runtime.api.command).toHaveBeenCalledWith("invite.accept", { code: "DPR-4K9Q" }, expect.any(String));
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { pendingKitchen: null, pendingInvite: null } });
  });

  it("an invite that is not found lands in the gate's code field, already filled", async () => {
    const supabase = fakeSupabase({ pendingInvite: "SALAH" });
    const runtime = makeRuntime({}, supabase);
    (runtime.api.me as jest.Mock).mockResolvedValue({ actor: customer, demo: false });
    (runtime.api.command as jest.Mock).mockRejectedValue(Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" }));
    gate(runtime);
    expect(await screen.findByText("Kode tidak ditemukan atau sudah dipakai.")).toBeTruthy();
    expect(screen.getByLabelText("Kode undangan").props.value).toBe("SALAH");
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { pendingKitchen: null, pendingInvite: null } });
  });

  it("an owner with leftover metadata only has it cleared; an account with none sees the customer screen", async () => {
    const supabase = fakeSupabase({ pendingKitchen: kitchen });
    const runtime = makeRuntime({}, supabase);
    (runtime.api.me as jest.Mock).mockResolvedValue({ actor: owner, demo: false });
    gate(runtime);
    expect(await screen.findByText("Hari ini")).toBeTruthy();
    await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalled());
    expect(runtime.api.command).not.toHaveBeenCalled();
    screen.unmount();

    const plain = makeRuntime();
    (plain.api.me as jest.Mock).mockResolvedValue({ actor: customer, demo: false });
    gate(plain);
    expect(await screen.findByText("Buka aplikasi Catera")).toBeTruthy();
    expect(plain.api.command).not.toHaveBeenCalled();
  });
});
