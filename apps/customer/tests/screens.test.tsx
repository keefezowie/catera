import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { ScrollView, AccessibilityInfo } from "react-native";

const mockPasswordLogin = jest.fn();
const mockSetLocale = jest.fn();
const mockNative = {
  actor: null,
  ready: true,
  error: "",
  demo: false,
  locale: "id",
  area: "",
  compare: [],
  offers: [],
  t: (id: string, en: string) => (mockNative.locale === "id" ? id : en),
  passwordLogin: mockPasswordLogin,
  setLocale: mockSetLocale,
  setArea: jest.fn(),
  refresh: jest.fn(),
  toggleCompare: jest.fn(),
};
jest.mock("../src/context", () => ({
  useNative: () => mockNative,
  useData: () => ({ data: null, error: "" }),
  apiBase: "https://catera.example",
  nativeApi: { request: jest.fn() },
}));
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, []),
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ next: "/checkout/package-1?portions=2" }),
}));
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
import { LoginScreen, Discover } from "../src/purchase";

beforeEach(() => {
  jest.clearAllMocks();
  mockNative.locale = "id";
});

test("email login keeps passwords masked and returns customers to checkout", async () => {
  mockPasswordLogin.mockResolvedValue({ id: "customer", role: "customer" });
  const screen = render(<LoginScreen />);
  fireEvent.changeText(
    screen.getByLabelText("Email"),
    "demo.customer@catera.example",
  );
  const password = screen.getByLabelText("Kata sandi");
  expect(password.props.secureTextEntry).toBe(true);
  fireEvent.changeText(password, "synthetic-test-password");
  fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith(
      "/checkout/package-1?portions=2",
    ),
  );
  expect(mockPasswordLogin).toHaveBeenCalledTimes(1);
});

test("failed login explains the problem and does not navigate", async () => {
  mockPasswordLogin.mockRejectedValue(new Error("INVALID_CREDENTIALS"));
  const screen = render(<LoginScreen />);
  fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByText(/Email atau kata sandi tidak cocok/)).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});

test("language menu is available before authentication and updates login copy", () => {
  const screen = render(<LoginScreen />);
  fireEvent.press(screen.getByRole("button", { name: "Bahasa" }));
  fireEvent.press(screen.getByRole("radio", { name: "English" }));
  expect(mockSetLocale).toHaveBeenCalledWith("en");
  mockNative.locale = "en";
  screen.rerender(<LoginScreen />);
  expect(screen.getByRole("button", { name: "Language" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
});

test("discovery section actions scroll without replacing the screen or clearing search", async () => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(true);
  const screen = render(<Discover />);
  const scroll = screen.UNSAFE_getAllByType(ScrollView)[0].instance;
  const scrollTo = jest.spyOn(scroll, "scrollTo");
  fireEvent(screen.UNSAFE_getByProps({ nativeID: "packages" }), "layout", {
    nativeEvent: { layout: { y: 250 } },
  });
  fireEvent(screen.UNSAFE_getByProps({ nativeID: "how-it-works" }), "layout", {
    nativeEvent: { layout: { y: 1450 } },
  });
  fireEvent.changeText(screen.getByLabelText("Cari makanan favorit"), "ayam");
  fireEvent.press(screen.getByRole("button", { name: "Cara berlangganan" }));
  await waitFor(() =>
    expect(scrollTo).toHaveBeenCalledWith({ y: 1450, animated: false }),
  );
  fireEvent.press(screen.getByRole("button", { name: "Jelajah katering" }));
  await waitFor(() =>
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 250, animated: false }),
  );
  expect(screen.getByLabelText("Cari makanan favorit").props.value).toBe(
    "ayam",
  );
  expect(router.push).not.toHaveBeenCalled();
});
