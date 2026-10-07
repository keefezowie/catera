import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { Masuk } from "../src/auth/Masuk";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

const store = (jest.requireMock("expo-secure-store") as { __store: Map<string, string> }).__store;
const owner = { id: "u-owner", role: "owner", name: "Bu Rina", catererId: "k-1" };

function runtimeWith(me: () => Promise<unknown>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "off" });
  runtime.api = { ...runtime.api, me: jest.fn(me) } as unknown as MobileRuntime["api"];
  return runtime;
}
function Probe() {
  const { actor, ready } = useMobile();
  return <Text>{ready ? `actor:${actor?.id ?? "none"}` : "loading"}</Text>;
}
const offline = () => Promise.reject(Object.assign(new Error("Network request failed"), { code: "NETWORK" }));

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

it("remembers the signed-in kitchen and reopens it without signal", async () => {
  const first = render(
    <MobileProvider runtime={runtimeWith(async () => ({ actor: owner, demo: true }))} linkMapper={(h) => h}>
      <Probe />
    </MobileProvider>,
  );
  expect(await screen.findByText("actor:u-owner")).toBeTruthy();
  first.unmount();
  store.set("off.demo.token", "demo-token");
  render(
    <MobileProvider runtime={runtimeWith(offline)} linkMapper={(h) => h}>
      <Probe />
    </MobileProvider>,
  );
  expect(await screen.findByText("actor:u-owner")).toBeTruthy();
});

it("does not reopen a kitchen after the session is gone", async () => {
  store.set("off.actor", JSON.stringify(owner));
  render(
    <MobileProvider runtime={runtimeWith(offline)} linkMapper={(h) => h}>
      <Probe />
    </MobileProvider>,
  );
  expect(await screen.findByText("actor:none")).toBeTruthy();
});

it("leaves the sign-in screen once the kitchen is known", async () => {
  render(
    <MobileProvider runtime={runtimeWith(async () => ({ actor: owner, demo: false }))} linkMapper={(h) => h}>
      <Masuk />
    </MobileProvider>,
  );
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
});
