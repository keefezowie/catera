import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ChooseMenu } from "../src/schedule/ChooseMenu";
import { customerLink } from "../src/links";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: "subscription", date: "2026-11-03", meal: "lunch" }),
}));
jest.mock("expo-router/react-navigation", () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
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
  expect(screen.getByRole("button", { name: "Lanjut mengedit" })).toBeTruthy();
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
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
  });
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
  alert.mockRestore();
});

it("after the cutoff the caterer chooses and nothing can be edited", async () => {
  (runtime.api.customerMenuMonth as jest.Mock).mockResolvedValue(
    month([day({ cutoffAt: "2020-01-01T10:00:00Z", editable: false })]),
  );
  renderMenu();
  expect(await screen.findByText(/katering yang memilih menu Anda/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Pilih hidangan" })).toBeNull();
});
