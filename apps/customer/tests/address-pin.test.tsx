import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { Address } from "@catera/domain";
import { AddressForm } from "../src/account/AddressForm";
import { PinPicker } from "../src/account/PinPicker";
import { putPin, takePin } from "../src/account/pin";
import { customerLink } from "../src/links";

let mockParams: Record<string, string> = {};
let mockFocus: () => void = () => {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => {
    mockFocus = effect;
    require("react").useEffect(effect, [effect]);
  },
}));
jest.mock("@catera/mobile-ui", () => ({
  ...jest.requireActual("@catera/mobile-ui"),
  useConfirm: () => jest.fn(async () => true),
  useActionSheet: () => jest.fn(async () => null),
  useToast: () => ({ show: jest.fn(), hide: jest.fn() }),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

const BLOK_M = { lat: -6.2441, lng: 106.7992 };
const BEKASI = { lat: -6.2383, lng: 107.0 };
const DRAFT_KEY = "customer:baru";
const OLD: Address = { id: "a1", label: "Rumah", line: "Jl. Contoh 12", area: "Jakarta Selatan", city: "Jakarta", instructions: "", version: 2 };

let runtime: MobileRuntime;
let command: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY = "test-key";
  mockParams = {};
  takePin(DRAFT_KEY);
  command = jest.fn(async () => ({ id: "a1" }));
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "customer", role: "customer", name: "Rani" }, demo: false })),
    customer: jest.fn(async () => ({ subscriptions: [], deliveries: [], addresses: [OLD], notifications: [], cases: [] })),
    command,
  } as unknown as MobileRuntime["api"];
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
});

const show = (ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );
const saveButton = () => screen.findByRole("button", { name: "Simpan alamat" });
const street = () => screen.findByLabelText(/Jalan, nomor, detail/);

describe("AddressForm with pins on", () => {
  it("asks for the pin first, and starts with no area to slip through unread", async () => {
    await show(<AddressForm />);
    expect(await screen.findByTestId("address-pin-open")).toBeTruthy();
    expect(screen.getByText("Isi dulu: titik lokasi, jalan, area, kota.")).toBeTruthy();
  });

  it("opens the map, takes the area and city from the point, and saves it with what the customer wrote", async () => {
    await show(<AddressForm />);
    await fireEvent.press(await screen.findByTestId("address-pin-open"));
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/alamat-peta", params: expect.objectContaining({ key: DRAFT_KEY }) }));
    putPin(DRAFT_KEY, BLOK_M);
    await act(async () => mockFocus());
    expect(await screen.findByTestId("address-pin-set")).toBeTruthy();
    await fireEvent.changeText(await street(), "Jl. Wijaya I No. 12");
    await fireEvent.press(await saveButton());
    await waitFor(() => expect(command).toHaveBeenCalled());
    expect(command.mock.calls[0][0]).toBe("address.save");
    expect(command.mock.calls[0][1]).toMatchObject({ line: "Jl. Wijaya I No. 12", area: "Jakarta Selatan", city: "Jakarta", ...BLOK_M });
  });

  it("holds the save when the chosen area disagrees with the pin", async () => {
    await show(<AddressForm />);
    await screen.findByTestId("address-pin-open");
    putPin(DRAFT_KEY, BLOK_M);
    await act(async () => mockFocus());
    await screen.findByTestId("address-pin-set");
    await fireEvent.press(screen.getByText("Bandung"));
    expect(await screen.findByText(/Titik di peta ada di Jakarta Selatan\. Pilih area itu, atau ubah titiknya\./)).toBeTruthy();
    expect((await saveButton()).props.accessibilityState?.disabled).toBe(true);
  });

  it("asks an older address for its pin before saving an edit", async () => {
    mockParams = { id: "a1" };
    await show(<AddressForm />);
    expect(await screen.findByTestId("address-pin-open")).toBeTruthy();
    expect((await saveButton()).props.accessibilityState?.disabled).toBe(true);
  });
});

describe("AddressForm with no maps key", () => {
  it("looks and saves as before pins", async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
    // Another person, so the unsaved draft the test above left in memory isn't theirs.
    (runtime.api.me as jest.Mock).mockResolvedValue({ actor: { id: "customer-2", role: "customer", name: "Dina" }, demo: false });
    await show(<AddressForm />);
    await fireEvent.changeText(await street(), "Jl. Wijaya I No. 12");
    expect(screen.queryByTestId("address-pin-open")).toBeNull();
    await fireEvent.press(await saveButton());
    await waitFor(() => expect(command).toHaveBeenCalled());
    const payload = command.mock.calls[0][1];
    expect(payload).toMatchObject({ area: "Jakarta Selatan", city: "Jakarta" });
    expect(payload).not.toHaveProperty("lat");
  });
});

describe("PinPicker", () => {
  const settle = (point: { lat: number; lng: number }, delta = 0.004) =>
    act(async () =>
      screen.getByTestId("pin-map").props.onRegionChangeComplete({ latitude: point.lat, longitude: point.lng, latitudeDelta: delta, longitudeDelta: delta }),
    );
  const useButton = () => screen.getByRole("button", { name: "Pakai titik ini" });
  const heading = () => screen.getByText(/^(Titik ini|Perbesar)/);

  it("hands the settled point back to the form and closes", async () => {
    mockParams = { key: DRAFT_KEY, lat: String(BLOK_M.lat), lng: String(BLOK_M.lng) };
    await show(<PinPicker />);
    await screen.findByTestId("pin-map");
    await settle(BLOK_M);
    expect(screen.getByText("Titik ini ada di Jakarta Selatan")).toBeTruthy();
    await fireEvent.press(useButton());
    expect(takePin(DRAFT_KEY)).toEqual(BLOK_M);
    expect(router.back).toHaveBeenCalled();
  });

  it("won't take a pin until the map is zoomed in, or one outside the service", async () => {
    mockParams = { key: DRAFT_KEY, area: "Jakarta Selatan" };
    await show(<PinPicker />);
    await screen.findByTestId("pin-map");
    expect(screen.getByText("Perbesar peta dulu")).toBeTruthy();
    expect(useButton().props.accessibilityState?.disabled).toBe(true);
    await settle(BEKASI);
    expect(screen.getByText("Titik ini di luar area layanan")).toBeTruthy();
    expect(useButton().props.accessibilityState?.disabled).toBe(true);
    expect(heading()).toBeTruthy();
  });

  it("moves to the phone's location, and says what to do when location is off", async () => {
    mockParams = { key: DRAFT_KEY };
    await show(<PinPicker />);
    await fireEvent.press(await screen.findByTestId("pin-locate"));
    expect(await screen.findByText(/^Titik ini ada di Jakarta/)).toBeTruthy();
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: "denied" });
    await fireEvent.press(screen.getByTestId("pin-locate"));
    expect(await screen.findByText("Izin lokasi mati. Cari alamat atau geser peta.")).toBeTruthy();
  });

  it("searches through the server, moves to the pick, and falls back to dragging when search is down", async () => {
    const fetchMock = jest.fn(async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      return { ok: true, json: async () => (body.query ? { suggestions: [{ id: "p1", title: "Jl. Senopati", detail: "Jakarta Selatan" }] } : { location: BLOK_M }) };
    });
    globalThis.fetch = fetchMock as never;
    mockParams = { key: DRAFT_KEY };
    await show(<PinPicker />);
    await fireEvent.changeText(await screen.findByTestId("pin-search"), "Senopati");
    await fireEvent.press(await screen.findByTestId("pin-suggestion-p1", {}, { timeout: 3000 }));
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.test/api/places");
    expect(await screen.findByText("Titik ini ada di Jakarta Selatan")).toBeTruthy();

    fetchMock.mockImplementationOnce(async () => ({ ok: false, json: async () => ({}) }) as never);
    await fireEvent.changeText(screen.getByTestId("pin-search"), "Kemang");
    expect(await screen.findByText("Pencarian belum bisa dipakai. Geser peta atau pakai lokasimu.", {}, { timeout: 3000 })).toBeTruthy();
  });
});
