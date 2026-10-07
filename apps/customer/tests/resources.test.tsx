import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, useData, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { customerLink } from "../src/links";

// Ported from the old provider's resource tests: the same guarantees now come from
// MobileProvider + useData (@catera/mobile-core), which every customer screen reads through.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: () => ({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: () => ({ remove: jest.fn() }),
  getLastNotificationResponseAsync: async () => null,
  clearLastNotificationResponseAsync: async () => undefined,
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

const mockMe = jest.fn();
let runtime: MobileRuntime;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MobileProvider runtime={runtime} linkMapper={customerLink}>
    {children}
  </MobileProvider>
);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => (resolve = yes));
  return { promise, resolve };
}
beforeEach(() => {
  mockMe.mockReset().mockResolvedValue({ actor: { id: "customer-a", role: "customer", name: "A" }, demo: true });
  runtime = createMobileRuntime({ apiUrl: "http://localhost", storagePrefix: "catera" });
  runtime.api = { ...runtime.api, me: () => mockMe(), command: jest.fn() } as unknown as MobileRuntime["api"];
  runtime.signOut = jest.fn(async () => undefined);
});

test("resource-key changes hide previous data and ignore late responses", async () => {
  const a = deferred<string>(),
    b = deferred<string>();
  const hook = renderHook(
    ({ resourceKey }: { resourceKey: string }) => ({
      resource: useData(resourceKey, () => (resourceKey === "a" ? a.promise : b.promise)),
      app: useMobile(),
    }),
    { wrapper, initialProps: { resourceKey: "a" } },
  );
  await waitFor(() => expect(hook.result.current.app.actor?.id).toBe("customer-a"));
  hook.rerender({ resourceKey: "b" });
  expect(hook.result.current.resource.data).toBeNull();
  await act(async () => {
    a.resolve("private A");
    b.resolve("private B");
  });
  await waitFor(() => expect(hook.result.current.resource.data).toBe("private B"));
});

test("same-resource refresh failures retain readable data and mark it stale", async () => {
  const loader = jest.fn(async () => "saved data");
  const hook = renderHook(() => useData("same", loader), { wrapper });
  await waitFor(() => expect(hook.result.current.data).toBe("saved data"));
  loader.mockRejectedValue(new Error("offline"));
  await act(async () => {
    await hook.result.current.reload();
  });
  expect(hook.result.current.data).toBe("saved data");
  expect(hook.result.current.stale).toBe(true);
});

test("switching accounts cannot display the previous account's resource", async () => {
  const b = deferred<string>();
  const hook = renderHook(
    () => {
      const app = useMobile();
      return {
        app,
        resource: useData("private", () => (app.actor?.id === "customer-b" ? b.promise : Promise.resolve("private A"))),
      };
    },
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.resource.data).toBe("private A"));
  mockMe.mockResolvedValue({ actor: { id: "customer-b", role: "customer", name: "B" }, demo: true });
  await act(async () => {
    await hook.result.current.app.refresh();
  });
  expect(hook.result.current.resource.data).toBeNull();
  await act(async () => {
    b.resolve("private B");
  });
  expect(hook.result.current.resource.data).toBe("private B");
});

test("a slow refresh cannot restore the account after sign-out", async () => {
  const late = deferred<{ actor: { id: string; role: string; name: string }; demo: boolean }>();
  const hook = renderHook(() => useMobile(), { wrapper });
  await waitFor(() => expect(hook.result.current.actor?.id).toBe("customer-a"));
  mockMe.mockImplementationOnce(() => late.promise);
  let refresh!: Promise<void>;
  act(() => {
    refresh = hook.result.current.refresh();
  });
  await act(async () => {
    await hook.result.current.logout();
  });
  await act(async () => {
    late.resolve({ actor: { id: "customer-a", role: "customer", name: "A" }, demo: true });
    await refresh;
  });
  expect(hook.result.current.actor).toBeNull();
});
