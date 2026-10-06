import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
const mockFetch = jest.fn();
const mockSession = jest.fn();
let mockAuthChange: (event: string) => void;
jest.mock("react-native-url-polyfill/auto", () => ({}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getSession: () => mockSession(),
      onAuthStateChange: (callback: (event: string) => void) => {
        mockAuthChange = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
  }),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: () => ({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: () => ({ remove: jest.fn() }),
  getLastNotificationResponseAsync: async () => null,
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, []),
}));
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../src/mascot-loading", () => ({
  MascotLoading: ({ label }: { label: string }) => {
    const { Text } = require("react-native");
    return <Text>{label}</Text>;
  },
}));
process.env.EXPO_PUBLIC_API_URL = "https://catera.example";
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://auth.example";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
const { NativeProvider } =
  require("../src/context") as typeof import("../src/context");
const { Gate } = require("../src/ui") as typeof import("../src/ui");
const originalFetch = global.fetch;
beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = mockFetch;
  mockFetch.mockReset();
  mockSession.mockReset().mockResolvedValue({ data: { session: null } });
});
afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
});
function healthyBackend() {
  mockSession.mockResolvedValue({ data: { session: null } });
  mockFetch.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => ({
      data: url.includes("/catalog")
        ? { items: [], nextCursor: null }
        : { actor: null, demo: false },
    }),
  }));
}

test.each(["network", "saved session"])(
  "a stalled %s leaves startup after 15 seconds and the visible retry recovers",
  async (blocked) => {
    if (blocked === "network")
      mockFetch.mockImplementation(() => new Promise(() => {}));
    else mockSession.mockImplementation(() => new Promise(() => {}));
    const screen = render(
      <NativeProvider>
        <Gate>{null}</Gate>
      </NativeProvider>,
    );
    expect(screen.getByText("Menyiapkan Catera untuk Anda…")).toBeTruthy();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });
    expect(screen.queryByText("Menyiapkan Catera untuk Anda…")).toBeNull();
    expect(
      screen.getByText("Koneksi terlalu lama. Periksa koneksi dan coba lagi."),
    ).toBeTruthy();
    healthyBackend();
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    });
    expect(screen.getByRole("button", { name: "Masuk / Daftar" })).toBeTruthy();
  },
);

test("a tunnel HTML page becomes a recoverable connection error", async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    json: async () => {
      throw new SyntaxError("Unexpected <");
    },
  });
  const screen = render(
    <NativeProvider>
      <Gate>{null}</Gate>
    </NativeProvider>,
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(screen.queryByText("Menyiapkan Catera untuk Anda…")).toBeNull();
  expect(
    screen.getByText("Catera sementara tidak tersedia. Silakan coba lagi."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
});

test("an expired session that signs out during startup refreshes the guest state", async () => {
  mockSession.mockImplementation(() => new Promise(() => {}));
  const screen = render(
    <NativeProvider>
      <Gate>{null}</Gate>
    </NativeProvider>,
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  healthyBackend();
  await act(async () => {
    mockAuthChange("SIGNED_OUT");
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(screen.queryByText("Menyiapkan Catera untuk Anda…")).toBeNull();
  expect(screen.getByRole("button", { name: "Masuk / Daftar" })).toBeTruthy();
});
