import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeMood } from "@catera/design-tokens";
import { MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import { addDays, type CustomerActionItem, type CustomerState } from "@catera/domain";
import { Akun } from "../src/account/Akun";
import { Addresses } from "../src/account/Addresses";
import { Payments } from "../src/account/Payments";
import { NotificationsScreen } from "../src/account/Notifications";
import { Beranda } from "../src/today/Beranda";
import { customerLink } from "../src/links";
import { customerState, subscription, offer, TODAY } from "./fixtures";

/** Rows that carry an href open through openLink; its tab handling is covered in navigation.test, so here it opens the
 * path the way a push does. */
jest.mock("../src/nav", () => ({
  ...jest.requireActual("../src/nav"),
  openLink: (path: string) => require("expo-router").router.push(path),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[synthetic]" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "synthetic-project" } } } },
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
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
}));

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };

function runtimeWith(
  state: Partial<CustomerState> | (() => Promise<unknown>),
  {
    actor = customer as Record<string, unknown> | null,
    actions = [] as CustomerActionItem[],
    ended = undefined as CustomerActionItem[] | undefined,
    phone = "",
  } = {},
): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    customer: jest.fn(typeof state === "function" ? state : async () => ({ ...customerState(null), ...state })),
    customerActions: jest.fn(async () => ({ total: actions.length, items: actions, ...(ended ? { ended } : {}) })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  runtime.signOut = jest.fn(async () => undefined);
  if (phone)
    (runtime as { supabase: unknown }).supabase = {
      auth: {
        getSession: async () => ({ data: { session: { user: { phone } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
        startAutoRefresh: () => undefined,
        stopAutoRefresh: () => undefined,
      },
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: async () => undefined,
    };
  return runtime;
}

const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "undetermined" });
});

describe("Akun", () => {
  it("Akun lists packages and signs out", async () => {
    const runtime = runtimeWith(
      {
        subscriptions: [
          subscription(),
          subscription({
            id: "s-old",
            status: "completed",
            remaining: 0,
            snapshot: { offer: offer({ name: "Paket Lama" }), total: 90000 } as never,
          }),
        ],
      },
      { phone: "6281234567890" },
    );
    renderWith(runtime, <Akun />);
    expect(await screen.findByText("Rani Contoh")).toBeTruthy();
    expect(await screen.findByText("0812-3456-7890")).toBeTruthy();
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.getByText("Dapur Contoh · 6 hari lagi")).toBeTruthy();
    expect(screen.queryByText("Paket Lama")).toBeNull();
    fireEvent.press(screen.getByText("Makan Siang Rumahan"));
    expect(router.push).toHaveBeenCalledWith("/subscriptions/s-1");

    for (const [label, href] of [
      ["Alamat", "/alamat"],
      ["Disimpan", "/disimpan"],
      ["Riwayat pembayaran", "/pembayaran"],
      ["Bantuan dan laporan", "/bantuan"],
      ["Notifikasi", "/notifications"],
    ]) {
      fireEvent.press(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
      expect(router.push).toHaveBeenLastCalledWith(href);
    }

    fireEvent.press(screen.getByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(runtime.signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(await screen.findByRole("button", { name: "Masuk" })).toBeTruthy();
  });

  it("language switch changes copy to English", async () => {
    renderWith(runtimeWith({}), <Akun />);
    expect(await screen.findByRole("button", { name: "Keluar" })).toBeTruthy();
    fireEvent.press(screen.getByRole("tab", { name: "English" }));
    expect(await screen.findByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Payment history/ })).toBeTruthy();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.locale", "en");
  });

  it("English remaining days are singular for one day and plural otherwise", async () => {
    renderWith(
      runtimeWith({
        subscriptions: [
          subscription({ remaining: 1 }),
          subscription({ id: "s-2", remaining: 6, snapshot: { offer: offer({ name: "Paket Dua" }), total: 90000 } as never }),
        ],
      }),
      <Akun />,
    );
    expect(await screen.findByText("Dapur Contoh · 1 hari lagi")).toBeTruthy();
    fireEvent.press(screen.getByRole("tab", { name: "English" }));
    expect(await screen.findByText("Dapur Contoh · 1 day to go")).toBeTruthy();
    expect(screen.getByText("Dapur Contoh · 6 days to go")).toBeTruthy();
    expect(screen.queryByText(/1 days/)).toBeNull();
  });

  it("shows no caterer or admin workspace links", async () => {
    renderWith(runtimeWith({}, { actor: { id: "u-o1", role: "owner", name: "Pemilik Contoh" } }), <Akun />);
    expect(await screen.findByRole("button", { name: "Keluar" })).toBeTruthy();
    expect(screen.queryByText(/ruang kerja|Catera Admin|workspace/i)).toBeNull();
  });

  it("signed out asks to sign in and comes back to Akun, and still offers the language", async () => {
    renderWith(runtimeWith({}, { actor: null }), <Akun />);
    fireEvent.press(await screen.findByRole("button", { name: "Masuk" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/akun" } });
    fireEvent.press(screen.getByRole("tab", { name: "English" }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("says Nonaktif until push is turned on, then Aktif", async () => {
    const runtime = runtimeWith({});
    renderWith(runtime, <Akun />);
    expect(await screen.findByRole("button", { name: "Notifikasi, Nonaktif" })).toBeTruthy();
  });

  describe("Tampilan", () => {
    const canvas = () => StyleSheet.flatten(screen.UNSAFE_getByType(SafeAreaView).props.style).backgroundColor;
    const renderThemed = async (runtime: MobileRuntime) => {
      render(
        <ThemeProvider storageKey={runtime.storageKey("theme")}>
          <MobileProvider runtime={runtime} linkMapper={customerLink}>
            <Akun />
          </MobileProvider>
        </ThemeProvider>,
      );
      expect(await screen.findByRole("button", { name: "Keluar" })).toBeTruthy();
      await act(async () => {});
    };

    it("shows Sistem selected by default", async () => {
      await renderThemed(runtimeWith({}));
      expect(screen.getByText("Tampilan")).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Sistem" })).toBeSelected();
      expect(screen.getByRole("tab", { name: "Terang" })).not.toBeSelected();
      expect(screen.getByRole("tab", { name: "Gelap" })).not.toBeSelected();
      expect(canvas()).toBe("#FDFAF3");
    });

    it("pressing Gelap stores dark and repaints the same screen", async () => {
      const runtime = runtimeWith({});
      await renderThemed(runtime);
      fireEvent.press(screen.getByRole("tab", { name: "Gelap" }));
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.theme", "dark");
      expect(canvas()).toBe("#151514");
      expect(screen.getByRole("tab", { name: "Gelap" })).toBeSelected();
      expect(screen.getByRole("button", { name: "Keluar" })).toBeTruthy();
    });

    it("reads Appearance, System, Light and Dark in English", async () => {
      await renderThemed(runtimeWith({}));
      fireEvent.press(screen.getByRole("tab", { name: "English" }));
      expect(await screen.findByText("Appearance")).toBeTruthy();
      expect(screen.getByRole("tab", { name: "System" })).toBeSelected();
      expect(screen.getByRole("tab", { name: "Light" })).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Dark" })).toBeTruthy();
      expect(screen.queryByText("Tampilan")).toBeNull();
    });

    it("is offered while signed out too", async () => {
      render(
        <ThemeProvider storageKey="catera.theme">
          <MobileProvider runtime={runtimeWith({}, { actor: null })} linkMapper={customerLink}>
            <Akun />
          </MobileProvider>
        </ThemeProvider>,
      );
      expect(await screen.findByText("Tampilan")).toBeTruthy();
      await act(async () => {});
      fireEvent.press(screen.getByRole("tab", { name: "Gelap" }));
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.theme", "dark");
    });
  });
});

describe("Notifikasi", () => {
  it("turns push on with device.register and then says Aktif", async () => {
    const runtime = runtimeWith({});
    renderWith(runtime, <NotificationsScreen />);
    expect(await screen.findByText("Nonaktif")).toBeTruthy();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    fireEvent.press(screen.getByRole("button", { name: "Aktifkan" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "device.register",
        { token: "ExponentPushToken[synthetic]" },
        expect.any(String),
      ),
    );
    expect(await screen.findByText("Aktif")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aktifkan" })).toBeNull();
  });

  it("the Akun row follows once push is turned on", async () => {
    renderWith(
      runtimeWith({}),
      <>
        <Akun />
        <NotificationsScreen />
      </>,
    );
    expect(await screen.findByRole("button", { name: "Notifikasi, Nonaktif" })).toBeTruthy();
    fireEvent.press(await screen.findByRole("button", { name: "Aktifkan" }));
    expect(await screen.findByRole("button", { name: "Notifikasi, Aktif" })).toBeTruthy();
  });

  it.each([
    ["REQUEST_TIMEOUT", "Koneksi terlalu lama. Periksa koneksi dan coba lagi."],
    ["DEVICE_SOMETHING", "Notifikasi belum bisa diaktifkan. Coba lagi."],
  ])("a failed registration (%s) says it plainly, never the code", async (code, message) => {
    const runtime = runtimeWith({});
    (runtime.api.command as jest.Mock).mockRejectedValueOnce(Object.assign(new Error(code), { code }));
    renderWith(runtime, <NotificationsScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Aktifkan" }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByText(code)).toBeNull();
    expect(screen.getByText("Nonaktif")).toBeTruthy();
  });

  it("says why when the phone refuses permission", async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: "denied" });
    renderWith(runtimeWith({}), <NotificationsScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Aktifkan" }));
    expect(await screen.findByText(/Izin notifikasi belum diberikan/)).toBeTruthy();
    expect(screen.getByText("Nonaktif")).toBeTruthy();
  });

  it("marks an unread notification read and opens its app screen", async () => {
    const runtime = runtimeWith({
      notifications: [
        {
          id: "n-1",
          kind: "delivery",
          body: "Makan siang sedang diantar.",
          href: "/deliveries/d-1",
          read_at: null,
          created_at: `${TODAY}T03:15:00Z`,
        },
        {
          id: "n-2",
          kind: "payment",
          body: "Pembayaran diterima.",
          href: "/payment/ck-1",
          read_at: `${TODAY}T02:00:00Z`,
          created_at: `${TODAY}T01:00:00Z`,
        },
      ],
    });
    renderWith(runtime, <NotificationsScreen />);
    fireEvent.press(await screen.findByText("Makan siang sedang diantar."));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith("notification.read", { id: "n-1" }, expect.any(String)),
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/hari/d-1"));
    expect(screen.getByText(/10.15/)).toBeTruthy();

    fireEvent.press(screen.getByText("Pembayaran diterima."));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/bayar/ck-1"));
    expect(runtime.api.command).toHaveBeenCalledTimes(1);
  });

  it("says plainly when there is nothing yet", async () => {
    renderWith(runtimeWith({}), <NotificationsScreen />);
    expect(await screen.findByText("Belum ada kabar baru.")).toBeTruthy();
  });
});

describe("Alamat", () => {
  const kantor = {
    id: "a-1",
    label: "Kantor",
    line: "Jl. Contoh No. 1",
    area: "Jakarta Selatan",
    city: "Jakarta",
    instructions: "Titip resepsionis",
    version: 3,
  };

  it("edits an address with the same address.save payload", async () => {
    const runtime = runtimeWith({ addresses: [kantor] });
    renderWith(runtime, <Addresses />);
    fireEvent.press(await screen.findByRole("button", { name: "Ubah Kantor" }));
    fireEvent.changeText(screen.getByLabelText("Jalan, nomor, detail"), "Jl. Baru No. 2");
    fireEvent.press(screen.getByRole("button", { name: "Simpan alamat" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "address.save",
        {
          id: "a-1",
          version: 3,
          label: "Kantor",
          line: "Jl. Baru No. 2",
          area: "Jakarta Selatan",
          city: "Jakarta",
          instructions: "Titip resepsionis",
        },
        expect.any(String),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "Simpan alamat" })).toBeNull());
  });

  it("adds a new address in the chosen area", async () => {
    const runtime = runtimeWith({ addresses: [] });
    renderWith(runtime, <Addresses />);
    fireEvent.press(await screen.findByRole("button", { name: "Tambah alamat" }));
    expect(screen.getByRole("button", { name: "Simpan alamat" })).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText("Jalan, nomor, detail"), "Jl. Melati No. 9");
    fireEvent.press(screen.getByRole("button", { name: "Tangerang Selatan" }));
    fireEvent.press(screen.getByRole("button", { name: "Simpan alamat" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "address.save",
        {
          label: "Rumah",
          line: "Jl. Melati No. 9",
          area: "Tangerang Selatan",
          city: "Jakarta",
          instructions: "",
        },
        expect.any(String),
      ),
    );
  });

  it("keeps the form and says so when saving fails", async () => {
    const runtime = runtimeWith({ addresses: [kantor] });
    (runtime.api.command as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("CONFLICT"), { code: "CONFLICT" }));
    renderWith(runtime, <Addresses />);
    fireEvent.press(await screen.findByRole("button", { name: "Ubah Kantor" }));
    fireEvent.press(screen.getByRole("button", { name: "Simpan alamat" }));
    expect(await screen.findByTestId("address-error")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan alamat" })).toBeTruthy();
  });
});

describe("Riwayat pembayaran", () => {
  it("lists paid purchases and opens Bayar for one waiting for payment", async () => {
    const runtime = runtimeWith(
      {
        subscriptions: [
          { ...subscription(), checkout_id: "ck-paid" } as never,
          // Recorded by the caterer (not bought in Catera): not a Catera payment.
          subscription({ id: "s-imported", snapshot: { offer: offer({ name: "Paket Catatan" }), total: 0 } as never }),
        ],
      },
      {
        actions: [
          {
            id: "payment-ck-2",
            kind: "payment_action",
            status: "awaiting_payment",
            priority: 1,
            dueAt: `${TODAY}T10:00:00Z`,
            packageName: "Makan Malam Sehat",
            catererName: "Dapur Contoh",
            href: "/payment/ck-2",
          },
          {
            id: "menu-x",
            kind: "menu_choice_due",
            status: "selection_due",
            priority: 1,
            href: "/subscriptions/s-1/menu",
          },
        ],
      },
    );
    renderWith(runtime, <Payments />);
    expect(await screen.findByText("Makan Malam Sehat")).toBeTruthy();
    expect(screen.getByText(/Menunggu pembayaran/)).toBeTruthy();
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.getByText(/150\.000/)).toBeTruthy();
    expect(screen.queryByText("Paket Catatan")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Bayar Makan Malam Sehat" }));
    expect(router.push).toHaveBeenCalledWith("/bayar/ck-2");
  });

  it("never asks to pay for a payment that is being checked or was received", async () => {
    const item = (id: string, status: CustomerActionItem["status"], packageName: string): CustomerActionItem => ({
      id: `payment-${id}`,
      kind: "payment_action",
      status,
      priority: status === "payment_exception" ? 0 : 1,
      packageName,
      catererName: "Dapur Contoh",
      href: `/payment/${id}`,
    });
    const runtime = runtimeWith(
      { subscriptions: [] },
      {
        actions: [
          item("ck-1", "choose_method", "Paket Pilih Metode"),
          item("ck-2", "awaiting_payment", "Paket Menunggu"),
          item("ck-3", "checking_payment", "Paket Dicek"),
          item("ck-4", "payment_exception", "Paket Ditinjau"),
        ],
      },
    );
    renderWith(runtime, <Payments />);
    expect(await screen.findByText("Belum dibayar")).toBeTruthy();
    expect(screen.getByText("Sedang diproses")).toBeTruthy();
    // Only the two unpaid checkouts offer Bayar.
    const pay = screen.getAllByRole("button", { name: /^Bayar / });
    expect(pay.map((b) => b.props.accessibilityLabel)).toEqual(["Bayar Paket Pilih Metode", "Bayar Paket Menunggu"]);
    expect(screen.getByText(/Pembayaran sedang dicek/)).toBeTruthy();
    expect(screen.getByText(/Pembayaran diterima, pemesanan sedang ditinjau Catera/)).toBeTruthy();
    expect(screen.getByText(/Jangan membayar lagi/)).toBeTruthy();
    fireEvent.press(screen.getByText("Paket Dicek"));
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Paket Ditinjau"));
    expect(router.push).toHaveBeenCalledWith("/bantuan?checkoutId=ck-4");
    fireEvent.press(pay[0]);
    expect(router.push).toHaveBeenLastCalledWith("/bayar/ck-1");
  });

  it("keeps an expired checkout as Kedaluwarsa with Bayar lagi, the way Bayar pays again", async () => {
    const ended = (id: string, packageName: string, payAgain: CustomerActionItem["payAgain"]): CustomerActionItem => ({
      id: `payment-${id}`,
      kind: "payment_action",
      status: "expired",
      priority: 1,
      dueAt: `${TODAY}T02:00:00Z`,
      packageName,
      catererName: "Dapur Contoh",
      href: `/payment/${id}`,
      payAgain,
    });
    const runtime = runtimeWith(
      { subscriptions: [] },
      {
        ended: [
          ended("ck-5", "Paket Habis", { packageId: "p-rumahan", trial: false, portions: 2, cycles: 1, addressId: "a-1" }),
          ended("ck-6", "Paket Perpanjang", {
            packageId: "p-rumahan",
            renewedFrom: "s-1",
            trial: false,
            portions: 1,
            cycles: 2,
            addressId: "a-2",
          }),
          {
            ...ended("ck-7", "Paket Coba", { packageId: "p-coba", trial: true, portions: 1, cycles: 1, addressId: "a-1" }),
            paymentFailed: true,
          },
        ],
      },
    );
    renderWith(runtime, <Payments />);
    expect(await screen.findByText("Kedaluwarsa")).toBeTruthy();
    expect(screen.queryByText("Belum dibayar")).toBeNull();
    expect(screen.queryByText("Belum ada pembayaran.")).toBeNull();
    expect(screen.getAllByText(/Waktu pembayaran habis/)).toHaveLength(2);
    // A failed payment says so, with the same Bayar lagi.
    expect(screen.getByText("Pembayaran gagal · Dapur Contoh")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Bayar Paket/ })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Bayar lagi Paket Habis" }));
    expect(router.push).toHaveBeenLastCalledWith("/beli/p-rumahan?portions=2&cycles=1&addressId=a-1");
    fireEvent.press(screen.getByRole("button", { name: "Bayar lagi Paket Perpanjang" }));
    expect(router.push).toHaveBeenLastCalledWith("/renew/s-1?portions=1&cycles=2&addressId=a-2");
    fireEvent.press(screen.getByRole("button", { name: "Bayar lagi Paket Coba" }));
    expect(router.push).toHaveBeenLastCalledWith("/beli/p-coba?trial=1&portions=1&addressId=a-1");
  });

  it("an ended checkout the bank may still confirm is in progress, never paid again", async () => {
    const runtime = runtimeWith(
      { subscriptions: [] },
      {
        ended: [
          {
            id: "payment-ck-8",
            kind: "payment_action",
            status: "checking_payment",
            priority: 1,
            packageName: "Paket Telat",
            catererName: "Dapur Contoh",
            href: "/payment/ck-8",
            payAgain: { packageId: "p-rumahan", trial: false, portions: 1, cycles: 1 },
          },
        ],
      },
    );
    renderWith(runtime, <Payments />);
    expect(await screen.findByText("Sedang diproses")).toBeTruthy();
    expect(screen.getByText(/Pembayaran sedang dicek/)).toBeTruthy();
    expect(screen.queryByText("Kedaluwarsa")).toBeNull();
    expect(screen.queryByRole("button", { name: /Bayar/ })).toBeNull();
  });

  it("explains an empty history", async () => {
    renderWith(runtimeWith({ subscriptions: [] }), <Payments />);
    expect(await screen.findByText("Belum ada pembayaran.")).toBeTruthy();
  });
});

describe("Beranda: Pilih menu", () => {
  // The next Monday after today, in Jakarta dates.
  const monday = (() => {
    let d = addDays(TODAY, 1);
    while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 1) d = addDays(d, 1);
    return d;
  })();
  const due: CustomerActionItem = {
    id: "menu-d-9-lunch",
    kind: "menu_choice_due",
    status: "selection_due",
    priority: 1,
    dueAt: `${addDays(monday, -1)}T10:00:00Z`,
    serviceDate: monday,
    meal: "lunch",
    packageName: "Makan Siang Rumahan",
    catererName: "Dapur Contoh",
    href: `/subscriptions/s-1/menu?date=${monday}&meal=lunch`,
  };

  it("pilih menu appears only when a selection is due", async () => {
    const runtime = runtimeWith({}, { actions: [due] });
    renderWith(runtime, <Beranda />);
    fireEvent.press(await screen.findByText("Pilih menu Senin"));
    expect(router.push).toHaveBeenCalledWith(`/pilih-menu/s-1?date=${monday}&meal=lunch`);
  });

  it("shows no menu row without a selection due", async () => {
    const runtime = runtimeWith(
      {},
      { actions: [{ ...due, id: "payment-ck-9", kind: "payment_action", status: "awaiting_payment", href: "/payment/ck-9" }] },
    );
    renderWith(runtime, <Beranda />);
    expect(await screen.findByText(/^Siang ini,/)).toBeTruthy();
    await waitFor(() => expect(runtime.api.customerActions).toHaveBeenCalled());
    expect(screen.queryByText(/Pilih menu/)).toBeNull();
  });

  it("still shows Beranda when the action feed fails", async () => {
    const runtime = runtimeWith({});
    (runtime.api.customerActions as jest.Mock).mockRejectedValue(new Error("REQUEST_TIMEOUT"));
    renderWith(runtime, <Beranda />);
    expect(await screen.findByText(/^Siang ini,/)).toBeTruthy();
    expect(screen.queryByText(/Pilih menu/)).toBeNull();
  });
});

describe("Akun mood header", () => {
  const MALAM_NOW = () => new Date("2026-10-09T08:00:00Z");
  const SIANG_NOW = () => new Date("2026-10-09T03:00:00Z");
  const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
  const renderMood = (runtime: MobileRuntime, now = MALAM_NOW, screenUnderTest: React.ReactElement = <Akun />) =>
    render(
      <MoodProvider now={now}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          {screenUnderTest}
        </MobileProvider>
      </MoodProvider>,
    );

  it("opens with the name on the Malam header fill, with no toggle", async () => {
    renderMood(runtimeWith({}, { phone: "6281234567890" }));
    const header = await screen.findByTestId("akun-header");
    expect(flat(within(header).getByTestId("mood-fill-malam", { includeHiddenElements: true })).backgroundColor).toBe(
      nativeMood.light.malam.header,
    );
    expect(nativeMood.light.malam.header).toBe("#0B1F16");
    const name = within(header).getByText("Rani Contoh");
    expect(name.props.accessibilityRole).toBe("header");
    expect(flat(name).color).toBe("#FFF7E9");
    expect(await within(header).findByText("0812-3456-7890")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Malam" })).toBeNull();
    // The rows below stay on the page, outside the header.
    expect(within(header).queryByText("Paket aktif")).toBeNull();
    expect(screen.getByText("Paket aktif")).toBeTruthy();
  });

  it("keeps the Siang header fill before 15.00", async () => {
    renderMood(runtimeWith({}), SIANG_NOW);
    const header = await screen.findByTestId("akun-header");
    expect(flat(within(header).getByTestId("mood-fill-siang")).backgroundColor).toBe(nativeMood.light.siang.header);
    expect(flat(within(header).getByText("Rani Contoh")).color).toBe(nativeMood.light.siang.headerText);
  });

  it("a pushed screen signed out keeps its plain title: the Stack header above it is the only header", async () => {
    renderMood(runtimeWith({}, { actor: null }), MALAM_NOW, <Addresses />);
    expect(await screen.findByRole("button", { name: "Masuk" })).toBeTruthy();
    expect(screen.queryByTestId("signin-header")).toBeNull();
    expect(screen.queryByTestId("mood-fill-siang", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("mood-fill-malam", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText("Alamat")).toBeTruthy();
    expect(screen.getByText("Masuk untuk melihat paket dan jadwal antar Anda.")).toBeTruthy();
  });

  it("signed out keeps a header too, so the status icons never fall on the cream page", async () => {
    renderMood(runtimeWith({}, { actor: null }));
    const header = await screen.findByTestId("akun-header");
    expect(within(header).getByText("Akun")).toBeTruthy();
    expect(flat(within(header).getByText("Akun")).color).toBe("#FFF7E9");
    expect(screen.getByRole("button", { name: "Masuk" })).toBeTruthy();
  });
});

describe("customerLink is the one mapper for every old href", () => {
  it.each([
    ["/#packages", "/jelajah"],
    ["/#how-it-works", "/jelajah"],
    ["/?view=list#how-it-works", "/jelajah"],
    ["/discover", "/jelajah"],
    ["/packages/p-1", "/paket/p-1"],
    ["/package/p-1", "/paket/p-1"],
    ["/payment/ck-1", "/bayar/ck-1"],
    ["/checkout/p-1?renewedFrom=s-1", "/checkout/p-1?renewedFrom=s-1"],
    ["/subscriptions/s-1", "/subscriptions/s-1"],
    ["/subscriptions/s-1/menu?date=2026-11-02&meal=lunch", "/pilih-menu/s-1?date=2026-11-02&meal=lunch"],
    ["/support?checkoutId=ck-1", "/bantuan?checkoutId=ck-1"],
    ["/calendar", "/jadwal"],
    ["/saved", "/disimpan"],
    ["/addresses", "/alamat"],
    ["/account", "/akun"],
    ["/notifications", "/notifications"],
    ["/masalah/d-1?meal=lunch", "/masalah/d-1?meal=lunch"],
    ["/beli/p-1?portions=2", "/beli/p-1?portions=2"],
    ["/messages", "/"],
    ["/seller/today", "/"],
    ["https://evil.example/x", "/"],
  ])("%s → %s", (href, route) => {
    expect(customerLink(href)).toBe(route);
  });
});
