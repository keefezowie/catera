import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

// Expo Go on Android (SDK 53+) throws as soon as expo-notifications is loaded.
jest.mock("expo-notifications", () => {
  throw new Error("expo-notifications: Android Push notifications … was removed from Expo Go");
});
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "storeClient", expoConfig: { extra: {} } },
  ExecutionEnvironment: { Bare: "bare", Standalone: "standalone", StoreClient: "storeClient" },
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

import { createMobileRuntime, MobileProvider, pushAvailable, useMobile } from "@catera/mobile-core";

function Probe() {
  const { ready, enablePush } = useMobile();
  return (
    <>
      <Text>{ready ? "siap" : "memuat"}</Text>
      <Text onPress={() => void enablePush("x").catch((e: Error) => console.log(e.message))}>push</Text>
    </>
  );
}

it("starts inside Expo Go without push notifications", async () => {
  expect(pushAvailable).toBe(false);
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: null, demo: true })) } as typeof runtime.api;
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      <Probe />
    </MobileProvider>,
  );
  await waitFor(() => expect(screen.getByText("siap")).toBeTruthy());
});

it("explains that push needs the installed app", async () => {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: null, demo: true })) } as typeof runtime.api;
  let enable: ((c: string) => Promise<void>) | undefined;
  function Grab() {
    enable = useMobile().enablePush;
    return null;
  }
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      <Grab />
    </MobileProvider>,
  );
  await waitFor(() => expect(enable).toBeDefined());
  await expect(enable!("x")).rejects.toThrow("Notifikasi hanya tersedia di aplikasi yang dipasang.");
});
