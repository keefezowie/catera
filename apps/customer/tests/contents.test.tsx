import React from "react";
import { render } from "@testing-library/react-native";
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
  apiBase: "http://localhost:3000",
  useNative: () => ({
    locale: mockLocale.value,
    t: (id: string, en: string) => (mockLocale.value === "id" ? id : en),
  }),
}));
const offer = {
  packageType: "nasi_box" as const,
  menus: [
    {
      meal: "lunch",
      name: "Contoh",
      description: "",
      image: "",
      composition: [{ id: "lauk", name: "Lauk", slots: 2 }],
      items: [
        {
          id: "a",
          name: "Ayam",
          description: "",
          image: "",
          serving: "150 g",
          groupId: "lauk",
        },
        {
          id: "b",
          name: "Tempe",
          description: "",
          image: "",
          serving: "2 potong",
          groupId: "lauk",
        },
      ],
      nutrition: { proteinG: 40, carbsG: 0 },
    },
  ],
};
test("shows every dish, serving, component count and zero macro", () => {
  mockLocale.value = "id";
  const screen = render(<PackageContents offer={offer} />);
  expect(screen.getByText("2 Lauk")).toBeTruthy();
  expect(screen.getByText("Ayam · 150 g")).toBeTruthy();
  expect(screen.getByText("Tempe · 2 potong")).toBeTruthy();
  expect(screen.getByText(/0 g karbohidrat/)).toBeTruthy();
});
test("dated menus with absent macros show unavailable, including English", () => {
  mockLocale.value = "en";
  const screen = render(
    <PackageContents
      offer={{
        ...offer,
        menus: [{ ...offer.menus[0], source: "dated", nutrition: null }],
      }}
    />,
  );
  expect(screen.getByText(/Menu for this date/)).toBeTruthy();
  expect(screen.getByText("Nutrition unavailable")).toBeTruthy();
  expect(screen.queryByText(/40 g protein/)).toBeNull();
});
