import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
const mockCommand = jest.fn();
const mockQuote = jest.fn();
const mockOffer = {
  id: "outside-catalog",
  name: "Paket lengkap",
  image: "",
  caterer: "Dapur Uji",
  catererId: "caterer",
  price: 25000,
  days: 5,
  meal: "both",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  cutoff: "18:00",
  timezone: "Asia/Jakarta",
  flexible: true,
  areas: ["Jakarta Selatan"],
  menus: [],
  tiers: [],
  durationPricing: {
    revision: 1,
    options: [
      { cycles: 1, discountPercent: 0 },
      { cycles: 3, discountPercent: 5 },
    ],
  },
};
const mockAddress = {
  id: "address",
  label: "Rumah",
  line: "Jalan Uji 12",
  area: "Jakarta Selatan",
  city: "Jakarta",
  instructions: "",
  version: 1,
};
jest.mock("../src/context", () => ({
  useNative: () => ({
    actor: { id: "customer", role: "customer" },
    ready: true,
    locale: "en",
    t: (_: string, en: string) => en,
    command: mockCommand,
    offers: [],
  }),
  useData: (key: string) => ({
    data: key.startsWith("checkout-offer")
      ? { offer: mockOffer }
      : key === "checkout-customer"
        ? { addresses: [mockAddress] }
        : { mode: "direct", availableMethods: ["QRIS"] },
    error: "",
    loading: false,
    canWrite: true,
    reload: jest.fn(),
  }),
  nativeApi: { quote: (...args: unknown[]) => mockQuote(...args) },
}));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({
    id: "outside-catalog",
    portions: "2",
    cycles: "3",
  }),
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, []),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
}));
import { CheckoutScreen } from "../src/checkout";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

beforeEach(() => {
  jest.clearAllMocks();
  mockQuote.mockImplementation(async (p) => ({
    ...p,
    offer: mockOffer,
    dates: ["2026-11-01", "2026-11-02"],
    subtotal: 100000,
    discount: 0,
    durationDiscount: 5000,
    promotion: 0,
    serviceFee: 2000,
    total: 97000,
  }));
  mockCommand.mockResolvedValue({ id: "checkout-created" });
});
test("explicit purchase choices take precedence over an older saved draft", async () => {
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValueOnce(
      JSON.stringify({
        qty: 1,
        cycles: 1,
        date: "2099-11-02",
        address: "address",
      }),
    );
  const screen = render(<CheckoutScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Review schedule & price" }),
    ).toBeEnabled(),
  );
  fireEvent.press(
    screen.getByRole("button", { name: "Review schedule & price" }),
  );
  await waitFor(() =>
    expect(mockQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        portions: 2,
        cycles: 3,
        startDate: "2099-11-02",
      }),
    ),
  );
});
test("a deep-linked offer outside catalog100 purchases with reviewed cycles and accepted terms", async () => {
  const screen = render(<CheckoutScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Review schedule & price" }),
    ).toBeEnabled(),
  );
  fireEvent.press(
    screen.getByRole("button", { name: "Review schedule & price" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Continue to payment" }),
    ).toBeDisabled(),
  );
  expect(mockQuote).toHaveBeenCalledWith(
    expect.objectContaining({
      packageId: "outside-catalog",
      portions: 2,
      cycles: 3,
      addressId: "address",
    }),
  );
  fireEvent(
    screen.getByLabelText("Agree to the schedule, address, and terms"),
    "valueChange",
    true,
  );
  fireEvent.press(screen.getByRole("button", { name: "Continue to payment" }));
  await waitFor(() =>
    expect(mockCommand).toHaveBeenCalledWith(
      "checkout.create",
      expect.objectContaining({
        acceptedTerms: true,
        cycles: 3,
        expectedQuote: expect.objectContaining({ total: 97000 }),
      }),
    ),
  );
  expect(router.replace).toHaveBeenCalledWith("/payment/checkout-created");
});
test("editing a reviewed purchase clears acceptance before another checkout can be created", async () => {
  const screen = render(<CheckoutScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Review schedule & price" }),
    ).toBeEnabled(),
  );
  fireEvent.press(
    screen.getByRole("button", { name: "Review schedule & price" }),
  );
  await waitFor(() =>
    expect(
      screen.getByLabelText("Agree to the schedule, address, and terms"),
    ).toBeTruthy(),
  );
  fireEvent(
    screen.getByLabelText("Agree to the schedule, address, and terms"),
    "valueChange",
    true,
  );
  fireEvent.press(screen.getByRole("button", { name: "Edit selection" }));
  fireEvent.press(
    screen.getByRole("button", { name: "Review schedule & price" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Continue to payment" }),
    ).toBeDisabled(),
  );
  expect(mockCommand).not.toHaveBeenCalled();
});
