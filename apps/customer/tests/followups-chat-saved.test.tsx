import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking, Text } from "react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ToastProvider } from "@catera/mobile-ui";
import { useSaved } from "../src/discover/saved";
import { useDayActions } from "../src/schedule/dayActions";
import { delivery } from "./fixtures";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("@catera/mobile-ui", () => ({
  ...jest.requireActual("@catera/mobile-ui"),
  useActionSheet: () => async () => "chat",
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
  forgetCachedCustomer: jest.fn(async () => undefined),
}));

function runtimeWith(api: Record<string, unknown>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-c1", role: "customer", name: "Rani" }, demo: false })),
    ...api,
  } as unknown as MobileRuntime["api"];
  return runtime;
}
const mount = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <ToastProvider>{ui}</ToastProvider>
    </MobileProvider>,
  );

describe("the day's … Chat", () => {
  function Probe() {
    const open = useDayActions(delivery("d-1", "2026-10-08", {}, { catererPhone: "081234567890" }));
    return (
      <Text accessibilityRole="button" onPress={() => void open()}>
        Buka
      </Text>
    );
  }

  it("says so when the phone cannot open WhatsApp", async () => {
    const open = jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no app"));
    await mount(runtimeWith({}), <Probe />);
    await fireEvent.press(await screen.findByText("Buka"));
    expect(await screen.findByText("WhatsApp belum bisa dibuka.")).toBeTruthy();
    expect(open).toHaveBeenCalledWith("https://wa.me/6281234567890?text=");
    open.mockRestore();
  });
});

describe("Disimpan: Lihat lebih banyak against a pull", () => {
  const item = (packageId: string) => ({ packageId, savedAt: "2026-10-01T00:00:00Z", summary: { name: packageId }, offer: null });
  let saved: ReturnType<typeof useSaved>;
  function Probe() {
    saved = useSaved("/disimpan");
    return <Text testID="ids">{saved.items.map((i) => i.packageId).join(",")}</Text>;
  }
  const ids = () => screen.getByTestId("ids").props.children;

  it("a page asked for before the reload does not land on the fresh list", async () => {
    let page: (value: unknown) => void = () => undefined;
    const savedPackages = jest.fn((cursor?: string) =>
      cursor
        ? new Promise((done) => (page = done))
        : Promise.resolve({ packageIds: ["fresh"], items: [item("fresh")], nextCursor: "c-2" }),
    );
    await mount(runtimeWith({ savedPackages }), <Probe />);
    await waitFor(() => expect(ids()).toBe("fresh"));
    await act(async () => {
      void saved.loadMore();
    });
    expect(savedPackages).toHaveBeenCalledWith("c-2");
    await act(async () => {
      await saved.reload();
    });
    await act(async () => page({ packageIds: ["old"], items: [item("old")], nextCursor: null }));
    expect(ids()).toBe("fresh");
    // The fresh read's cursor stays too, so the next page can still be read.
    expect(saved.hasMore).toBe(true);
  });

  it("a page with no reload in between still lands", async () => {
    const savedPackages = jest.fn(async (cursor?: string) =>
      cursor
        ? { packageIds: ["next"], items: [item("next")], nextCursor: null }
        : { packageIds: ["first", "next"], items: [item("first")], nextCursor: "c-2" },
    );
    await mount(runtimeWith({ savedPackages }), <Probe />);
    await waitFor(() => expect(ids()).toBe("first"));
    await act(async () => {
      await saved.loadMore();
    });
    expect(ids()).toBe("first,next");
    expect(saved.hasMore).toBe(false);
  });
});
