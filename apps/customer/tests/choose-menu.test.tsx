import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ThemeProvider } from "@catera/mobile-ui";
import { ChooseMenu } from "../src/schedule/ChooseMenu";
import { customerLink } from "../src/links";

/** The phone the screen is drawn on; the Jest default is 390 wide at font scale 2. */
let mockWindow = { width: 390, height: 800, scale: 2, fontScale: 2 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: "subscription", date: "2026-11-03", meal: "lunch" }),
}));
// The real contexts stay (Screen reads whether a stack header sits above it); only the screen's own hooks are stubbed.
const mockDispatch = jest.fn();
jest.mock("expo-router/react-navigation", () => ({
  ...jest.requireActual("expo-router/react-navigation"),
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: jest.fn(),
}));
/**
 * The confirm sheet (`useConfirm`, the `/konfirmasi` route) answers what each test sets; the toast is captured. The
 * real sheets are covered on the real router in sheets.test.tsx and customer-sheets.test.tsx.
 */
const mockConfirm = jest.fn(async (_input: Record<string, unknown>) => true);
const mockToast = jest.fn();
jest.mock("@catera/mobile-ui", () => ({
  ...jest.requireActual("@catera/mobile-ui"),
  useConfirm: () => mockConfirm,
  useToast: () => ({ show: mockToast, hide: jest.fn() }),
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
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

const offer = {
  id: "offer",
  name: "Paket pilihan",
  caterer: "Dapur Contoh",
  meal: "lunch",
  timezone: "Asia/Jakarta",
  menuSelectionMode: "customer",
  menus: [
    {
      meal: "lunch",
      contentModel: "slots",
      composition: [{ id: "main", categoryId: "main", name: "Lauk", slots: 1 }],
      items: [],
    },
  ],
};
const day = (extra: Record<string, unknown> = {}) => ({
  date: "2026-11-03",
  dayId: "day",
  version: 0,
  deliveryVersion: 7,
  editable: true,
  cutoffAt: "2099-11-02T17:00:00+07:00",
  selectionStatus: "pending",
  details: null,
  ...extra,
});
const month = (dates = [day()]) => ({
  dates,
  categories: [],
  options: [
    {
      id: "option",
      version: 4,
      categoryId: "main",
      name: "Ayam panggang",
      serving: "1 potong",
      image: "",
      description: "",
      archived: false,
    },
  ],
});

let runtime: MobileRuntime;
beforeEach(() => {
  jest.clearAllMocks();
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "customer", role: "customer", name: "Rani" }, demo: false })),
    customer: jest.fn(async () => ({
      subscriptions: [{ id: "subscription", portions: 3, status: "active", snapshot: { offer } }],
      deliveries: [],
      addresses: [],
      notifications: [],
      cases: [],
    })),
    customerMenuMonth: jest.fn(async () => month()),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
});

const renderMenu = () =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <ChooseMenu />
    </MobileProvider>,
  );

async function choose() {
  fireEvent.press(await screen.findByRole("button", { name: "Pilih hidangan" }));
  expect(screen.getByRole("button", { name: "Tinjau pilihan" })).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "Ayam panggang · 1 potong" }));
  fireEvent.press(screen.getByRole("button", { name: "Tinjau pilihan" }));
}

it("reads the month with an ISO month-start date", async () => {
  renderMenu();
  await waitFor(() => expect(runtime.api.customerMenuMonth).toHaveBeenCalledWith("subscription", "2026-11-01", "lunch"));
  expect(await screen.findByText("Paket pilihan")).toBeTruthy();
});

it("saves the selected date, whole-delivery version and exact dish version", async () => {
  renderMenu();
  await choose();
  expect(screen.getByText("Lauk · Ayam panggang")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Simpan menu" }));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "customerMenu.saveBatch",
      {
        subscriptionId: "subscription",
        meal: "lunch",
        days: [{ id: "day", date: "2026-11-03", deliveryVersion: 7, version: 0 }],
        choices: [{ slotId: "main:0", optionId: "option", optionVersion: 4 }],
      },
      expect.any(String),
    ),
  );
});

it("a menu conflict keeps the selected dishes available for correction", async () => {
  (runtime.api.command as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("CONFLICT"), { code: "CONFLICT" }));
  renderMenu();
  await choose();
  fireEvent.press(screen.getByRole("button", { name: "Simpan menu" }));
  expect(await screen.findByTestId("menu-error")).toBeTruthy();
  expect(screen.getByText("Lauk · Ayam panggang")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Lanjut memilih" })).toBeTruthy();
});

it("applies one choice to another open date too", async () => {
  (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(
    month([day(), day({ date: "2026-11-04", dayId: "day-2", deliveryVersion: 2 })]),
  );
  renderMenu();
  fireEvent.press(await screen.findByRole("button", { name: "Pilih hidangan" }));
  fireEvent.press(screen.getByRole("button", { name: "Ayam panggang · 1 potong" }));
  fireEvent.press(screen.getByRole("button", { name: "Terapkan juga ke tanggal lain" }));
  fireEvent.press(screen.getByRole("button", { name: "Rabu 4 November" }));
  fireEvent.press(screen.getByRole("button", { name: "Tinjau pilihan" }));
  fireEvent.press(screen.getByRole("button", { name: "Simpan menu" }));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "customerMenu.saveBatch",
      expect.objectContaining({
        days: [
          { id: "day", date: "2026-11-03", deliveryVersion: 7, version: 0 },
          { id: "day-2", date: "2026-11-04", deliveryVersion: 2, version: 0 },
        ],
      }),
      expect.any(String),
    ),
  );
});

it("clears saved choices with resetBatch after confirming", async () => {
  (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(
    month([day({ version: 2, selectionStatus: "selected", details: { meal: "lunch", name: "", description: "", image: "", items: [{ id: "main:0", name: "Ayam panggang", optionId: "option", optionVersion: 4 }] } })]),
  );
  mockConfirm.mockResolvedValueOnce(true);
  renderMenu();
  fireEvent.press(await screen.findByRole("button", { name: "Ubah menu" }));
  fireEvent.press(screen.getByRole("button", { name: "Hapus pilihan, biar katering memilih" }));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "customerMenu.resetBatch",
      {
        subscriptionId: "subscription",
        meal: "lunch",
        days: [{ id: "day", date: "2026-11-03", deliveryVersion: 7, version: 2 }],
      },
      expect.any(String),
    ),
  );
  // Asked first, in the native confirm sheet, as a destructive choice.
  expect(mockConfirm).toHaveBeenCalledWith({
    title: "Hapus pilihan menu?",
    message:
      "Pilihan di tanggal-tanggal ini akan dihapus. Kalau kamu tidak memilih lagi sebelum batas waktu, katering yang memilihkan.",
    confirmLabel: "Hapus pilihan",
    cancelLabel: "Batal",
    tone: "danger",
    icon: "trash",
  });
});

it("discarding menu changes asks through a confirm sheet", async () => {
  const { usePreventRemove } = require("expo-router/react-navigation") as { usePreventRemove: jest.Mock };
  renderMenu();
  await choose();
  fireEvent.press(screen.getByRole("button", { name: "Lanjut memilih" }));
  // Close with a dish chosen: the confirm sheet asks; "Lanjut memilih" keeps the choice on screen.
  mockConfirm.mockResolvedValueOnce(false);
  fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
  await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
  expect(mockConfirm.mock.calls[0][0]).toEqual({
    title: "Buang pilihan menu?",
    message: "Pilihan yang belum disimpan akan hilang.",
    confirmLabel: "Buang",
    cancelLabel: "Lanjut memilih",
    tone: "danger",
    icon: "trash",
  });
  expect(screen.getByRole("button", { name: "Tinjau pilihan" })).toBeTruthy();
  // "Buang" drops the choice.
  mockConfirm.mockResolvedValueOnce(true);
  fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
  expect(await screen.findByRole("button", { name: "Pilih hidangan" })).toBeTruthy();
  // Leaving the screen while dirty (back, a swipe) is held and asks the same way; "Buang" lets the removal go on.
  await choose();
  const held = usePreventRemove.mock.calls.at(-1)!;
  expect(held[0]).toBe(true);
  mockConfirm.mockResolvedValueOnce(true);
  const action = { type: "GO_BACK" };
  held[1]({ data: { action } });
  await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(action));
});

it("saving toasts Menu {weekday} tersimpan", async () => {
  renderMenu();
  await choose();
  fireEvent.press(screen.getByRole("button", { name: "Simpan menu" }));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ message: "Menu Selasa tersimpan", tone: "success" }));
});

it("after the cutoff the caterer chooses and nothing can be edited", async () => {
  (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(
    month([day({ cutoffAt: "2020-01-01T10:00:00Z", editable: false })]),
  );
  renderMenu();
  expect(await screen.findByText(/katering yang memilihkan menunya/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Pilih hidangan" })).toBeNull();
});

it("date rows are 48dp picks with a selection haptic", async () => {
  renderMenu();
  const row = await screen.findByRole("button", { name: /Selasa 3 November/ });
  expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(48);
  expect(row.props.accessibilityState.selected).toBe(true);
  fireEvent.press(row);
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
});

describe("Pilih menu as photo cards (R4)", () => {
  const dish = (extra: Record<string, unknown> = {}) => ({
    id: "option-2",
    version: 1,
    categoryId: "main",
    name: "Rendang sapi dengan sambal hijau dan daun singkong rebus",
    serving: "1 porsi",
    image: "",
    description: "",
    archived: false,
    ...extra,
  });
  const withDishes = (dates = [day()]) => ({
    ...month(dates),
    options: [{ ...month().options[0], image: "/media/ayam.jpg" }, dish()],
  });
  const saved = {
    version: 2,
    selectionStatus: "selected",
    details: { meal: "lunch", name: "", description: "", image: "", items: [] },
  };
  const card = (id: string) => screen.getByTestId(`dish-card-${id}`);

  afterEach(() => {
    mockWindow = { width: 390, height: 800, scale: 2, fontScale: 2 };
    jest.restoreAllMocks();
  });

  it("options are photo cards with name and serving", async () => {
    (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(withDishes());
    renderMenu();
    fireEvent.press(await screen.findByRole("button", { name: "Pilih hidangan" }));
    // A dish with a photo draws it; one without gets the utensil tile at the same size, never an empty hole.
    expect(within(card("option")).getByTestId("dish-photo-option")).toBeTruthy();
    expect(within(card("option")).getByText("Ayam panggang")).toBeTruthy();
    expect(within(card("option")).getByText("1 potong")).toBeTruthy();
    expect(within(card("option-2")).getByTestId("dish-fallback-option-2")).toBeTruthy();
    expect(within(card("option-2")).queryByTestId("dish-photo-option-2")).toBeNull();
  });

  it("the selected card has the accent ring and accessibilityState selected", async () => {
    (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(withDishes());
    renderMenu();
    fireEvent.press(await screen.findByRole("button", { name: "Pilih hidangan" }));
    expect(card("option").props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.queryByTestId("dish-check-option")).toBeNull();
    fireEvent.press(card("option"));
    const on = StyleSheet.flatten(card("option").props.style);
    expect(card("option").props.accessibilityState).toMatchObject({ selected: true });
    expect(on.borderWidth).toBe(2);
    expect(on.borderColor).toBe(nativeThemes.light.forest);
    expect(screen.getByTestId("dish-check-option")).toBeTruthy();
    // The other card keeps the same 2dp edge in a clear colour, so a selection never shifts the grid.
    const off = StyleSheet.flatten(card("option-2").props.style);
    expect(off.borderWidth).toBe(2);
    expect(off.borderColor).not.toBe(nativeThemes.light.forest);
    expect(card("option-2").props.accessibilityState).toMatchObject({ selected: false });
  });

  it("Pilih sebelum {cutoff} shows and turns to the warning tone under 24h", async () => {
    (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(withDishes());
    const view = renderMenu();
    fireEvent.press(await screen.findByRole("button", { name: "Pilih hidangan" }));
    const calm = screen.getByTestId("menu-deadline");
    expect(within(calm).getByText(/^Pilih sebelum \S+ 2 November 17\.00$/)).toBeTruthy();
    expect(StyleSheet.flatten(calm.props.style)?.backgroundColor).toBeUndefined();
    view.unmount();

    const soon = new Date(Date.now() + 3 * 3600_000).toISOString();
    (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(withDishes([day({ cutoffAt: soon })]));
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    render(
      <ThemeProvider storageKey="choose-menu-test">
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <ChooseMenu />
        </MobileProvider>
      </ThemeProvider>,
    );
    fireEvent.press(await screen.findByRole("button", { name: "Pilih hidangan" }));
    // Under a day away the line sits on the attention ground, from the dark palette's own tokens.
    const warn = screen.getByTestId("menu-deadline");
    expect(within(warn).getByText(/^Pilih sebelum /)).toBeTruthy();
    expect(StyleSheet.flatten(warn.props.style).backgroundColor).toBe(nativeThemes.dark.cream);
  });

  it("{x} dari {n} hari sudah dipilih", async () => {
    (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(
      withDishes([day(), day({ date: "2026-11-04", dayId: "day-2", ...saved }), day({ date: "2026-11-05", dayId: "day-3" })]),
    );
    const view = renderMenu();
    expect(await screen.findByText("1 dari 3 hari sudah dipilih")).toBeTruthy();
    view.unmount();

    (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(withDishes([day(), day({ date: "2026-11-04", dayId: "day-2" })]));
    const none = renderMenu();
    expect(await screen.findByText("0 dari 2 hari sudah dipilih")).toBeTruthy();
    none.unmount();

    (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(
      withDishes([day(saved), day({ date: "2026-11-04", dayId: "day-2", ...saved })]),
    );
    renderMenu();
    expect(await screen.findByText("2 dari 2 hari sudah dipilih")).toBeTruthy();
  });

  it("Simpan menu is pinned in the footer", async () => {
    (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(withDishes());
    renderMenu();
    fireEvent.press(await screen.findByRole("button", { name: "Pilih hidangan" }));
    const footer = () => within(screen.getByTestId("screen-footer"));
    expect(footer().getByRole("button", { name: "Tinjau pilihan" })).toBeDisabled();
    fireEvent.press(card("option"));
    fireEvent.press(footer().getByRole("button", { name: "Tinjau pilihan" }));
    fireEvent.press(footer().getByRole("button", { name: "Simpan menu" }));
    fireEvent.press(footer().getByRole("button", { name: "Simpan menu" }));
    await waitFor(() => expect(runtime.api.command).toHaveBeenCalledTimes(1));
  });

  it("Tinjau pilihan is disabled while Hapus pilihan is sending", async () => {
    (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(
      withDishes([
        day({
          ...saved,
          details: { ...saved.details, composition: offer.menus[0].composition, items: [{ id: "main:0", name: "Ayam panggang", optionId: "option", optionVersion: 4 }] },
        }),
      ]),
    );
    (runtime.api.command as jest.Mock).mockImplementation(() => new Promise(() => {}));
    renderMenu();
    fireEvent.press(await screen.findByRole("button", { name: "Ubah menu" }));
    const review = () => within(screen.getByTestId("screen-footer")).getByRole("button", { name: "Tinjau pilihan" });
    expect(review()).toBeEnabled();
    fireEvent.press(screen.getByRole("button", { name: "Hapus pilihan, biar katering memilih" }));
    await waitFor(() => expect(runtime.api.command).toHaveBeenCalledTimes(1));
    expect(review()).toBeDisabled();
  });

  it("at font scale 1.3 on a 360dp phone the cards keep 2 columns and the name wraps to 2 lines", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(withDishes());
    renderMenu();
    fireEvent.press(await screen.findByRole("button", { name: "Pilih hidangan" }));
    for (const id of ["option", "option-2"]) {
      const cell = StyleSheet.flatten(screen.getByTestId(`dish-cell-${id}`).props.style);
      expect(cell.maxWidth).toBe("50%");
      expect(cell.flexBasis).toBe("40%");
    }
    expect(within(card("option-2")).getByText(dish().name).props.numberOfLines).toBe(2);
  });

  it("a cutoff that passes while editing leaves the cards read-only", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
    try {
      const cutoff = new Date(Date.now() + 10_000).toISOString();
      (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(withDishes([day({ cutoffAt: cutoff })]));
      renderMenu();
      fireEvent.press(await screen.findByRole("button", { name: "Pilih hidangan" }));
      act(() => {
        jest.advanceTimersByTime(31_000);
      });
      expect(await screen.findByText(/Batas memilih sudah lewat/)).toBeTruthy();
      expect(card("option").props.accessibilityState).toMatchObject({ disabled: true });
      fireEvent.press(card("option"));
      expect(card("option").props.accessibilityState).toMatchObject({ selected: false });
      expect(screen.queryByTestId("menu-deadline")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
