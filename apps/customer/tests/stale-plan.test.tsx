import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { bannerTime } from "@catera/mobile-ui";
import { PlanDetailScreen } from "../src/plan/PlanDetail";
import { customerLink } from "../src/links";
import * as offline from "../src/today/offline";
import { customerState, TODAY } from "./fixtures";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => ({ id: "s-1" }),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
  forgetCachedCustomer: jest.fn(async () => undefined),
}));

it("Coba lagi on the plan's stale copy keeps the line and busies the button, as on Beranda", async () => {
  const savedAt = `${TODAY}T03:12:00.000Z`;
  (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({ savedAt, data: customerState(null) });
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-c1", role: "customer", name: "Rani" }, demo: false })),
    customer: jest.fn(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    }),
  } as unknown as MobileRuntime["api"];
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <PlanDetailScreen />
    </MobileProvider>,
  );
  const line = `Belum bisa memperbarui. Menampilkan data terakhir, ${bannerTime(new Date(savedAt))}.`;
  await screen.findByText(line);
  let settle = () => {};
  (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise((_, reject) => (settle = () => reject(new Error("REQUEST_TIMEOUT")))));
  const retry = () => within(screen.getByTestId("stale-copy")).getByRole("button", { name: "Coba lagi" });
  fireEvent.press(retry());
  await waitFor(() => expect(retry().props.accessibilityState.busy).toBe(true));
  expect(screen.getByText(line)).toBeTruthy();
  await act(async () => settle());
  expect(await screen.findByText(line)).toBeTruthy();
});
