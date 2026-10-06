import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { Checkout } from "@catera/domain";
let mockCheckout: Checkout;
const mockCommand = jest.fn(),
  mockReload = jest.fn(async () => {});
jest.mock("../src/context", () => ({
  useNative: () => ({
    actor: { id: "customer", role: "customer" },
    ready: true,
    demo: true,
    locale: "en",
    t: (_: string, en: string) => en,
    command: mockCommand,
  }),
  useData: () => ({
    data: mockCheckout,
    error: "",
    loading: false,
    canWrite: true,
    reload: mockReload,
  }),
  nativeApi: { checkout: jest.fn() },
}));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: "checkout" }),
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, []),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
}));
import { PaymentScreen } from "../src/payment";
beforeEach(() => {
  jest.clearAllMocks();
  mockCheckout = {
    id: "checkout",
    state: "pending",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    subscription_id: null,
    payment_url: null,
    quote: {
      packageId: "package",
      offer: { name: "Synthetic meal", catererId: "caterer" },
      portions: 2,
      dates: ["2026-11-01"],
      total: 50000,
    } as Checkout["quote"],
    payment: {
      mode: "direct",
      status: "choose_method",
      selectedMethod: null,
      availableMethods: ["QRIS", "VIRTUAL_ACCOUNT_BRI"],
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      instructions: null,
    },
  };
});
test("direct sandbox chooses one method and never exposes the demo-paid shortcut", async () => {
  const screen = render(<PaymentScreen />);
  expect(screen.queryByText("Simulate successful payment")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Payment method" }));
  fireEvent.press(screen.getByRole("radio", { name: "BRI Virtual Account" }));
  fireEvent.press(
    screen.getByRole("button", { name: "Show payment instructions" }),
  );
  await waitFor(() =>
    expect(mockCommand).toHaveBeenCalledWith("checkout.payment.start", {
      id: "checkout",
      method: "VIRTUAL_ACCOUNT_BRI",
    }),
  );
});
test("an elapsed provider deadline hides payment instructions and blocks a duplicate purchase", () => {
  mockCheckout.payment = {
    ...mockCheckout.payment!,
    selectedMethod: "VIRTUAL_ACCOUNT_BRI",
    status: "awaiting_payment",
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    instructions: {
      kind: "virtual_account",
      accountNumber: "123456789",
      accountName: "SYNTHETIC",
      bank: "BRI",
    },
  };
  const screen = render(<PaymentScreen />);
  expect(screen.getByText("Checking payment")).toBeTruthy();
  expect(screen.queryByText("123456789")).toBeNull();
  expect(screen.queryByText("Choose a new schedule")).toBeNull();
});
test("paid without a booking remains in verification and explicitly refreshes the provider", async () => {
  mockCheckout.state = "paid";
  const screen = render(<PaymentScreen />);
  expect(screen.queryByText("Choose a new schedule")).toBeNull();
  expect(screen.queryByText("Payment received")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Check status" }));
  await waitFor(() =>
    expect(mockCommand).toHaveBeenCalledWith("checkout.payment.refresh", {
      id: "checkout",
    }),
  );
});
