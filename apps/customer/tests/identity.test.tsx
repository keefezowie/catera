import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
const mockExchange = jest.fn(),
  mockUpdate = jest.fn(async () => ({ error: null })),
  mockSignOut = jest.fn(async () => ({ error: null }));
const mockRefresh = jest.fn(async () => {});
jest.mock("../src/context", () => ({
  useNative: () => ({
    locale: "en",
    t: (_: string, en: string) => en,
    refresh: mockRefresh,
  }),
  supabase: {
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => mockExchange(...args),
      updateUser: (...args: unknown[]) => mockUpdate(...args),
      getUser: async () => ({
        data: { user: { id: "verified-user" } },
        error: null,
      }),
      signOut: () => mockSignOut(),
    },
  },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () =>
    JSON.stringify({
      purpose: "recovery",
      next: "/checkout/package?cycles=3",
      at: Date.now(),
    }),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ code: "one-time-code" }),
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, []),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
}));
import { AuthCallbackScreen } from "../src/identity";
import { router } from "expo-router";
beforeEach(() => jest.clearAllMocks());
test("recovery refuses a normal sign-in code even when the local intent says recovery", async () => {
  mockExchange.mockResolvedValue({
    data: {
      user: { id: "verified-user" },
      session: { access_token: "synthetic" },
      redirectType: null,
    },
    error: null,
  });
  const screen = render(<AuthCallbackScreen />);
  await waitFor(() =>
    expect(screen.getByText(/The link expired/)).toBeTruthy(),
  );
  expect(screen.queryByLabelText("New password")).toBeNull();
  expect(mockUpdate).not.toHaveBeenCalled();
});
test("a verified recovery code resets the matching session and preserves checkout on return", async () => {
  mockExchange.mockResolvedValue({
    data: {
      user: { id: "verified-user" },
      session: { access_token: "synthetic" },
      redirectType: "recovery",
    },
    error: null,
  });
  const screen = render(<AuthCallbackScreen />);
  await waitFor(() =>
    expect(screen.getByLabelText("New password")).toBeTruthy(),
  );
  fireEvent.changeText(
    screen.getByLabelText("New password"),
    "synthetic-password-2026",
  );
  expect(
    screen.getByRole("button", { name: "Save password & sign in" }),
  ).toBeDisabled();
  fireEvent.changeText(
    screen.getByLabelText("Confirm password"),
    "synthetic-password-2026",
  );
  fireEvent.press(
    screen.getByRole("button", { name: "Save password & sign in" }),
  );
  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  expect(router.replace).toHaveBeenCalledWith({
    pathname: "/login",
    params: { next: "/checkout/package?cycles=3" },
  });
});
