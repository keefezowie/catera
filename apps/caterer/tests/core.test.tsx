import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import {
  createMobileRuntime,
  MobileProvider,
  useData,
  useMobile,
  type MobileRuntime,
} from "@catera/mobile-core";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock("expo-notifications", () => {
  const responders: ((r: unknown) => void)[] = [];
  return {
    __responders: responders,
    setNotificationHandler: jest.fn(),
    addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    addNotificationResponseReceivedListener: jest.fn((fn: (r: unknown) => void) => {
      responders.push(fn);
      return { remove: jest.fn() };
    }),
    getLastNotificationResponseAsync: jest.fn(async () => null),
    clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  };
});

const owner = { id: "u-owner", role: "owner", name: "Bu Rina", catererId: "k-1" };

function fakeRuntime(overrides: Partial<MobileRuntime["api"]> = {}): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "test" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: owner, demo: true })),
    command: jest.fn(async () => ({ ok: true })),
    ...overrides,
  } as MobileRuntime["api"];
  return runtime;
}

function Probe({ loader }: { loader: () => Promise<string> }) {
  const { t, command } = useMobile();
  const { data } = useData("probe", loader);
  return (
    <>
      <Text>{t("Halo", "Hello")}</Text>
      <Text testID="data">{data ?? "-"}</Text>
      <Text testID="run" onPress={() => void command("noop", {})}>
        run
      </Text>
    </>
  );
}

beforeEach(() => {
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  jest.clearAllMocks();
});

it("speaks Indonesian by default", async () => {
  render(
    <MobileProvider runtime={fakeRuntime()} linkMapper={(h) => h}>
      <Probe loader={async () => "x"} />
    </MobileProvider>,
  );
  expect(await screen.findByText("Halo")).toBeTruthy();
});

it("reloads data after a successful command", async () => {
  const loader = jest.fn(async () => "loaded");
  render(
    <MobileProvider runtime={fakeRuntime()} linkMapper={(h) => h}>
      <Probe loader={loader} />
    </MobileProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("data").props.children).toBe("loaded"));
  const before = loader.mock.calls.length;
  await act(async () => {
    screen.getByTestId("run").props.onPress();
  });
  await waitFor(() => expect(loader.mock.calls.length).toBeGreaterThan(before));
});

it("sends the demo token before any Supabase session", async () => {
  await SecureStore.setItemAsync("test.demo.token", "demo-123");
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "test" });
  expect(await runtime.token()).toBe("demo-123");
});

it("routes notification taps through the app's link mapper", async () => {
  render(
    <MobileProvider runtime={fakeRuntime()} linkMapper={(h) => h.replace("/seller/schedule", "/")}>
      <Probe loader={async () => "x"} />
    </MobileProvider>,
  );
  await screen.findByText("Halo");
  const responders = (Notifications as unknown as { __responders: ((r: unknown) => void)[] })
    .__responders;
  act(() => {
    responders[responders.length - 1]({
      actionIdentifier: "default",
      notification: { request: { identifier: "n1", content: { data: { href: "/seller/schedule?date=2026-10-08" } } } },
    });
  });
  expect(router.push).toHaveBeenCalledWith("/?date=2026-10-08");
});

it("hands notification taps to the app's link opener when it has one", async () => {
  const openLink = jest.fn();
  render(
    <MobileProvider runtime={fakeRuntime()} linkMapper={(h) => h.replace("/seller/customers", "/pelanggan")} openLink={openLink}>
      <Probe loader={async () => "x"} />
    </MobileProvider>,
  );
  await screen.findByText("Halo");
  const responders = (Notifications as unknown as { __responders: ((r: unknown) => void)[] }).__responders;
  act(() => {
    responders[responders.length - 1]({
      actionIdentifier: "default",
      notification: { request: { identifier: "n2", content: { data: { href: "/seller/customers" } } } },
    });
  });
  // A tab root: the app selects the tab instead of the provider pushing a second copy of it.
  expect(openLink).toHaveBeenCalledWith("/pelanggan");
  expect(router.push).not.toHaveBeenCalled();
});
