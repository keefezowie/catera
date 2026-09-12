import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Modal } from "react-native";
import { router } from "expo-router";
import type { Offer } from "@catera/domain";
import { PackagePreview } from "../src/package-preview";
import { PackageContents } from "../src/package-contents";
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
}));
const mockLocale = { value: "id" };
jest.mock("../src/context", () => ({
  apiBase: "http://localhost:3120",
  useNative: () => ({
    locale: mockLocale.value,
    t: (id: string, en: string) => (mockLocale.value === "id" ? id : en),
  }),
}));
const dish = {
  id: "ayam",
  name: "Ayam",
  serving: "150 g",
  description: "Included dish",
  image: "/ayam.png",
};
const lunch = {
  name: "Lunch",
  description: "",
  image: "",
  meal: "lunch",
  items: [dish, { ...dish, id: "tempe", name: "Tempe", image: "" }],
  nutrition: { proteinG: 45, carbsG: 0 },
};
const offer = {
  id: "test",
  packageType: "ala_carte",
  meal: "both",
  menus: [
    lunch,
    {
      ...lunch,
      meal: "dinner",
      items: [dish],
      nutrition: null,
      source: "dated",
    },
  ],
  nutrition: { proteinG: { min: 35, max: 45 }, carbsG: 0 },
} as Offer;
beforeEach(() => {
  mockLocale.value = "id";
  jest.clearAllMocks();
});
function Preview() {
  const [meal, setMeal] = useState("lunch");
  return <PackagePreview offer={offer} meal={meal} onMealChange={setMeal} />;
}
test("switches only the menu preview while retaining package nutrition", () => {
  const screen = render(<Preview />);
  expect(screen.getByText("2 hidangan")).toBeTruthy();
  expect(screen.getByText("35–45 g")).toBeTruthy();
  expect(screen.getByText("0 g")).toBeTruthy();
  fireEvent.press(screen.getByText("Malam"));
  expect(screen.getByText("1 hidangan")).toBeTruthy();
  expect(screen.getByText("Menu tanggal ini")).toBeTruthy();
  expect(screen.getByText("35–45 g")).toBeTruthy();
  fireEvent.press(screen.getByText("Lihat isi paket"));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/package/[id]",
    params: { id: "test", section: "contents", meal: "dinner" },
  });
});
test("gallery opens a named photo, handles Android Back, and retains dishes without photos", () => {
  const screen = render(
    <PackageContents
      offer={{ ...offer, menus: [lunch] }}
      presentation="gallery"
    />,
  );
  expect(screen.getByText("Tempe")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Lihat foto Ayam" }));
  expect(screen.getByText("Tutup")).toBeTruthy();
  fireEvent(screen.UNSAFE_getByType(Modal), "requestClose");
  expect(screen.queryByText("Tutup")).toBeNull();
  fireEvent(screen.getByLabelText("Ayam"), "error");
  expect(screen.queryByRole("button", { name: "Lihat foto Ayam" })).toBeNull();
  expect(screen.getByText("Ayam")).toBeTruthy();
});
test("single duplicate photo uses an explicit viewer link and English copy", () => {
  mockLocale.value = "en";
  const screen = render(
    <PackageContents
      offer={{ ...offer, menus: [{ ...lunch, items: [dish] }] }}
      presentation="gallery"
      coverImage={dish.image}
    />,
  );
  expect(screen.getByText("View dish photo")).toBeTruthy();
  expect(screen.getByText("Example menu")).toBeTruthy();
  fireEvent.press(screen.getByText("View dish photo"));
  expect(screen.getByText("Close")).toBeTruthy();
  expect(screen.getAllByText("150 g").length).toBeGreaterThan(0);
});
