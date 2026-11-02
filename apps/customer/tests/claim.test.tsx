import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ApiError } from "@catera/api-client";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import type { Actor, ClaimPreview } from "@catera/domain";
import ClaimRoute from "../app/claim/[token]";
import { customerLink } from "../src/links";
import { hostsOfType } from "./host-tree";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
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
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

/** Synthetic preview: no real caterer, customer or phone number. */
const preview: ClaimPreview = {
  catererName: "Dapur Contoh",
  packageName: "Makan Siang Rumahan",
  remainingDays: 9,
  nextDate: "2026-10-08",
  nextWindow: "11.00–13.00",
  addressLabel: "Kantor Sudirman",
  maskedPhone: "0812-•••-0001",
};
const TOKEN = "t".repeat(64);
const customer = { id: "u-c1", role: "customer", name: "Andre Contoh" } as Actor;

function runtimeWith(opts: { preview?: () => Promise<ClaimPreview>; command?: jest.Mock; actor?: Actor | null } = {}) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  // The server knows the person once a provider has signed them in.
  let current = opts.actor ?? null;
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: current, demo: false })),
    claimPreview: jest.fn(opts.preview ?? (async () => preview)),
    command: opts.command ?? jest.fn(async () => ({ status: "claimed" })),
  } as unknown as MobileRuntime["api"];
  const signInWithGoogle = jest.fn(async () => (current = customer));
  const signInWithApple = jest.fn(async () => (current = customer));
  Object.assign(runtime, { signInWithGoogle, signInWithApple });
  return { runtime, signInWithGoogle, signInWithApple };
}
const renderRoute = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <ClaimRoute />
    </MobileProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { token: TOKEN };
});

const MISMATCH =
  "Nomor ini beda dengan yang dicatat Dapur Contoh. Pakai nomor yang kamu berikan ke mereka, atau minta mereka memperbarui nomormu.";

describe("signed out", () => {
  it("shows the waiting subscription with the providers, and no phone field", async () => {
    expect(customerLink("/claim/" + TOKEN)).toBe("/claim/" + TOKEN);
    const { runtime } = runtimeWith();
    await renderRoute(runtime);
    expect(await screen.findByText("Langgananmu sudah menunggu")).toBeTruthy();
    expect(runtime.api.claimPreview).toHaveBeenCalledWith(TOKEN);
    expect(
      screen.getByText("Dapur Contoh mencatat langgananmu. Masuk dulu supaya jadwal dan tagihannya tersambung ke akunmu."),
    ).toBeTruthy();
    expect(screen.getByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.getByText("Sisa 9 hari · antar berikutnya Kamis 8 Okt, 11.00–13.00")).toBeTruthy();
    expect(screen.getByText("Kantor Sudirman")).toBeTruthy();
    // Apple only where the device offers it; the test device is not iOS.
    expect(screen.queryByRole("button", { name: "Lanjut dengan Apple" })).toBeNull();
    expect(screen.getByRole("button", { name: "Lanjut dengan Google" })).toBeTruthy();
    expect(screen.getByTestId("legal-line")).toBeTruthy();
    expect(screen.queryByLabelText("Nomor WhatsApp")).toBeNull();
  });

  it("Google signs in right here and turns the claim into the number step", async () => {
    const { runtime, signInWithGoogle } = runtimeWith();
    await renderRoute(runtime);
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan Google" }));
    expect(await screen.findByText("Sambungkan langgananmu")).toBeTruthy();
    expect(signInWithGoogle).toHaveBeenCalledWith("catera://auth/callback", expect.any(String));
    expect(screen.getByLabelText("Nomor WhatsApp")).toBeTruthy();
  });

  it("a closed Google page says nothing; a failure is said under the buttons", async () => {
    const { runtime, signInWithGoogle } = runtimeWith();
    signInWithGoogle.mockRejectedValueOnce(new Error("CANCELLED")).mockRejectedValueOnce(new Error("OFFLINE"));
    await renderRoute(runtime);
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan Google" }));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("claim-error")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Lanjut dengan Google" }));
    expect(await screen.findByText("Belum ada koneksi. Cek internetmu, lalu coba lagi.")).toBeTruthy();
    expect(screen.getByText("Langgananmu sudah menunggu")).toBeTruthy();
  });

  it("email opens Masuk on its email step and comes back to this link", async () => {
    const { runtime } = runtimeWith();
    await renderRoute(runtime);
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan email" }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/login", params: { next: `/claim/${TOKEN}`, method: "email" } });
  });
});

describe("signed in", () => {
  it("connects with the typed number, hinting the recorded ending", async () => {
    const command = jest.fn(async () => ({ status: "claimed" }));
    const { runtime } = runtimeWith({ command, actor: customer });
    await renderRoute(runtime);
    expect(await screen.findByText("Sambungkan langgananmu")).toBeTruthy();
    expect(screen.getByText("Dapur Contoh mencatat nomor berakhiran ••• 0001.")).toBeTruthy();
    expect(screen.getByText("Masuk sebagai Andre Contoh")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "0812 3450 0001");
    await fireEvent.press(screen.getByRole("button", { name: "Sambungkan" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(tabs)/(index)"));
    expect(command).toHaveBeenCalledWith("customer.claim", { token: TOKEN, phone: "+6281234500001" }, expect.any(String));
  });

  it("prefills the number already on the account", async () => {
    const { runtime } = runtimeWith({ actor: { ...customer, phone: "+6281234500001" } });
    await renderRoute(runtime);
    expect((await screen.findByLabelText("Nomor WhatsApp")).props.value).toBe("0812 3450 0001");
  });

  it("a number that differs from the mask is refused before the server, and stays editable", async () => {
    const { runtime } = runtimeWith({ actor: customer });
    await renderRoute(runtime);
    await fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "0812 9999 0000");
    await fireEvent.press(screen.getByRole("button", { name: "Sambungkan" }));
    expect(await screen.findByText(MISMATCH)).toBeTruthy();
    expect(runtime.api.command).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nomor WhatsApp").props.editable).not.toBe(false);
  });

  it("a malformed number is refused before the server", async () => {
    const { runtime } = runtimeWith({ actor: customer });
    await renderRoute(runtime);
    await fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "0812");
    await fireEvent.press(screen.getByRole("button", { name: "Sambungkan" }));
    expect(await screen.findByText("Nomornya belum benar. Contoh: 0812 3456 7890")).toBeTruthy();
    expect(runtime.api.command).not.toHaveBeenCalled();
  });

  it("CLAIM_UNAVAILABLE (a different middle, or a spent link) keeps the form and names both ways out", async () => {
    const command = jest.fn(async () => {
      throw new ApiError("CLAIM_UNAVAILABLE");
    });
    const { runtime } = runtimeWith({ command, actor: customer });
    await renderRoute(runtime);
    await fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "081234500001");
    await fireEvent.press(screen.getByRole("button", { name: "Sambungkan" }));
    expect(
      await screen.findByText(
        "Nomor belum cocok atau tautan sudah tidak berlaku. Cek nomornya, atau minta tautan baru ke Dapur Contoh.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Nomor WhatsApp")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("another refusal ends in the plain dead-link message", async () => {
    const command = jest.fn(async () => {
      throw new ApiError("NOT_FOUND");
    });
    const { runtime } = runtimeWith({ command, actor: customer });
    await renderRoute(runtime);
    await fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "081234500001");
    await fireEvent.press(screen.getByRole("button", { name: "Sambungkan" }));
    expect(await screen.findByText("Tautan ini tidak bisa dipakai. Minta tautan baru ke kateringmu.")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("a double tap on Sambungkan claims once", async () => {
    let release: (v: unknown) => void = () => undefined;
    const command = jest.fn(() => new Promise((resolve) => (release = resolve)));
    const { runtime } = runtimeWith({ command, actor: customer });
    await renderRoute(runtime);
    await fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "081234500001");
    const connect = screen.getByRole("button", { name: "Sambungkan" });
    await fireEvent.press(connect);
    await fireEvent.press(connect);
    expect(command).toHaveBeenCalledTimes(1);
    release({ status: "claimed" });
    await act(async () => {});
  });

  it("a claim held for review says so and offers Beranda", async () => {
    const command = jest.fn(async () => ({ status: "review" }));
    const { runtime } = runtimeWith({ command, actor: customer });
    await renderRoute(runtime);
    await fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "081234500001");
    await fireEvent.press(screen.getByRole("button", { name: "Sambungkan" }));
    expect(await screen.findByText("Dapur Contoh perlu mengecek langganan ini dulu. Pengantaranmu tetap jalan.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Ke Beranda" }));
    expect(router.replace).toHaveBeenCalledWith("/(tabs)/(index)");
  });
});

it.each(["NOT_FOUND", "INVALID_INPUT"])("a %s preview shows only the plain message", async (code) => {
  const { runtime } = runtimeWith({
    preview: async () => {
      throw new ApiError(code);
    },
  });
  await renderRoute(runtime);
  expect(await screen.findByText("Tautan ini tidak bisa dipakai. Minta tautan baru ke kateringmu.")).toBeTruthy();
  expect(screen.queryByText(/Dapur Contoh/)).toBeNull();
  expect(screen.queryByText(/Lanjut dengan/)).toBeNull();
  expect(screen.queryByText("Langgananmu sekarang ada di Catera")).toBeNull();
});

it("an unusable link offers a way to Beranda without going there by itself", async () => {
  const { runtime } = runtimeWith({
    preview: async () => {
      throw new ApiError("NOT_FOUND");
    },
  });
  await renderRoute(runtime);
  const home = await screen.findByRole("button", { name: "Ke Beranda" });
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(home);
  expect(router.replace).toHaveBeenCalledWith("/(tabs)/(index)");
});

it("a preview that cannot load offers Coba lagi and Ke Beranda", async () => {
  const preview = jest
    .fn<Promise<ClaimPreview>, []>()
    .mockRejectedValueOnce(new ApiError("REQUEST_TIMEOUT"))
    .mockResolvedValue({
      catererName: "Dapur Contoh",
      packageName: "Makan Siang Rumahan",
      remainingDays: 9,
      nextDate: null,
      nextWindow: null,
      addressLabel: "Kantor Sudirman",
      maskedPhone: "0812-•••-0001",
    });
  const { runtime } = runtimeWith({ preview });
  await renderRoute(runtime);
  const message = await screen.findByText("Belum bisa memuat. Periksa koneksi lalu coba lagi.");
  expect(StyleSheet.flatten(message.props.style).color).toBe(require("@catera/design-tokens").nativeThemes.light.danger);
  await fireEvent.press(await screen.findByRole("button", { name: "Ke Beranda" }));
  expect(router.replace).toHaveBeenCalledWith("/(tabs)/(index)");
  await fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
  expect(await screen.findByText("Langgananmu sudah menunggu")).toBeTruthy();
});

describe("claim under the native header", () => {
  const MALAM = () => new Date("2026-10-09T08:00:00Z");
  const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
  const renderMood = (runtime: MobileRuntime) =>
    render(
      <MoodProvider now={MALAM}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <ClaimRoute />
        </MobileProvider>
      </MoodProvider>,
    );
  /**
   * The claim is a modal flow under the native header: each state names itself through the screen's native title (the
   * Android content line, iOS's large title) in the theme's forest, on the canvas, with no mood fill even in Malam.
   */
  const expectMalamHeader = (title: string) => {
    expect(screen.queryByTestId("mood-fill-malam", { includeHiddenElements: true })).toBeNull();
    const header = screen.getByTestId("screen-native-title");
    const heading = within(header).getByText(title);
    expect(heading.props.accessibilityRole).toBe("header");
    expect(flat(heading).color).toBe(require("@catera/design-tokens").nativeThemes.light.charcoal);
    return header;
  };

  it("an unusable link keeps a header over the plain message", async () => {
    const { runtime } = runtimeWith({
      preview: async () => {
        throw new ApiError("NOT_FOUND");
      },
    });
    await renderMood(runtime);
    expect(await screen.findByTestId("claim-dead")).toBeTruthy();
    const header = expectMalamHeader("Tautan tidak bisa dipakai");
    expect(within(header).queryByTestId("claim-dead")).toBeNull();
    expect(within(header).queryByRole("button", { name: "Kembali" })).toBeNull();
    // The wordmark image stays in the page body, never on the header fill.
    expect(screen.getByLabelText("Catera")).toBeTruthy();
    expect(within(header).queryByLabelText("Catera")).toBeNull();
    expect(within(header).queryByText("Catera")).toBeNull();
  });

  it("a preview that cannot load keeps a header, with the message and retry on the page", async () => {
    const preview = jest.fn<Promise<ClaimPreview>, []>().mockRejectedValue(new ApiError("REQUEST_TIMEOUT"));
    const { runtime } = runtimeWith({ preview });
    await renderMood(runtime);
    const message = await screen.findByText("Belum bisa memuat. Periksa koneksi lalu coba lagi.");
    const header = expectMalamHeader("Belum bisa memuat");
    expect(within(header).queryByText("Belum bisa memuat. Periksa koneksi lalu coba lagi.")).toBeNull();
    expect(flat(message).color).toBe(require("@catera/design-tokens").nativeThemes.light.danger);
    expect(screen.getByLabelText("Catera")).toBeTruthy();
    expect(within(header).queryByLabelText("Catera")).toBeNull();
  });

  it("while the link is read, the page shows the mascot with Membuka tautan under the title", async () => {
    const { runtime } = runtimeWith({ preview: () => new Promise<ClaimPreview>(() => undefined) });
    const view = await renderMood(runtime);
    // The link is not validated yet, so the title cannot claim the subscription is the viewer's.
    const header = expectMalamHeader("Membuka tautan");
    expect(screen.queryByText("Langganan Anda")).toBeNull();
    // Nothing of the link can be shown yet, so the wait is the mascot, named for screen readers at once.
    const mascot = screen.getByTestId("mascot-loading");
    expect(mascot.props.accessibilityLabel).toBe("Membuka tautan…");
    expect(within(header).queryByTestId("mascot-loading")).toBeNull();
    expect(hostsOfType(view.root, "ActivityIndicator")).toHaveLength(0);
  });
});
