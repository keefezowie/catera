import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
jest.mock("react-native-url-polyfill/auto", () => ({}));
const mockCatalog = jest.fn(async () => ({ items: [] }));
const mockMe = jest.fn(async () => ({
  actor: { id: "customer-a", role: "customer", name: "A" },
  demo: true,
}));
jest.mock("@catera/api-client", () => ({
  createApi: () => ({
    catalog: () => mockCatalog(),
    me: () => mockMe(),
    command: jest.fn(),
  }),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: () => ({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: () => ({ remove: jest.fn() }),
  getLastNotificationResponseAsync: async () => null,
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));
process.env.EXPO_PUBLIC_API_URL = "http://localhost";
const { NativeProvider, useData, useNative } =
  require("../src/context") as typeof import("../src/context");
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NativeProvider>{children}</NativeProvider>
);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  mockMe.mockResolvedValue({
    actor: { id: "customer-a", role: "customer", name: "A" },
    demo: true,
  });
});
test("resource-key changes hide previous data and ignore late responses", async () => {
  const a = deferred<string>(),
    b = deferred<string>();
  const hook = renderHook(
    ({ resourceKey }: { resourceKey: string }) => ({
      resource: useData(resourceKey, () =>
        resourceKey === "a" ? a.promise : b.promise,
      ),
      app: useNative(),
    }),
    { wrapper, initialProps: { resourceKey: "a" } },
  );
  await waitFor(() =>
    expect(hook.result.current.app.actor?.id).toBe("customer-a"),
  );
  hook.rerender({ resourceKey: "b" });
  expect(hook.result.current.resource.data).toBeNull();
  await act(async () => {
    a.resolve("private A");
    b.resolve("private B");
  });
  await waitFor(() =>
    expect(hook.result.current.resource.data).toBe("private B"),
  );
});
test("same-resource refresh failures retain readable data and disable writes", async () => {
  const loader = jest.fn(async () => "saved data");
  const hook = renderHook(() => useData("same", loader), { wrapper });
  await waitFor(() => expect(hook.result.current.canWrite).toBe(true));
  loader.mockRejectedValue(new Error("offline"));
  await act(async () => {
    await hook.result.current.reload();
  });
  expect(hook.result.current.data).toBe("saved data");
  expect(hook.result.current.stale).toBe(true);
  expect(hook.result.current.canWrite).toBe(false);
});
test("switching authenticated owners cannot display the previous owner's resource", async () => {
  const b = deferred<string>();
  const hook = renderHook(
    () => {
      const app = useNative();
      return {
        app,
        resource: useData("private", () =>
          app.actor?.id === "customer-b"
            ? b.promise
            : Promise.resolve("private A"),
        ),
      };
    },
    { wrapper },
  );
  await waitFor(() =>
    expect(hook.result.current.app.actor?.id).toBe("customer-a"),
  );
  await waitFor(() =>
    expect(hook.result.current.resource.data).toBe("private A"),
  );
  mockMe.mockResolvedValue({
    actor: { id: "customer-b", role: "customer", name: "B" },
    demo: true,
  });
  await act(async () => {
    await hook.result.current.app.refresh();
  });
  expect(hook.result.current.resource.data).toBeNull();
  expect(hook.result.current.resource.canWrite).toBe(false);
  await act(async () => {
    b.resolve("private B");
  });
  expect(hook.result.current.resource.data).toBe("private B");
});
test("a slow authenticated refresh cannot restore the actor after sign-out", async () => {
  const late = deferred<{
    actor: { id: string; role: string; name: string };
    demo: boolean;
  }>();
  const hook = renderHook(() => useNative(), { wrapper });
  await waitFor(() => expect(hook.result.current.actor?.id).toBe("customer-a"));
  mockMe.mockImplementationOnce(() => late.promise);
  let refresh: Promise<void>;
  act(() => {
    refresh = hook.result.current.refresh();
  });
  await act(async () => {
    await hook.result.current.logout();
  });
  await act(async () => {
    late.resolve({
      actor: { id: "customer-a", role: "customer", name: "A" },
      demo: true,
    });
    await refresh;
  });
  expect(hook.result.current.actor).toBeNull();
});
