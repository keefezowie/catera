import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import type { MealMenu } from "@catera/domain";
import { withDapurScale } from "./dapur-scale";
import { withMobile } from "./with-mobile";
import { lastGuard, resetSheets, unsavedGuard } from "./sheet-host";
import { SlotEditor } from "../src/menu/SlotEditor";

jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Link: () => null }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-notifications", () => ({
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
}));

const composition = [
  { id: "g-nasi", categoryId: "rice", name: "Nasi", slots: 1 },
  { id: "g-lauk", categoryId: "main", name: "Lauk", slots: 2 },
];
const food = (id: string, groupId: string, categoryId: string, name: string) => ({
  id, groupId, categoryId, name, description: "", image: "", serving: "",
});
const full = [food("i-nasi", "g-nasi", "rice", "Nasi putih"), food("i-ayam", "g-lauk", "main", "Ayam goreng"), food("i-tempe", "g-lauk", "main", "Tempe bacem")];
const offer = {
  id: "p-1", name: "Makan Siang Rumahan", status: "published", meal: "lunch", weekdays: [1, 2, 3, 4, 5], contentRevision: 2, image: "",
  menus: [{ meal: "lunch", name: "Makan Siang", description: "", image: "", composition }],
};

async function mountDay(command: jest.Mock) {
  const { createMobileRuntime, MobileProvider: Base } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
  const { MenuDayScreen } = jest.requireActual("../src/menu/MenuDayScreen") as typeof import("../src/menu/MenuDayScreen");
  const Provider = (props: ComponentProps<typeof Base>) => withDapurScale(<Base {...props} />);
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "mde" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur" }, dishes: [], datedMenus: [], offers: [offer] })),
    menuMonth: jest.fn(async () => ({
      dates: [{ date: "2026-10-07", version: 3, editable: true, details: { ...offer.menus[0], contentModel: "slots", items: full } as unknown as MealMenu }],
      categories: [],
    })),
    command,
  } as unknown as typeof runtime.api;
  await render(
    <Provider runtime={runtime} linkMapper={(h: string) => h}>
      <MenuDayScreen date="2026-10-07" packageId="p-1" meal="lunch" />
    </Provider>,
  );
}

beforeEach(() => {
  unsavedGuard.mockClear();
  resetSheets();
});

const newDish = { id: "d-soto", name: "Soto", categoryId: "main", description: "", image: "", serving: "", catererId: "k-1", version: 1, archived: false };

/** Swaps Ayam goreng for a new dish, leaving the day complete and different from the loaded one. */
async function swapDish() {
  await fireEvent.press(await screen.findByRole("button", { name: "Hapus Ayam goreng" }));
  await fireEvent.changeText(screen.getByLabelText("Tambah lauk"), "Soto");
  await fireEvent.press(screen.getByRole("button", { name: /Buat hidangan baru/ }));
  await screen.findByText("Soto");
}

describe("menu day unsaved guard", () => {
  it("asks only once the slots differ from the loaded menu", async () => {
    await mountDay(jest.fn(async () => newDish));
    await screen.findByText("Ayam goreng");
    expect(lastGuard()).toBeNull();
    await swapDish();
    expect(lastGuard()).toMatchObject({ noun: "perubahan menu" });
  });

  it("is off while saving and after the save went through", async () => {
    let finish: () => void = () => undefined;
    const command = jest.fn((action: string) =>
      action === "dish.save" ? Promise.resolve(newDish) : new Promise((resolve) => { finish = () => resolve({}); }),
    );
    await mountDay(command);
    await swapDish();
    await fireEvent.press(within(screen.getByTestId("screen-footer")).getByRole("button", { name: "Simpan menu" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("menu.saveBatch", expect.anything(), expect.anything()));
    expect(lastGuard()).toBeNull();
    await act(async () => finish());
    expect(lastGuard()).toBeNull();
  });
});

describe("menu day save failure", () => {
  it("shows the error in the footer above the button", async () => {
    await mountDay(jest.fn(async (action: string) => {
      if (action === "dish.save") return newDish;
      throw new Error("jaringan");
    }));
    await swapDish();
    await fireEvent.press(within(screen.getByTestId("screen-footer")).getByRole("button", { name: "Simpan menu" }));
    const footer = screen.getByTestId("screen-footer");
    await waitFor(() => expect(within(footer).getByTestId("form-error")).toBeTruthy());
    expect(within(screen.getByTestId("screen-body")).queryByTestId("form-error")).toBeNull();
  });
});

describe("SlotEditor create dish", () => {
  const editor = async (onCreate: () => Promise<unknown>, onChange = jest.fn(), library: never[] = []) =>
    await render(
      withMobile(
        <SlotEditor composition={composition} items={[]} library={library} usage={new Map()} onChange={onChange} onCreate={onCreate as never} canEdit />,
      ),
    );

  it("a dish removed while another is being created stays removed", async () => {
    let finish: (d: unknown) => void = () => undefined;
    await mountDay(jest.fn((action: string) => (action === "dish.save" ? new Promise((r) => { finish = r; }) : Promise.resolve({}))));
    await fireEvent.press(await screen.findByRole("button", { name: "Hapus Ayam goreng" }));
    await fireEvent.changeText(screen.getByLabelText("Tambah lauk"), "Soto");
    await fireEvent.press(screen.getByRole("button", { name: /Buat hidangan baru/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Hapus Nasi putih" }));
    await act(async () => finish(newDish));
    await screen.findByText("Soto");
    expect(screen.queryByText("Nasi putih")).toBeNull();
  });

  it("Enter picks the first suggestion", async () => {
    const onChange = jest.fn();
    const onCreate = jest.fn();
    await editor(onCreate, onChange, [{ ...newDish, name: "Soto ayam" }] as never[]);
    await fireEvent.changeText(screen.getByLabelText("Tambah lauk"), "Soto");
    await fireEvent(screen.getByLabelText("Tambah lauk"), "submitEditing");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].name).toBe("Soto ayam");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("Enter creates when nothing is suggested, and does nothing on an empty input", async () => {
    const onCreate = jest.fn(async () => newDish);
    await editor(onCreate);
    await fireEvent(screen.getByLabelText("Tambah lauk"), "submitEditing");
    expect(onCreate).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("Tambah lauk"), "Soto");
    await fireEvent(screen.getByLabelText("Tambah lauk"), "submitEditing");
    expect(onCreate).toHaveBeenCalledWith("Soto", "main");
  });

  it("creates once however often it is pressed, and shows busy", async () => {
    let resolve: (d: unknown) => void = () => undefined;
    const onCreate = jest.fn(() => new Promise((r) => { resolve = r; }));
    await editor(onCreate);
    await fireEvent.changeText(screen.getByLabelText("Tambah lauk"), "Soto");
    const create = screen.getByRole("button", { name: /Buat hidangan baru/ });
    await fireEvent.press(create);
    await fireEvent.press(create);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Buat hidangan baru/ }).props.accessibilityState?.busy).toBe(true);
    await act(async () => resolve(newDish));
  });

  it("shows an error and lets the caterer retry when creating fails", async () => {
    const onCreate = jest.fn().mockRejectedValueOnce(new Error("jaringan")).mockResolvedValueOnce(newDish);
    const onChange = jest.fn();
    await editor(onCreate, onChange);
    await fireEvent.changeText(screen.getByLabelText("Tambah lauk"), "Soto");
    await fireEvent.press(screen.getByRole("button", { name: /Buat hidangan baru/ }));
    expect(await screen.findByTestId("form-error")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("Tambah lauk"), "Soto b");
    expect(screen.queryByTestId("form-error")).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Tambah lauk"), "Soto");
    await fireEvent.press(screen.getByRole("button", { name: /Buat hidangan baru/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});
