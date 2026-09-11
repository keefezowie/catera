import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { ScrollView } from "react-native";
import { PackageScreen } from "../src/purchase";

const mockParams: Record<string, string> = {
  id: "test",
  section: "contents",
  meal: "dinner",
};
const menu = {
  name: "Test menu",
  meal: "lunch",
  image: "",
  description: "",
  items: [],
};
const mockOffer = {
  id: "test",
  name: "Synthetic package",
  image: "",
  description: "",
  caterer: "Test caterer",
  catererId: "seller",
  meal: "both",
  price: 35000,
  days: 5,
  flexible: true,
  tags: [],
  areas: [],
  tiers: [],
  weekdays: [1, 2],
  windows: { lunch: "11:00", dinner: "17:00" },
  cutoff: "17:00",
  menus: [menu, { ...menu, meal: "dinner" }],
};
jest.mock("../src/context", () => ({
  useNative: () => ({
    offers: [mockOffer],
    area: "",
    compare: [],
    setArea: jest.fn(),
    toggleCompare: jest.fn(),
    locale: "id",
    t: (id: string) => id,
  }),
  useData: () => ({ data: null, error: "" }),
  apiBase: "https://catera.example",
  nativeApi: { request: jest.fn() },
}));
jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  router: { push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test("contents navigation waits for parent and selected meal layout, then scrolls once", async () => {
  mockParams.section = "contents";
  mockParams.meal = "dinner";
  const screen = render(<PackageScreen />);
  const scroll = screen.UNSAFE_getAllByType(ScrollView)[0].instance;
  const scrollTo = jest.spyOn(scroll, "scrollTo");
  fireEvent(
    screen.UNSAFE_getByProps({ nativeID: "package-contents" }),
    "layout",
    { nativeEvent: { layout: { y: 500 } } },
  );
  expect(scrollTo).not.toHaveBeenCalled();
  fireEvent(
    screen.UNSAFE_getByProps({ nativeID: "isi-paket-dinner" }),
    "layout",
    { nativeEvent: { layout: { y: 350 } } },
  );
  await waitFor(() =>
    expect(scrollTo).toHaveBeenCalledWith({ y: 850, animated: false }),
  );
  fireEvent(
    screen.UNSAFE_getByProps({ nativeID: "isi-paket-dinner" }),
    "layout",
    { nativeEvent: { layout: { y: 400 } } },
  );
  expect(scrollTo).toHaveBeenCalledTimes(1);
});

test("unknown contents meal parameters preserve normal package navigation", () => {
  mockParams.meal = "unknown";
  const screen = render(<PackageScreen />);
  const scrollTo = jest.spyOn(
    screen.UNSAFE_getAllByType(ScrollView)[0].instance,
    "scrollTo",
  );
  fireEvent(
    screen.UNSAFE_getByProps({ nativeID: "package-contents" }),
    "layout",
    { nativeEvent: { layout: { y: 500 } } },
  );
  expect(scrollTo).not.toHaveBeenCalled();
  expect(screen.getByText("Synthetic package")).toBeTruthy();
});
