import React from "react";
import {
  render,
  fireEvent,
  waitFor,
  userEvent,
} from "@testing-library/react-native";
jest.mock("../src/context", () => ({
  useNative: () => ({
    actor: { id: "test" },
    ready: true,
    error: "",
    demo: false,
    locale: "id",
    offers: [],
    t: (id: string) => id,
  }),
  apiBase: "http://localhost:3000",
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
import { Qty, Run, Btn, Txt, Select } from "../src/ui";
import { Modal, ScrollView } from "react-native";
test("portion controls retain one as minimum and the trial maximum", () => {
  const update = jest.fn();
  const screen = render(<Qty value={1} max={2} onChange={update} />);
  fireEvent.press(screen.getByLabelText("Kurangi porsi"));
  expect(update).toHaveBeenLastCalledWith(1);
  screen.rerender(<Qty value={2} max={2} onChange={update} />);
  fireEvent.press(screen.getByLabelText("Tambah porsi"));
  expect(update).toHaveBeenLastCalledWith(2);
});
test("failed capacity command explains the rejection without claiming success", async () => {
  const action = jest.fn().mockRejectedValue(new Error("CAPACITY"));
  const screen = render(<Run label="Konfirmasi tanggal" action={action} />);
  fireEvent.press(screen.getByText("Konfirmasi tanggal"));
  await waitFor(() =>
    expect(screen.getByText(/Porsi pada salah satu tanggal/)).toBeTruthy(),
  );
  expect(screen.queryByText("Perubahan tersimpan.")).toBeNull();
  expect(action).toHaveBeenCalledTimes(1);
});
test("submitting a command disables repeated taps while the server is pending", async () => {
  let finish!: () => void;
  const action = jest.fn(() => new Promise<void>((r) => (finish = r)));
  const screen = render(<Run label="Bayar" action={action} />);
  fireEvent.press(screen.getByText("Bayar"));
  await waitFor(() =>
    expect(screen.getByRole("button").props.accessibilityState.disabled).toBe(
      true,
    ),
  );
  fireEvent.press(screen.getByRole("button"));
  expect(action).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(() =>
    expect(screen.getByText("Perubahan tersimpan.")).toBeTruthy(),
  );
});
test("disabled coverage action cannot navigate and typography retains native scaling", async () => {
  const fn = jest.fn();
  const screen = render(
    <>
      <Btn disabled label="Di luar area" onPress={fn} />
      <Txt kind="title">Makanan berikutnya</Txt>
    </>,
  );
  await userEvent.setup().press(screen.getByRole("button"));
  expect(fn).not.toHaveBeenCalled();
  expect(
    screen.getByText("Makanan berikutnya").props.allowFontScaling,
  ).not.toBe(false);
});

test("select scrolls, reports selection, and dismisses without changing it", () => {
  const update = jest.fn();
  const options = Array.from({ length: 30 }, (_, i) => ({
    value: String(i),
    label: "Area " + i,
  }));
  const screen = render(
    <Select
      label="Area pengantaran"
      value="3"
      options={options}
      onChange={update}
    />,
  );
  fireEvent.press(screen.getByRole("button", { name: "Area pengantaran" }));
  expect(
    screen.getByRole("radio", { name: "Area 3" }).props.accessibilityState
      .checked,
  ).toBe(true);
  expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
  fireEvent.press(screen.getByRole("radio", { name: "Area 29" }));
  expect(update).toHaveBeenCalledWith("29");
  expect(screen.queryByRole("radio")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Area pengantaran" }));
  fireEvent.press(screen.getByRole("button", { name: "Tutup pilihan" }));
  expect(screen.queryByRole("radio")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Area pengantaran" }));
  fireEvent(screen.UNSAFE_getByType(Modal), "requestClose");
  expect(screen.queryByRole("radio")).toBeNull();
  expect(update).toHaveBeenCalledTimes(1);
});

test("missing select value does not imply the first option is selected", () => {
  const screen = render(
    <Select
      label="Alamat"
      value=""
      options={[{ value: "saved", label: "Rumah" }]}
      onChange={jest.fn()}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Alamat" }).props.accessibilityValue
      .text,
  ).toBe("Pilih opsi");
});
