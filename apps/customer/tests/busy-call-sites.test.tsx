import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ToastProvider } from "@catera/mobile-ui";
import { Masuk } from "../src/account/Masuk";
import { Register } from "../src/account/Register";
import { Recover } from "../src/account/Recover";
import { AddressForm } from "../src/account/AddressForm";
import { ReviewRoute } from "../src/today/ReviewSheet";
import { HelpForm } from "../src/help/HelpForm";
import { ReportProblem } from "../src/help/ReportProblem";
import { customerLink } from "../src/links";
import { customerState, TODAY } from "./fixtures";

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
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
  forgetCachedCustomer: jest.fn(async () => undefined),
}));

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
/** A promise the test settles by hand, so a call stays out as long as the test wants. */
const gate = () => {
  let release = () => {};
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
};

/** The runtime of one case: signed in (or not), with `read` for the customer state and a pending `wait` where it needs one. */
function build(signedIn: boolean) {
  const wait = gate();
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  const fake = {
    auth: {
      signUp: jest.fn(async () => (await wait.promise, { data: { session: null, user: { id: "u-new" } }, error: null })),
      resend: jest.fn(async () => ({ error: null })),
      resetPasswordForEmail: jest.fn(async () => (await wait.promise, { error: null })),
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      startAutoRefresh: () => undefined,
      stopAutoRefresh: () => undefined,
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: async () => undefined,
  };
  (runtime as { supabase: unknown }).supabase = fake;
  runtime.sendPhoneOtp = jest.fn(async () => void (await wait.promise));
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: signedIn ? customer : null, demo: false })),
    customer: jest.fn(async () => customerState({ status: "out_for_delivery" })),
    command: jest.fn(async () => (await wait.promise, {})),
  } as unknown as MobileRuntime["api"];
  return { runtime, wait, fake };
}

type Site = {
  name: string;
  /** What the sheet or screen is given in its route. */
  params?: Record<string, string>;
  signedIn: boolean;
  ui: React.ReactElement;
  /** Fills the form and returns the label of the button that sends it. */
  fill: () => Promise<string>;
  /** How many times the awaited call was made. */
  calls: (r: ReturnType<typeof build>) => number;
};

const sites: Site[] = [
  {
    name: "Masuk: Kirim kode",
    signedIn: false,
    ui: <Masuk />,
    fill: async () => {
      fireEvent.changeText(await screen.findByLabelText("Nomor HP"), "0812 3456 7890");
      return "Kirim kode";
    },
    calls: (r) => (r.runtime.sendPhoneOtp as jest.Mock).mock.calls.length,
  },
  {
    name: "Daftar: Daftar & verifikasi email",
    signedIn: false,
    ui: <Register />,
    fill: async () => {
      fireEvent.changeText(await screen.findByLabelText("Nama"), "Rani");
      fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
      fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
      return "Daftar & verifikasi email";
    },
    calls: (r) => (r.fake.auth.signUp as jest.Mock).mock.calls.length,
  },
  {
    name: "Lupa kata sandi: Kirim tautan pemulihan",
    signedIn: false,
    ui: <Recover />,
    fill: async () => {
      fireEvent.changeText(await screen.findByLabelText("Email"), "rani@example.test");
      return "Kirim tautan pemulihan";
    },
    calls: (r) => (r.fake.auth.resetPasswordForEmail as jest.Mock).mock.calls.length,
  },
  {
    name: "Alamat baru: Simpan alamat",
    signedIn: true,
    ui: <AddressForm />,
    fill: async () => {
      fireEvent.changeText(await screen.findByLabelText("Jalan, nomor, detail"), "Jl. Contoh No. 5");
      return "Simpan alamat";
    },
    calls: (r) => (r.runtime.api.command as jest.Mock).mock.calls.filter(([a]) => a === "address.save").length,
  },
  {
    name: "Ulasan: Kirim ulasan",
    params: { id: "s-1" },
    signedIn: true,
    ui: <ReviewRoute />,
    fill: async () => {
      await screen.findByTestId("review-sheet");
      return "Kirim ulasan";
    },
    calls: (r) => (r.runtime.api.command as jest.Mock).mock.calls.filter(([a]) => a === "review.save").length,
  },
  {
    name: "Bantuan: Kirim permintaan",
    params: { kind: "help" },
    signedIn: true,
    ui: <HelpForm />,
    fill: async () => {
      fireEvent.press(await screen.findByRole("radio", { name: /^Pembayaran, / }));
      fireEvent.changeText(screen.getByLabelText("Ceritakan masalahnya"), "Pembayaran saya belum tercatat");
      return "Kirim permintaan";
    },
    calls: (r) => (r.runtime.api.command as jest.Mock).mock.calls.filter(([a]) => a === "support.create").length,
  },
  {
    name: "Ada masalah: Kirim laporan",
    params: { id: "d-today", meal: "lunch", jenis: "belum" },
    signedIn: true,
    ui: <ReportProblem />,
    fill: async () => {
      await screen.findByRole("button", { name: "Kirim laporan" });
      return "Kirim laporan";
    },
    calls: (r) => (r.runtime.api.command as jest.Mock).mock.calls.filter(([a]) => a === "deliveryIssue.create").length,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("busy buttons", () => {
  it.each(sites)("every awaiting command button is busy while it waits: $name", async (site) => {
    mockParams = site.params ?? {};
    const r = build(site.signedIn);
    render(
      <MobileProvider runtime={r.runtime} linkMapper={customerLink}>
        <ToastProvider>{site.ui}</ToastProvider>
      </MobileProvider>,
    );
    const label = await site.fill();
    const button = () => screen.getByRole("button", { name: label });
    expect(button().props.accessibilityState.busy).toBe(false);
    fireEvent.press(button());
    await waitFor(() => expect(button().props.accessibilityState.busy).toBe(true));
    // A second press while it waits sends nothing more, and the label is still the button's name.
    fireEvent.press(button());
    fireEvent.press(button());
    expect(site.calls(r)).toBe(1);
    await act(async () => r.wait.release());
  });
});
