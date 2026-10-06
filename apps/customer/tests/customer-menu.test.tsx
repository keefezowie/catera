import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
const mockCommand = jest.fn();
const mockReload = jest.fn(async () => {});
const mockReadMonth = jest.fn(async (..._args: unknown[]) => null);
const mockLoaders = new Map<string, () => Promise<unknown>>();
const mockDay = {
  date: "2026-11-03",
  dayId: "day",
  version: 0,
  deliveryVersion: 7,
  editable: true,
  cutoffAt: "2099-11-02T17:00:00+07:00",
  selectionStatus: "pending",
  details: null,
};
const mockOffer = {
  id: "offer",
  name: "Paket pilihan",
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
jest.mock("../src/context", () => ({
  useNative: () => ({
    actor: { id: "customer", role: "customer" },
    ready: true,
    locale: "en",
    t: (_: string, en: string) => en,
    command: mockCommand,
  }),
  useData: (key: string, loader: () => Promise<unknown>) => {
    mockLoaders.set(key, loader);
    return {
      data: key.startsWith("menu-subscription")
        ? {
            subscriptions: [
              {
                id: "subscription",
                portions: 3,
                snapshot: { offer: mockOffer },
              },
            ],
          }
        : {
            dates: [mockDay],
            categories: [],
            options: [
              {
                id: "option",
                version: 4,
                categoryId: "main",
                name: "Ayam panggang",
                serving: "1 piece",
                image: "",
                description: "",
                archived: false,
              },
            ],
          },
      error: "",
      loading: false,
      canWrite: true,
      reload: mockReload,
    };
  },
  nativeApi: { customerMenuMonth: (...args: unknown[]) => mockReadMonth(...args) },
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({
    id: "subscription",
    date: "2026-11-03",
    meal: "lunch",
  }),
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, []),
}));
jest.mock("expo-router/react-navigation", () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
}));
import { CustomerMenuScreen } from "../src/customer-menu";
beforeEach(() => {
  jest.clearAllMocks();
  mockLoaders.clear();
  mockCommand.mockResolvedValue({});
});
test("menu reads use an ISO month-start date required by the API", async () => {
  render(<CustomerMenuScreen />);
  await mockLoaders.get("customer-menu:subscription:2026-11:lunch")!();
  expect(mockReadMonth).toHaveBeenCalledWith(
    "subscription",
    "2026-11-01",
    "lunch",
  );
});
async function choose(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByRole("button", { name: "Choose dishes" }));
  expect(
    screen.getByRole("button", { name: "Review selection" }),
  ).toBeDisabled();
  fireEvent.press(screen.getByRole("button", { name: "Main dish" }));
  fireEvent.press(
    screen.getByRole("radio", { name: "Ayam panggang · 1 piece" }),
  );
  fireEvent.press(screen.getByRole("button", { name: "Review selection" }));
}
test("native menu saves the selected date, whole-delivery version, and exact dish version", async () => {
  const screen = render(<CustomerMenuScreen />);
  await choose(screen);
  fireEvent.press(screen.getByRole("button", { name: "Save menus" }));
  await waitFor(() =>
    expect(mockCommand).toHaveBeenCalledWith("customerMenu.saveBatch", {
      subscriptionId: "subscription",
      meal: "lunch",
      days: [{ id: "day", date: "2026-11-03", deliveryVersion: 7, version: 0 }],
      choices: [{ slotId: "main:0", optionId: "option", optionVersion: 4 }],
    }),
  );
});
test("a menu conflict keeps the selected dishes available for correction", async () => {
  mockCommand.mockRejectedValue(new Error("CONFLICT"));
  const screen = render(<CustomerMenuScreen />);
  await choose(screen);
  fireEvent.press(screen.getByRole("button", { name: "Save menus" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByText("Main dish · Ayam panggang")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Keep editing" })).toBeTruthy();
});
