import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, plural, type MobileRuntime } from "@catera/mobile-core";
import * as ReactNative from "react-native";
import { Linking, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import {
  addDays,
  upcomingRows,
  type CustomerState,
  type Delivery,
  type DeliveryMeal,
  type Offer,
  type Subscription,
} from "@catera/domain";
import { nativeMood, nativeThemes } from "@catera/design-tokens";
import { MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import * as Reanimated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Beranda } from "../src/today/Beranda";
import { SunriseButton } from "../src/today/Plate";
import { customerLink } from "../src/links";
import { Masuk } from "../src/account/Masuk";
import * as offline from "../src/today/offline";
import { customerState, delivery, offer, TODAY } from "./fixtures";

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
}));
// In-memory SecureStore so the review dismissal persists within a test.
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
  state: () => Promise<unknown>,
  actor: Record<string, unknown> | null = customer,
): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    customer: jest.fn(state),
    customerActions: jest.fn(async () => ({ total: 0, items: [] })),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const renderHome = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <Beranda />
    </MobileProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

it("shows the on-the-way plate and confirms arrival", async () => {
  const runtime = runtimeWith(async () =>
    customerState({ status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` }),
  );
  renderHome(runtime);
  expect(await screen.findByText("Sedang diantar")).toBeTruthy();
  expect(screen.getByText("tiba sekitar 11.00–13.00")).toBeTruthy();
  expect(screen.getByText("Berangkat 10.42")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Sudah sampai" }));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "delivery.confirm",
      { deliveryId: "d-today", meal: "lunch" },
      expect.any(String),
    ),
  );
});

it("Belum opens the report screen preselected", async () => {
  renderHome(runtimeWith(async () => customerState({ status: "out_for_delivery" })));
  fireEvent.press(await screen.findByRole("button", { name: "Belum" }));
  expect(router.push).toHaveBeenCalledWith("/masalah/d-today?meal=lunch&jenis=belum");
});

it("offers a private reaction after arrival", async () => {
  const runtime = runtimeWith(async () =>
    customerState({ status: "delivered", confirmed_at: `${TODAY}T04:48:00Z` }),
  );
  renderHome(runtime);
  expect(await screen.findByText("Sudah sampai")).toBeTruthy();
  expect(screen.getByText("pukul 11.48")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Enak" }));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "delivery.react",
      { deliveryId: "d-today", meal: "lunch", reaction: "enak" },
      expect.any(String),
    ),
  );
});

it("offers Chat katering on the package line only when the read carries the number", async () => {
  const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  const view = renderHome(
    runtimeWith(async () => customerState({ status: "scheduled" }, { catererPhone: "+6281200000001" })),
  );
  fireEvent.press(await screen.findByRole("button", { name: "Chat katering" }));
  expect(openUrl).toHaveBeenCalledWith("https://wa.me/6281200000001?text=");
  view.unmount();
  renderHome(runtimeWith(async () => customerState({ status: "scheduled" })));
  await screen.findByText(/hari lagi/);
  expect(screen.queryByRole("button", { name: "Chat katering" })).toBeNull();
});

it("says a meal the caterer could not deliver is not coming, with chat and a report link", async () => {
  const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  renderHome(
    runtimeWith(async () =>
      customerState({ status: "issue", departed_at: `${TODAY}T03:42:00Z` }, { catererPhone: "+6281200000001" }),
    ),
  );
  expect(await screen.findByText("Tidak bisa diantar hari ini")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sudah sampai" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Belum" })).toBeNull();
  // The plate's own chat (the package line has another).
  fireEvent.press(screen.getAllByRole("button", { name: "Chat katering" })[0]);
  expect(openUrl).toHaveBeenCalledWith("https://wa.me/6281200000001?text=");
  fireEvent.press(screen.getByRole("button", { name: "Ada masalah" }));
  expect(router.push).toHaveBeenCalledWith("/masalah/d-today?meal=lunch");
});

it("shows each change deadline with its day", async () => {
  renderHome(runtimeWith(async () => customerState({ status: "scheduled" })));
  // The day after tomorrow closes tomorrow at 17.00 Jakarta.
  expect(await screen.findByText("Bisa diubah sampai besok 17.00")).toBeTruthy();
  expect(screen.queryByText("Bisa diubah sampai 17.00")).toBeNull();
});

it("lists the next days as rows", async () => {
  renderHome(runtimeWith(async () => customerState({ status: "scheduled" })));
  expect(await screen.findByText(/^Besok, /)).toBeTruthy();
  expect(screen.getAllByText("Ayam bakar madu, Sayur asem").length).toBeGreaterThan(1);
});

it("EmptyHome shows loading then error with Coba lagi", async () => {
  const runtime = runtimeWith(async () => customerState(null), null);
  let fail = true;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  runtime.api.catalog = jest.fn(async () => {
    await gate;
    if (fail) throw new Error("REQUEST_FAILED");
    return { items: [offer({ name: "Nasi Ayam Bakar" })], nextCursor: null };
  }) as never;
  renderHome(runtime);
  expect(await screen.findByText("Memuat paket…")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Jelajah paket" })).toBeTruthy();
  release();
  const message = await screen.findByText(/Tidak dapat memuat|Belum berhasil|Periksa koneksi/);
  expect(StyleSheet.flatten(message.props.style).color).toBe(nativeThemes.light.danger);
  expect(screen.queryByText("Memuat paket…")).toBeNull();
  expect(screen.getByRole("button", { name: "Jelajah paket" })).toBeTruthy();
  fail = false;
  fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
  expect(await screen.findByText("Nasi Ayam Bakar")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
});

it("signed-in Beranda error shows the message in danger with a Coba lagi text button that reloads", async () => {
  let fail = true;
  const runtime = runtimeWith(async () => {
    if (fail) throw Object.assign(new Error("REQUEST_FAILED"), { code: "REQUEST_FAILED" });
    return customerState({ status: "scheduled" });
  });
  renderHome(runtime);
  const retry = await screen.findByRole("button", { name: "Coba lagi" });
  const message = screen.getByTestId("home-error");
  expect(StyleSheet.flatten(message.props.style).color).toBe(nativeThemes.light.danger);
  // A text button: no forest fill like the primary action.
  expect(StyleSheet.flatten(retry.props.style).backgroundColor).not.toBe(nativeThemes.light.forest);
  fail = false;
  fireEvent.press(retry);
  expect(await screen.findByText(/^Besok, /)).toBeTruthy();
  expect(screen.queryByTestId("home-error")).toBeNull();
});

it("EmptyHome says so when the catalog has no packages", async () => {
  renderHome(runtimeWith(async () => customerState(null), null));
  expect(await screen.findByText("Belum ada paket.")).toBeTruthy();
  expect(screen.queryByText("Memuat paket…")).toBeNull();
  expect(screen.getByRole("button", { name: "Jelajah paket" })).toBeTruthy();
});

it("EmptyHome prices a combined package per meal, not per day", async () => {
  const runtime = runtimeWith(async () => customerState(null), null);
  runtime.api.catalog = jest.fn(async () => ({
    items: [offer({ name: "Siang dan Malam", meal: "both", price: 60000 })],
    nextCursor: null,
  })) as never;
  renderHome(runtime);
  expect(await screen.findByText("Siang dan Malam")).toBeTruthy();
  expect(screen.getByText(/30\.000/)).toBeTruthy();
  expect(screen.getByText(/\/ sekali makan/)).toBeTruthy();
  expect(screen.getByText("2 kali makan / hari")).toBeTruthy();
  expect(screen.queryByText(/60\.000/)).toBeNull();
  expect(screen.queryByText(/per hari/)).toBeNull();
});

it("upcoming rows name the package and meal", async () => {
  renderHome(runtimeWith(async () => customerState({ status: "scheduled" })));
  await screen.findByText(/^Besok, /);
  expect(screen.getAllByText("Makan Siang Rumahan · Makan siang").length).toBeGreaterThan(1);
});

it("empty upcoming row says Menu belum ditentukan", async () => {
  const state = customerState(null);
  state.deliveries[0] = delivery("d-empty", addDays(TODAY, 1), {}, { offer: offer({ menus: [] }) });
  renderHome(runtimeWith(async () => state));
  await screen.findByText(/^Besok, /);
  expect(screen.getAllByText("Menu belum ditentukan")).toHaveLength(1);
});

it("shows the renewal card at three days left", async () => {
  renderHome(runtimeWith(async () => customerState(null, { subscription: { remaining: 3 } })));
  expect(await screen.findByText("Sisa 3 hari")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Perpanjang" }));
  expect(router.push).toHaveBeenCalledWith("/renew/s-1");
});

it("hides the renewal card once the plan has been renewed", async () => {
  const state = customerState(null, { subscription: { remaining: 2 } });
  state.subscriptions.push({ ...state.subscriptions[0], id: "s-2", renewed_from: "s-1", remaining: 5 });
  renderHome(runtimeWith(async () => state));
  await screen.findAllByText(/hari lagi/);
  expect(screen.queryByText("Sisa 2 hari")).toBeNull();
  expect(screen.queryByRole("button", { name: "Perpanjang" })).toBeNull();
});

it("offers the full package when a trial is ending", async () => {
  const trial = { trial: true, offer: offer() } as unknown as Subscription["snapshot"];
  renderHome(
    runtimeWith(async () => customerState(null, { subscription: { remaining: 1, snapshot: trial, ends_on: addDays(TODAY, 1) } })),
  );
  expect(await screen.findByText("Suka dengan Makan Siang Rumahan?")).toBeTruthy();
  expect(screen.getByText(/^Hari terakhir: Besok, \w+ \d+ \w+\. Lanjutkan dengan paket penuh kapan saja\.$/)).toBeTruthy();
  // A trial is not renewed.
  expect(screen.queryByRole("button", { name: "Perpanjang" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Lihat paket penuh" }));
  expect(router.push).toHaveBeenCalledWith("/paket/p-rumahan");
});

it("does not call the last trial day tomorrow when it is further away", async () => {
  const trial = { trial: true, offer: offer() } as unknown as Subscription["snapshot"];
  renderHome(
    runtimeWith(async () => customerState(null, { subscription: { remaining: 1, snapshot: trial, ends_on: addDays(TODAY, 4) } })),
  );
  expect(await screen.findByText(/^Hari terakhir: (?!Besok)\w+ \d+ \w+\./)).toBeTruthy();
});

it("does not announce a last day that has already passed", async () => {
  const trial = { trial: true, offer: offer() } as unknown as Subscription["snapshot"];
  renderHome(
    runtimeWith(async () => customerState(null, { subscription: { remaining: 1, snapshot: trial, ends_on: addDays(TODAY, -1) } })),
  );
  expect(await screen.findByText("Suka dengan Makan Siang Rumahan?")).toBeTruthy();
  expect(screen.queryByText(/Hari terakhir/)).toBeNull();
  expect(screen.getByText("Lanjutkan dengan paket penuh kapan saja.")).toBeTruthy();
});

it("asks for a review once near the end", async () => {
  const past = delivery("d-past", addDays(TODAY, -1), { status: "delivered" }, { status: "delivered" });
  const runtime = runtimeWith(async () =>
    customerState(null, { subscription: { remaining: 2 }, past: [past] }),
  );
  renderHome(runtime);
  expect(await screen.findByText("Bagaimana Dapur Contoh selama ini?")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Nanti saja" }));
  await waitFor(() => expect(screen.queryByText("Bagaimana Dapur Contoh selama ini?")).toBeNull());
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.review.s-1", "dismissed");
});

it("sends the review with the existing review.save payload", async () => {
  const past = delivery("d-past", addDays(TODAY, -1), { status: "delivered" }, { status: "delivered" });
  const runtime = runtimeWith(async () =>
    customerState(null, { subscription: { remaining: 2 }, past: [past] }),
  );
  renderHome(runtime);
  fireEvent.press(await screen.findByText("Bagaimana Dapur Contoh selama ini?"));
  fireEvent.press(screen.getByRole("button", { name: "4 bintang" }));
  fireEvent.changeText(screen.getByLabelText("Cerita singkat (opsional)"), "Enak dan tepat waktu");
  fireEvent.press(screen.getByRole("button", { name: "Kirim ulasan" }));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "review.save",
      { subscriptionId: "s-1", rating: 4, food: 4, delivery: 4, value: 4, body: "Enak dan tepat waktu" },
      expect.any(String),
    ),
  );
  await waitFor(() => expect(screen.queryByText("Bagaimana Dapur Contoh selama ini?")).toBeNull());
});

it("signed out shows Mau makan apa minggu ini?", async () => {
  renderHome(runtimeWith(async () => customerState(null), null));
  expect(await screen.findByText("Mau makan apa minggu ini?")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
  expect(router.push).toHaveBeenCalledWith("/login");
});

it("offline shows the cached day and when it was updated", async () => {
  (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({
    savedAt: "2026-10-07T23:12:00.000Z",
    data: customerState({ status: "out_for_delivery" }),
  });
  renderHome(
    runtimeWith(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    }),
  );
  // No departure time was saved, so the track caption says "Sedang diantar" too; the sentence is the header.
  expect(await screen.findByRole("header", { name: "Sedang diantar" })).toBeTruthy();
  expect(screen.getByTestId("rantang-track").props.accessibilityLabel).toBe("Sedang diantar");
  expect(screen.getByText(/Terakhir diperbarui 06\.12/)).toBeTruthy();
  expect(offline.loadCachedCustomer).toHaveBeenCalledWith("u-c1");
});

describe("customerLink", () => {
  it("maps server hrefs to the customer app routes", () => {
    expect(customerLink("/today")).toBe("/");
    expect(customerLink("/home")).toBe("/");
    expect(customerLink("/deliveries/d-1")).toBe("/hari/d-1");
    expect(customerLink("/subscriptions/s-1")).toBe("/jadwal");
    expect(customerLink("/claim/tok_abc")).toBe("/claim/tok_abc");
    expect(customerLink("/renew/s-1")).toBe("/renew/s-1");
    expect(customerLink("/seller")).toBe("/");
    expect(customerLink("https://evil.example/x")).toBe("/");
    expect(customerLink("//evil.example/x")).toBe("/");
  });
});

describe("Masuk", () => {
  it("signs in with the phone code first and offers email on request", async () => {
    const runtime = runtimeWith(async () => customerState(null), null);
    runtime.sendPhoneOtp = jest.fn(async () => undefined);
    runtime.verifyPhoneOtp = jest.fn(async () => customer as never);
    render(
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <Masuk />
      </MobileProvider>,
    );
    expect(screen.queryByLabelText("Kata sandi")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Nomor HP"), "0812 3456 7890");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    await waitFor(() => expect(runtime.sendPhoneOtp).toHaveBeenCalledWith("+6281234567890"));
    fireEvent.changeText(await screen.findByLabelText("Kode dari SMS"), "123456");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(runtime.verifyPhoneOtp).toHaveBeenCalledWith("+6281234567890", "123456", "Pelanggan", expect.any(String));
    fireEvent.press(screen.getByRole("button", { name: "Masuk dengan email" }));
    expect(screen.getByLabelText("Kata sandi").props.secureTextEntry).toBe(true);
  });

  it("signs a new email customer in as Pelanggan, not Katerer", async () => {
    const runtime = runtimeWith(async () => customerState(null), null);
    runtime.signInPassword = jest.fn(async () => customer as never);
    render(
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <Masuk />
      </MobileProvider>,
    );
    fireEvent.press(screen.getByRole("button", { name: "Masuk dengan email" }));
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(runtime.signInPassword).toHaveBeenCalledWith(
      "rani@example.test",
      "synthetic-password",
      expect.any(String),
      "Pelanggan",
    );
  });
});

/** WCAG relative luminance of an sRGB colour given as 0–255 channels. */
const luminance = ([r, g, b]: number[]) => {
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

describe("design tokens", () => {
  it("sets the plate sentence at 28px and times in tabular numerals", async () => {
    renderHome(runtimeWith(async () => customerState({ status: "delivered", confirmed_at: `${TODAY}T04:48:00Z` })));
    const sentence = StyleSheet.flatten((await screen.findByText("Sudah sampai")).props.style);
    expect(sentence.fontSize).toBe(28);
    expect(StyleSheet.flatten(screen.getByText("pukul 11.48").props.style).fontVariant).toContain("tabular-nums");
  });

  it("keeps cream plate text at 4.5:1 or more even over a white photo", async () => {
    renderHome(runtimeWith(async () => customerState({ status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` })));
    await screen.findByText("Sedang diantar");
    const overlay = StyleSheet.flatten(screen.getByTestId("plate-overlay").props.style);
    const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(String(overlay.backgroundColor));
    expect(m).not.toBeNull();
    const [r, g, b, a] = m!.slice(1).map(Number);
    const over = [r, g, b].map((c) => c * a + 255 * (1 - a));
    const contrast = (luminance([0xff, 0xf7, 0xe9]) + 0.05) / (luminance(over) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    const meal = StyleSheet.flatten(screen.getByText(/^Makan siang · /).props.style);
    expect(meal.opacity ?? 1).toBe(1);
  });

  it("unselected star is outlined and muted", async () => {
    const past = delivery("d-past", addDays(TODAY, -1), { status: "delivered" }, { status: "delivered" });
    renderHome(runtimeWith(async () => customerState(null, { subscription: { remaining: 2 }, past: [past] })));
    fireEvent.press(await screen.findByText("Bagaimana Dapur Contoh selama ini?"));
    fireEvent.press(screen.getByRole("button", { name: "3 bintang" }));
    const glyph = (n: number) => {
      const star = screen.getByRole("button", { name: `${n} bintang` });
      const icon = within(star).UNSAFE_getByType(Ionicons);
      return { name: icon.props.name, color: icon.props.color, selected: star.props.accessibilityState.selected, star };
    };
    for (const n of [1, 2, 3]) expect(glyph(n)).toMatchObject({ name: "star", color: nativeThemes.light.sunriseInk, selected: true });
    for (const n of [4, 5]) expect(glyph(n)).toMatchObject({ name: "star-outline", color: nativeThemes.light.muted, selected: false });
    // 48dp targets, and a selection haptic on tap.
    const flat = StyleSheet.flatten(glyph(4).star.props.style);
    expect([flat.width, flat.height]).toEqual([48, 48]);
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(StyleSheet.flatten(screen.getByText(/harga terakhir/).props.style).fontVariant).toContain("tabular-nums");
  });

  const touch = { nativeEvent: { touches: [], changedTouches: [] }, persist() {} };
  it("upcoming row dims on press", async () => {
    renderHome(runtimeWith(async () => customerState({ status: "scheduled" })));
    await screen.findByText(/^Besok, /);
    const row = () => screen.getByRole("button", { name: /^Besok, / });
    expect(StyleSheet.flatten(row().props.style).opacity).toBeUndefined();
    fireEvent(row(), "responderGrant", touch);
    expect(StyleSheet.flatten(row().props.style).opacity).toBe(0.7);
  });

  it("shows when offline data was saved in tabular numerals", async () => {
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({
      savedAt: "2026-10-07T23:12:00.000Z",
      data: customerState({ status: "out_for_delivery" }),
    });
    renderHome(
      runtimeWith(async () => {
        throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      }),
    );
    const updated = await screen.findByText(/Terakhir diperbarui 06\.12/);
    expect(StyleSheet.flatten(updated.props.style).fontVariant).toContain("tabular-nums");
  });
});

it("Beranda package line says 1 day to go in English", async () => {
  (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
  renderHome(runtimeWith(async () => customerState({ status: "scheduled" }, { subscription: { remaining: 1 } })));
  expect(await screen.findByText(/· 1 day to go$/)).toBeTruthy();
  expect(screen.queryByText(/1 days/)).toBeNull();
});

describe("SunriseButton disabled look", () => {
  afterEach(() => jest.restoreAllMocks());
  test.each([false, true])("stays at 0.6 when disabled (reduced motion %s)", (reduced) => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(reduced);
    render(<SunriseButton label="Perpanjang" disabled onPress={() => {}} />);
    expect(StyleSheet.flatten(screen.getByRole("button", { name: "Perpanjang" }).props.style).opacity).toBe(0.6);
  });
});

describe("fixed surfaces in the dark theme", () => {
  afterEach(() => jest.restoreAllMocks());

  // The scrim and the Sunrise fill do not change with the theme, so their ink must not either. The track below the photo
  // is a hero surface and reads the mood's hero ink instead.
  it("keeps the plate text cream on the scrim and the Sunrise label charcoal, and the track caption in the hero ink", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const runtime = runtimeWith(async () =>
      customerState({ status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` }),
    );
    render(
      <ThemeProvider storageKey="catera.theme">
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <Beranda />
        </MobileProvider>
      </ThemeProvider>,
    );
    const ink = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never).color;
    expect(ink(await screen.findByText("Sedang diantar"))).toBe("#FFF7E9");
    expect(ink(screen.getByText("Berangkat 10.42"))).toBe(nativeMood.dark.siang.heroText);
    expect(ink(screen.getByText("Sudah sampai"))).toBe("#2E2E2E");
    // Control: the fixed inks above would read the same in light, so prove the dark theme was in force.
    expect(StyleSheet.flatten(screen.UNSAFE_getByType(SafeAreaView).props.style).backgroundColor).toBe(nativeThemes.dark.canvas);
  });
});

describe("Beranda mood", () => {
  // The offline test above leaves a cached day behind; these tests read from the network or fail.
  beforeEach(() => {
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValue(null);
    // 12.00 Jakarta on the fixtures' TODAY, so todayPlates and the fixtures can never straddle midnight.
    // Only the clock is pinned: timers, microtasks and animation frames keep running for real.
    jest.useFakeTimers({
      now: new Date(`${TODAY}T05:00:00Z`),
      doNotFake: [
        "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
        "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
        "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
      ],
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const SIANG_NOW = () => new Date("2026-10-09T03:00:00Z"); // 10:00 WIB
  const MALAM_NOW = () => new Date("2026-10-09T10:00:00Z"); // 17:00 WIB

  const menu = (meal: "lunch" | "dinner", names: string[]) =>
    ({
      meal,
      name: names[0],
      description: "",
      image: "",
      items: names.map((name, i) => ({ id: `${meal}-${i}`, name })),
    }) as unknown as Offer["menus"][number];

  const dual = (lunch = ["Ayam bakar madu", "Sayur asem"], dinner = ["Sate ayam madura", "Tumis kangkung"]) =>
    offer({ meal: "both", menus: [menu("lunch", lunch), menu("dinner", dinner)] });

  /** Today brings lunch and dinner; the next days bring lunch only. */
  function bothMeals(lunch?: string[], dinner?: string[]): CustomerState {
    const state = customerState(null);
    state.deliveries.unshift(
      delivery("d-both", TODAY, {}, {
        offer: dual(lunch, dinner),
        meals: [
          { meal: "lunch", status: "scheduled" },
          { meal: "dinner", status: "scheduled" },
        ],
      }),
    );
    return state;
  }

  function mount(runtime: MobileRuntime, { now = SIANG_NOW, scheme = "light" as "light" | "dark" } = {}) {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    return render(
      <ThemeProvider storageKey="today-mood-test">
        <MoodProvider now={now}>
          <MobileProvider runtime={runtime} linkMapper={customerLink}>
            <Beranda />
          </MobileProvider>
        </MoodProvider>
      </ThemeProvider>,
    );
  }

  const title = () => screen.getByTestId("home-title").props.children;
  const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

  it("opens in Siang with the lunch dish in the header, the lunch plate as the hero and dinner as a row", async () => {
    mount(runtimeWith(async () => bothMeals()));
    expect(await screen.findByTestId("plate-hero")).toBeTruthy();
    expect(title()).toBe("Siang ini,\nayam bakar madu.");
    expect(within(screen.getByTestId("plate-hero")).getByText(/^Makan siang · /)).toBeTruthy();
    const row = screen.getByTestId("other-meal-row");
    expect(within(row).getByText("Malam ini · 17.00–19.00")).toBeTruthy();
    expect(within(row).getByText("Sate ayam madura")).toBeTruthy();
    expect(screen.getAllByTestId("plate-hero")).toHaveLength(1);
  });

  it("names the date in the header meta", async () => {
    mount(runtimeWith(async () => bothMeals()));
    await screen.findByTestId("plate-hero");
    expect(
      within(screen.getByTestId("mood-header")).getByText(/^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu) \d+ \w+$/),
    ).toBeTruthy();
  });

  it("switches to Malam from the toggle", async () => {
    mount(runtimeWith(async () => bothMeals()));
    await screen.findByTestId("plate-hero");
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(title()).toBe("Malam ini,\nsate ayam madura.");
    expect(within(screen.getByTestId("plate-hero")).getByText(/^Makan malam · /)).toBeTruthy();
    expect(within(screen.getByTestId("other-meal-row")).getByText("Siang ini · 11.00–13.00")).toBeTruthy();
  });

  it("switches mood when the other-meal row is pressed", async () => {
    mount(runtimeWith(async () => bothMeals()));
    await screen.findByTestId("plate-hero");
    fireEvent.press(screen.getByTestId("other-meal-row"));
    expect(title()).toBe("Malam ini,\nsate ayam madura.");
    expect(within(screen.getByTestId("plate-hero")).getByText(/^Makan malam · /)).toBeTruthy();
  });

  describe("an actionable plate behind the mood", () => {
    // The clock is pinned to 12.00; the windows sit at the ends of the day so lunch is past and dinner not yet open:
    // a window that opened at 00.01 is past, one that opens at 23.59 is not yet open.
    const windowsOf = (state: CustomerState, windows: { lunch: string; dinner: string }) => {
      state.deliveries[0].offer = { ...state.deliveries[0].offer, windows };
      return state;
    };
    /** Lunch is long past its window, so a lunch that is not out yet is due; dinner is still to come. */
    const earlyLunch = (lunch: Record<string, unknown>) => {
      const state = windowsOf(bothMeals(), { lunch: "00.01–00.30", dinner: "23.59–23.59" });
      state.deliveries[0].meals = [{ meal: "lunch", ...lunch }, { meal: "dinner", status: "scheduled" }] as never;
      return state;
    };

    it("shows a due lunch's status sentence in the other-meal row while the mood is Malam", async () => {
      mount(runtimeWith(async () => earlyLunch({ status: "scheduled" })), { now: MALAM_NOW });
      await screen.findByTestId("plate-hero");
      const row = within(screen.getByTestId("other-meal-row"));
      expect(row.getByText("Siang ini · 00.01–00.30")).toBeTruthy();
      expect(row.getByText("Seharusnya sudah tiba")).toBeTruthy();
      // The actions stay on the hero: pressing the row switches the mood and reveals them.
      expect(screen.queryByRole("button", { name: "Sudah sampai" })).toBeNull();
      fireEvent.press(screen.getByTestId("other-meal-row"));
      expect(screen.getByRole("button", { name: "Sudah sampai" })).toBeTruthy();
    });

    it.each([
      [{ status: "out_for_delivery" }, "Sedang diantar"],
      [{ status: "issue" }, "Tidak bisa diantar hari ini"],
    ])("says %j in the row too", async (lunch, sentence) => {
      mount(runtimeWith(async () => earlyLunch(lunch)), { now: MALAM_NOW });
      await screen.findByTestId("plate-hero");
      expect(within(screen.getByTestId("other-meal-row")).getByText(sentence)).toBeTruthy();
    });

    it.each([
      [{ status: "delivered", confirmed_at: `${TODAY}T04:48:00Z` }, "arrived"],
      [{ status: "scheduled", issue: { status: "open" } }, "reported"],
    ])("keeps the row quiet for a plate that needs nothing now (%j: %s)", async (lunch) => {
      mount(runtimeWith(async () => earlyLunch(lunch)), { now: MALAM_NOW });
      await screen.findByTestId("plate-hero");
      expect(screen.queryByTestId("other-meal-status")).toBeNull();
    });

    it("keeps the row quiet for a plate still being cooked", async () => {
      // Dinner, not yet due, behind the Siang mood: only its label, window and dish.
      mount(runtimeWith(async () => windowsOf(bothMeals(), { lunch: "11.00–13.00", dinner: "23.59–23.59" })));
      await screen.findByTestId("plate-hero");
      expect(within(screen.getByTestId("other-meal-row")).getByText("Malam ini · 23.59–23.59")).toBeTruthy();
      expect(screen.queryByTestId("other-meal-status")).toBeNull();
    });
  });

  it("opens in Malam in the evening", async () => {
    mount(runtimeWith(async () => bothMeals()), { now: MALAM_NOW });
    await screen.findByTestId("plate-hero");
    expect(title()).toBe("Malam ini,\nsate ayam madura.");
  });

  it("says nothing is coming in the chosen meal and names the next delivery (ruling B6)", async () => {
    // Today's lunch has been delivered, so the next delivery really is a later day.
    const state = customerState({ status: "delivered", confirmed_at: `${TODAY}T04:48:00Z` });
    const next = upcomingRows(state, new Date(), 3, "id")[0].label;
    mount(runtimeWith(async () => state), { now: MALAM_NOW });
    await screen.findByTestId("home-title");
    expect(title()).toBe("Malam ini,\ntidak ada antaran.");
    expect(within(screen.getByTestId("mood-header")).getByText(`Berikutnya ${next}`)).toBeTruthy();
    expect(screen.queryByTestId("plate-hero")).toBeNull();
    // Today's lunch is still one tap away.
    const row = screen.getByTestId("other-meal-row");
    expect(within(row).getByText("Siang ini · 11.00–13.00")).toBeTruthy();
    expect(within(row).getByText("Ayam bakar madu")).toBeTruthy();
    fireEvent.press(row);
    expect(title()).toBe("Siang ini,\nayam bakar madu.");
    expect(screen.getByTestId("plate-hero")).toBeTruthy();
  });

  it("keeps the date, not Berikutnya, while the other meal is still to come today", async () => {
    // A dinner-only customer before 15.00: Siang has nothing, but tonight's dinner is closer than any later day.
    const state = customerState(null);
    state.deliveries.unshift(
      delivery("d-dinner", TODAY, {}, {
        offer: offer({ meal: "dinner", menus: [menu("dinner", ["Sate ayam madura"])] }),
        meals: [{ meal: "dinner", status: "scheduled" }],
      }),
    );
    mount(runtimeWith(async () => state));
    await screen.findByTestId("home-title");
    expect(title()).toBe("Siang ini,\ntidak ada antaran.");
    const header = within(screen.getByTestId("mood-header"));
    expect(header.queryByText(/^Berikutnya/)).toBeNull();
    expect(header.getByText(/^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu) \d+ \w+$/)).toBeTruthy();
    expect(within(screen.getByTestId("other-meal-row")).getByText("Malam ini · 17.00–19.00")).toBeTruthy();
  });

  it.each(["failed", "reported"] as const)("names the next day once the other meal is %s", async (kind) => {
    const state = customerState(null);
    state.deliveries.unshift(
      delivery("d-dinner", TODAY, kind === "failed" ? { status: "issue" } : {}, {
        offer: offer({ meal: "dinner", menus: [menu("dinner", ["Sate ayam madura"])] }),
        meals: [
          kind === "failed"
            ? { meal: "dinner", status: "issue" }
            : {
                meal: "dinner",
                status: "scheduled",
                issue: { status: "open" } as unknown as NonNullable<Delivery["meals"]>[number]["issue"],
              },
        ],
      }),
    );
    const next = upcomingRows(state, new Date(), 3, "id")[0].label;
    mount(runtimeWith(async () => state));
    await screen.findByTestId("home-title");
    expect(within(screen.getByTestId("mood-header")).getByText(`Berikutnya ${next}`)).toBeTruthy();
  });

  it("keeps a package name's own casing when a plate has no dishes", async () => {
    const state = customerState(null);
    state.deliveries.unshift(delivery("d-bare", TODAY, { status: "scheduled" }, { offer: offer({ menus: [] }) }));
    mount(runtimeWith(async () => state));
    await screen.findByTestId("plate-hero");
    expect(title()).toBe("Siang ini,\nMakan Siang Rumahan.");
  });

  it("with no delivery at all today still names the next one", async () => {
    const state = customerState(null);
    const next = upcomingRows(state, new Date(), 3, "id")[0].label;
    mount(runtimeWith(async () => state));
    await screen.findByTestId("home-title");
    expect(title()).toBe("Siang ini,\ntidak ada antaran.");
    expect(within(screen.getByTestId("mood-header")).getByText(`Berikutnya ${next}`)).toBeTruthy();
    expect(screen.queryByTestId("other-meal-row")).toBeNull();
  });

  it("speaks English when the locale is English", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    const state = customerState({ status: "delivered", confirmed_at: `${TODAY}T04:48:00Z` });
    mount(runtimeWith(async () => state), { now: MALAM_NOW });
    await screen.findByTestId("home-title");
    expect(title()).toBe("Dinner tonight,\nno delivery.");
    expect(within(screen.getByTestId("mood-header")).getByText(/^Next /)).toBeTruthy();
    expect(within(screen.getByTestId("other-meal-row")).getByText("Lunch today · 11.00–13.00")).toBeTruthy();
  });

  it("lets a long dish name wrap in the title", async () => {
    const long = "Nasi campur ayam bakar madu pedas manis dengan sambal terasi";
    expect(long).toHaveLength(60);
    mount(runtimeWith(async () => bothMeals([long])));
    await screen.findByTestId("plate-hero");
    expect(title()).toBe(`Siang ini,\n${long.toLowerCase()}.`);
    const node = screen.getByTestId("home-title");
    expect(node.props.numberOfLines).toBeUndefined();
    expect(node.props.ellipsizeMode).toBeUndefined();
  });

  it("keeps the hero frame: padding 10, radius 28, raised 74 (58 over the header plus the body's 16 top padding)", async () => {
    mount(runtimeWith(async () => bothMeals()));
    await screen.findByTestId("plate-hero");
    expect(flat("plate-hero")).toMatchObject({ padding: 10, borderRadius: 28, marginTop: -74 });
    expect(flat("plate-hero-fill-siang")).toMatchObject({
      backgroundColor: nativeMood.light.siang.hero,
      boxShadow: nativeMood.light.siang.heroShadow,
      borderRadius: 28,
    });
    expect(flat("plate-photo")).toMatchObject({ minHeight: 168, borderRadius: 20 });
  });

  it("fills the hero from the Malam palette and sets the plate heading in cream", async () => {
    mount(runtimeWith(async () => bothMeals()), { now: MALAM_NOW });
    await screen.findByTestId("plate-hero");
    expect(flat("plate-hero-fill-malam").backgroundColor).toBe("#1C3A2C");
    expect(flat("plate-hero-fill-malam").opacity).toBe(1);
    expect(flat("plate-dishes").color).toBe("#FFF7E9");
  });

  it.each(["light", "dark"] as const)("carries exactly one hero shadow, from the current mood's token (%s theme)", async (scheme) => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(runtimeWith(async () => bothMeals()), { scheme });
    await screen.findByTestId("plate-hero");
    // Only the base layer casts a shadow; the Malam layer fading over it must not add a second one.
    expect(flat("plate-hero-fill-malam").boxShadow).toBeUndefined();
    expect(flat("plate-hero-fill-siang").boxShadow).toBe(nativeMood[scheme].siang.heroShadow);
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(flat("plate-hero-fill-malam").boxShadow).toBeUndefined();
    expect(flat("plate-hero-fill-siang").boxShadow).toBe(nativeMood[scheme].malam.heroShadow);
    fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
    expect(flat("plate-hero-fill-siang").boxShadow).toBe(nativeMood[scheme].siang.heroShadow);
  });

  it("cross-fades the hero fill when the mood switches, in one frame that stays mounted", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(runtimeWith(async () => bothMeals()));
    const frame = await screen.findByTestId("plate-hero");
    expect(flat("plate-hero-fill-malam").opacity).toBe(0);
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(flat("plate-hero-fill-malam").opacity).toBe(1);
    // The same frame, not a new one: a remount would swap the fill instead of fading it.
    expect(screen.getByTestId("plate-hero") === frame).toBe(true);
    fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
    expect(flat("plate-hero-fill-malam").opacity).toBe(0);
  });

  it("starts a plate's busy and error state afresh when the hero swaps meals", async () => {
    const state = bothMeals();
    state.deliveries[0].meals = [
      { meal: "lunch", status: "out_for_delivery" },
      { meal: "dinner", status: "out_for_delivery" },
    ];
    const runtime = runtimeWith(async () => state);
    (runtime.api.command as jest.Mock).mockRejectedValue(Object.assign(new Error("NOT_ALLOWED"), { code: "NOT_ALLOWED" }));
    mount(runtime);
    fireEvent.press(await screen.findByRole("button", { name: "Sudah sampai" }));
    expect(await screen.findByTestId("plate-error")).toBeTruthy();
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(screen.queryByTestId("plate-error")).toBeNull();
  });

  it("keeps the overlay in flow, so a taller overlay grows the photo instead of overflowing it", async () => {
    const state = bothMeals();
    state.deliveries[0].meals = [
      { meal: "lunch", status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` },
      { meal: "dinner", status: "scheduled" },
    ];
    mount(runtimeWith(async () => state));
    await screen.findByTestId("plate-hero");
    const photo = within(screen.getByTestId("plate-photo"));
    expect(photo.getByTestId("plate-overlay")).toBeTruthy();
    expect(flat("plate-overlay").position).not.toBe("absolute");
    expect(flat("plate-photo").height).toBeUndefined();
    expect(flat("plate-photo").flexDirection).toBeUndefined();
  });

  describe("the rantang track on the hero", () => {
    // Delivery ids are unique per test: journey_viewed is counted once per delivery, meal and stage for the whole
    // app process, so a repeated id would silence a later test.
    let seq = 0;
    const NOT_YET = "23.59–23.59";

    /** One lunch today with its window at the end of the day, so a meal nobody tapped is still scheduled at 12.00. */
    function lunchToday(meal: Partial<DeliveryMeal>, extra: Partial<Delivery> = {}, id = `d-track-${++seq}`) {
      const state = customerState(null);
      state.deliveries.unshift(
        delivery(id, TODAY, meal, { offer: offer({ windows: { lunch: NOT_YET, dinner: NOT_YET } }), ...extra }),
      );
      return state;
    }

    /** The same runtime as `runtimeWith`, but with an app so that usage counts are sent, and the usage call exposed. */
    function countingRuntime(state: CustomerState) {
      const usage = jest.fn(async () => undefined);
      const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
      runtime.api = {
        ...runtime.api,
        me: jest.fn(async () => ({ actor: customer, demo: false })),
        customer: jest.fn(async () => state),
        customerActions: jest.fn(async () => ({ total: 0, items: [] })),
        catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
        command: jest.fn(async () => ({})),
        usage,
      } as unknown as MobileRuntime["api"];
      const viewed = () => usage.mock.calls.filter(([name]) => name === "journey_viewed");
      return { runtime, viewed };
    }

    const hero = async () => within(await screen.findByTestId("plate-hero"));

    it("shows a meal nobody tapped as Terjadwal in the sentence and in the track, never as Sedang dimasak", async () => {
      mount(runtimeWith(async () => lunchToday({ status: "scheduled" })));
      const h = await hero();
      expect(h.getByRole("header", { name: "Terjadwal" })).toBeTruthy();
      const track = h.getByTestId("rantang-track");
      expect(track.props.accessibilityLabel).toBe("Terjadwal");
      expect(within(track).getByText("Terjadwal")).toBeTruthy();
      expect(h.queryByText("Sedang dimasak")).toBeNull();
      expect(h.queryByText("Dimasak")).toBeNull();
    });

    it("says Dimasak with the time the kitchen started, while the sentence stays Sedang dimasak", async () => {
      mount(runtimeWith(async () => lunchToday({ status: "preparing", cooking_started_at: `${TODAY}T01:10:00Z` })));
      const h = await hero();
      expect(within(h.getByTestId("rantang-track")).getByText("Dimasak 08.10")).toBeTruthy();
      expect(h.getByRole("header", { name: "Sedang dimasak" })).toBeTruthy();
      // Two different lines, and neither is said twice.
      expect(h.getAllByText("Sedang dimasak")).toHaveLength(1);
      expect(h.getAllByText("Dimasak 08.10")).toHaveLength(1);
      expect(h.queryByText("Terjadwal")).toBeNull();
    });

    it("says Dimasak without a time when the kitchen's start was not recorded", async () => {
      mount(runtimeWith(async () => lunchToday({ status: "preparing" })));
      const h = await hero();
      expect(within(h.getByTestId("rantang-track")).getByText("Dimasak")).toBeTruthy();
    });

    it("says Berangkat with the departure time in the track, and the old chip is gone", async () => {
      mount(runtimeWith(async () => lunchToday({ status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` })));
      const h = await hero();
      expect(within(h.getByTestId("rantang-track")).getByText("Berangkat 10.42")).toBeTruthy();
      expect(h.getAllByText("Berangkat 10.42")).toHaveLength(1);
      expect(h.queryByTestId("plate-chip")).toBeNull();
      expect(h.getByRole("header", { name: "Sedang diantar" })).toBeTruthy();
    });

    it("says Tercatat sampai when nobody tapped and the system closed the meal", async () => {
      mount(
        runtimeWith(async () =>
          lunchToday({ status: "delivered", confirmed_at: `${TODAY}T04:48:00Z`, confirmed_by: "auto" }),
        ),
      );
      const h = await hero();
      expect(within(h.getByTestId("rantang-track")).getByText("Tercatat sampai")).toBeTruthy();
      expect(h.getByRole("header", { name: "Sudah sampai" })).toBeTruthy();
    });

    it("says Sampai when the customer confirmed", async () => {
      mount(
        runtimeWith(async () =>
          lunchToday({ status: "delivered", confirmed_at: `${TODAY}T04:48:00Z`, confirmed_by: "customer" }),
        ),
      );
      const h = await hero();
      expect(within(h.getByTestId("rantang-track")).getByText("Sampai")).toBeTruthy();
    });

    // The stop labels are hidden from a screen reader (the caption speaks for the track), so they are looked up hidden.
    const stopLabels = (h: Awaited<ReturnType<typeof hero>>) => {
      const row = within(h.getByTestId("rantang-track-labels", { includeHiddenElements: true }));
      return (names: string[]) => names.map((n) => row.getByText(n, { includeHiddenElements: true }).props.children);
    };

    it("labels the three stops in Indonesian", async () => {
      mount(runtimeWith(async () => lunchToday({ status: "preparing" })));
      expect(stopLabels(await hero())(["Dimasak", "Diantar", "Sampai"])).toEqual(["Dimasak", "Diantar", "Sampai"]);
    });

    it("labels the stops and the caption in English when the locale is English", async () => {
      (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
      mount(runtimeWith(async () => lunchToday({ status: "preparing", cooking_started_at: `${TODAY}T01:10:00Z` })));
      const h = await hero();
      expect(within(h.getByTestId("rantang-track")).getByText("Cooking since 08.10")).toBeTruthy();
      expect(stopLabels(h)(["Cooking", "On the way", "Arrived"])).toEqual(["Cooking", "On the way", "Arrived"]);
    });

    it.each([
      ["failed", { status: "issue" }, "Tidak bisa diantar hari ini"],
      ["failed after leaving", { status: "issue", departed_at: `${TODAY}T03:42:00Z` }, "Tidak bisa diantar hari ini"],
      ["reported", { status: "scheduled", issue: { status: "open" } }, "Laporan terkirim"],
    ] as const)("shows no track for a %s plate and keeps its message", async (_name, meal, message) => {
      mount(runtimeWith(async () => lunchToday(meal as unknown as Partial<DeliveryMeal>)));
      const h = await hero();
      expect(h.getByText(message)).toBeTruthy();
      expect(screen.queryByTestId("rantang-track")).toBeNull();
    });

    it("shows a track on the hero only, never on a card plate", async () => {
      const state = lunchToday({ status: "preparing", cooking_started_at: `${TODAY}T01:10:00Z` });
      state.deliveries.unshift(
        delivery("d-second", TODAY, { status: "preparing", cooking_started_at: `${TODAY}T01:30:00Z` }, {
          offer: offer({ name: "Paket Kedua", windows: { lunch: NOT_YET, dinner: NOT_YET } }),
        }),
      );
      mount(runtimeWith(async () => state));
      await hero();
      expect(screen.getAllByText(/^Makan siang · /)).toHaveLength(2);
      expect(screen.getAllByTestId("rantang-track")).toHaveLength(1);
    });

    it("counts journey_viewed once for a preparing hero across re-renders and a mood round trip", async () => {
      const state = lunchToday({ status: "preparing", cooking_started_at: `${TODAY}T01:10:00Z` }, {}, "d-count-once");
      // Dinner is a scheduled plate in the same delivery, so the toggle has a hero to swap to and back.
      state.deliveries[0].meals = [
        { meal: "lunch", status: "preparing", cooking_started_at: `${TODAY}T01:10:00Z` },
        { meal: "dinner", status: "scheduled" },
      ];
      const { runtime, viewed } = countingRuntime(state);
      mount(runtime);
      await hero();
      await waitFor(() => expect(viewed()).toHaveLength(1));
      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
      await hero();
      expect(viewed()).toHaveLength(1);
      expect(viewed()[0]).toEqual(["journey_viewed", "customer"]);
    });

    it("counts journey_viewed for a hero that has left the kitchen", async () => {
      const departed = lunchToday({ status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` }, {}, "d-count-stages");
      const { runtime, viewed } = countingRuntime(departed);
      mount(runtime);
      await hero();
      await waitFor(() => expect(viewed()).toHaveLength(1));
    });

    it("never counts journey_viewed for a scheduled hero", async () => {
      const { runtime, viewed } = countingRuntime(lunchToday({ status: "scheduled" }, {}, "d-count-never"));
      mount(runtime);
      await hero();
      // The app_open count has gone out by now; only the journey view must be missing.
      await waitFor(() => expect(runtime.api.usage).toHaveBeenCalled());
      expect(viewed()).toHaveLength(0);
    });

    it("never counts journey_viewed for a failed hero", async () => {
      const { runtime, viewed } = countingRuntime(lunchToday({ status: "issue" }, {}, "d-count-failed"));
      mount(runtime);
      await hero();
      await waitFor(() => expect(runtime.api.usage).toHaveBeenCalled());
      expect(viewed()).toHaveLength(0);
    });
  });

  it("keeps the hero actions legible on the Malam fill", async () => {
    const state = bothMeals();
    state.deliveries[0].meals = [
      { meal: "lunch", status: "out_for_delivery" },
      { meal: "dinner", status: "out_for_delivery" },
    ];
    mount(runtimeWith(async () => state), { now: MALAM_NOW });
    await screen.findByTestId("plate-hero");
    const hero = within(screen.getByTestId("plate-hero"));
    expect(hero.getByRole("button", { name: "Sudah sampai" })).toBeTruthy();
    const belum = StyleSheet.flatten(within(hero.getByRole("button", { name: "Belum" })).getByText("Belum").props.style);
    expect(belum.color).toBe(nativeMood.light.malam.heroText);
  });

  it("keeps every plate action on the hero", async () => {
    const state = bothMeals();
    state.deliveries[0].meals = [
      { meal: "lunch", status: "delivered", confirmed_at: `${TODAY}T04:48:00Z` },
      { meal: "dinner", status: "scheduled" },
    ];
    const runtime = runtimeWith(async () => state);
    mount(runtime);
    const hero = within(await screen.findByTestId("plate-hero"));
    expect(hero.getByText("Sudah sampai")).toBeTruthy();
    fireEvent.press(hero.getByRole("button", { name: "Enak" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "delivery.react",
        { deliveryId: "d-both", meal: "lunch", reaction: "enak" },
        expect.any(String),
      ),
    );
  });

  it("keeps a second plate of the same meal below the hero instead of dropping it", async () => {
    const state = bothMeals();
    state.deliveries.unshift(delivery("d-second", TODAY, { status: "scheduled" }, { offer: offer({ name: "Paket Kedua" }) }));
    mount(runtimeWith(async () => state));
    await screen.findByTestId("plate-hero");
    expect(screen.getAllByTestId("plate-hero")).toHaveLength(1);
    expect(screen.getAllByText(/^Makan siang · /).length).toBe(2);
  });

  it("shows the error state inside a mood header, in dark-safe danger on the canvas", async () => {
    const runtime = runtimeWith(async () => {
      throw Object.assign(new Error("REQUEST_FAILED"), { code: "REQUEST_FAILED" });
    });
    mount(runtime, { now: MALAM_NOW, scheme: "dark" });
    const message = await screen.findByTestId("home-error");
    expect(within(screen.getByTestId("mood-header")).getByText("Beranda")).toBeTruthy();
    expect(message.props.selectable).toBe(true);
    expect(StyleSheet.flatten(message.props.style).color).toBe(nativeThemes.dark.danger);
  });

  it("Coba lagi reloads from the error state", async () => {
    let fail = true;
    const runtime = runtimeWith(async () => {
      if (fail) throw Object.assign(new Error("REQUEST_FAILED"), { code: "REQUEST_FAILED" });
      return bothMeals();
    });
    mount(runtime, { now: MALAM_NOW });
    await screen.findByTestId("home-error");
    fail = false;
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByTestId("plate-hero")).toBeTruthy();
    expect(screen.queryByTestId("home-error")).toBeNull();
  });

  it("shows a header while the first read is loading", async () => {
    const gate = new Promise<never>(() => undefined);
    mount(runtimeWith(() => gate));
    expect(await screen.findByTestId("mood-header")).toBeTruthy();
    expect(within(screen.getByTestId("mood-header")).getByText("Beranda")).toBeTruthy();
  });
});

describe("plural", () => {
  test("English counts take the singular only for one", () => {
    expect(plural(1, "day")).toBe("1 day");
    expect(plural(0, "day")).toBe("0 days");
    expect(plural(3, "portion")).toBe("3 portions");
    expect(plural(2, "delivery day")).toBe("2 delivery days");
    expect(plural(1, "box", "boxes")).toBe("1 box");
    expect(plural(2, "box", "boxes")).toBe("2 boxes");
  });
});
