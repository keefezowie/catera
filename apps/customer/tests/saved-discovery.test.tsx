import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import {
  View,
  Text,
  PanResponder,
  FlatList,
  AccessibilityInfo,
  type PanResponderCallbacks,
} from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  NativeSavedProvider,
  NativeSaveButton,
  NativeSavedIntent,
  useNativeSaved,
} from "../src/saved";
import { NativePackagePager } from "../src/discovery";
import { nativeApi } from "../src/context";
import type { Offer } from "@catera/domain";
const mockNative: any = {
  actor: { id: "owner-a", role: "customer", name: "Synthetic" },
  revision: 0,
  offers: [],
  area: "",
  compare: [],
  locale: "en",
  ready: true,
  refresh: jest.fn(),
  toggleCompare: jest.fn(),
  t: (_: string, en: string) => en,
};
const mockApi = nativeApi as unknown as {
  savedPackages: jest.Mock;
  command: jest.Mock;
  request: jest.Mock;
};
const mockParams: Record<string, string> = {};
jest.mock("../src/context", () => ({
  useNative: () => mockNative,
  nativeApi: {
    savedPackages: jest.fn(),
    command: jest.fn(),
    request: jest.fn(),
  },
  apiBase: "http://127.0.0.1:3268",
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "00000000-0000-4000-8000-000000000077",
}));
jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
const empty = { packageIds: [], items: [], nextCursor: null };
function Probe() {
  const saved = useNativeSaved();
  return <Text testID="membership">{saved.packageIds.join(",")}</Text>;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockNative.actor = { id: "owner-a", role: "customer", name: "Synthetic" };
  Object.keys(mockParams).forEach((key) => delete mockParams[key]);
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  mockApi.savedPackages.mockResolvedValue(empty);
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());
test("native save confirms the server result and retries failed writes with the same key", async () => {
  let finish!: (value: unknown) => void;
  mockApi.command.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const screen = render(
    <NativeSavedProvider>
      <NativeSaveButton packageId="package-1" name="Lunch" />
      <Probe />
    </NativeSavedProvider>,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save package: Lunch" }).props
        .accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByRole("button", { name: "Save package: Lunch" }));
  expect(
    screen.getByRole("button", { name: "Save package: Lunch" }).props
      .accessibilityState.selected,
  ).toBe(false);
  mockApi.savedPackages.mockResolvedValue({
    ...empty,
    packageIds: ["package-1"],
  });
  await act(async () => finish({ packageId: "package-1", saved: true }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Remove from Saved: Lunch" }).props
        .accessibilityState.selected,
    ).toBe(true),
  );
  mockApi.command.mockRejectedValueOnce(new Error("REQUEST_FAILED"));
  fireEvent.press(
    screen.getByRole("button", { name: "Remove from Saved: Lunch" }),
  );
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByTestId("membership").props.children).toBe("package-1");
  mockApi.command.mockResolvedValueOnce({
    packageId: "package-1",
    saved: false,
  });
  mockApi.savedPackages.mockResolvedValue(empty);
  fireEvent.press(
    screen.getByRole("button", { name: "Remove from Saved: Lunch" }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("membership").props.children).toBe(""),
  );
  expect(mockApi.command.mock.calls[1][2]).toBe(
    mockApi.command.mock.calls[2][2],
  );
});
test("native guest saving retains a filtered return path and does not write before login", async () => {
  mockNative.actor = null;
  const screen = render(
    <NativeSavedProvider>
      <NativeSaveButton
        packageId="package-1"
        name="Lunch"
        returnPath="/discover?view=swipe&meal=lunch&card=package-1"
      />
    </NativeSavedProvider>,
  );
  fireEvent.press(screen.getByRole("button", { name: "Save package: Lunch" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  const target = (router.push as jest.Mock).mock.calls[0][0];
  expect(target.pathname).toBe("/login");
  expect(target.params.next).toContain("meal=lunch");
  expect(target.params.next).toContain("card=package-1");
  expect(target.params.next).toContain("saveIntent=");
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    "catera.save-intent",
    expect.stringContaining("package-1"),
  );
  expect(mockApi.command).not.toHaveBeenCalled();
});
test("native owner change masks previous membership and rejects late reads", async () => {
  let old!: (value: unknown) => void;
  mockApi.savedPackages.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        old = resolve;
      }),
  );
  const screen = render(
    <NativeSavedProvider>
      <Probe />
    </NativeSavedProvider>,
  );
  await waitFor(() => expect(mockApi.savedPackages).toHaveBeenCalledTimes(1));
  mockNative.actor = { id: "owner-b", role: "customer", name: "Other" };
  screen.rerender(
    <NativeSavedProvider>
      <Probe />
    </NativeSavedProvider>,
  );
  expect(screen.getByTestId("membership").props.children).toBe("");
  await act(async () => old({ ...empty, packageIds: ["private-to-owner-a"] }));
  await waitFor(() => expect(mockApi.savedPackages).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("membership").props.children).toBe("");
});
test("native login return resumes once and retries the same intent after a failed save", async () => {
  const nonce = "00000000-0000-4000-8000-000000000088";
  mockParams.saveIntent = nonce;
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
    JSON.stringify({ packageId: "package-1", nonce, createdAt: Date.now() }),
  );
  mockApi.command.mockRejectedValueOnce(new Error("REQUEST_FAILED"));
  const screen = render(
    <NativeSavedProvider>
      <NativeSavedIntent />
      <Probe />
    </NativeSavedProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Retry saving" })).toBeTruthy(),
  );
  expect(mockApi.command).toHaveBeenCalledTimes(1);
  mockApi.command.mockResolvedValueOnce({
    packageId: "package-1",
    saved: true,
  });
  mockApi.savedPackages.mockResolvedValue({
    ...empty,
    packageIds: ["package-1"],
  });
  fireEvent.press(screen.getByRole("button", { name: "Retry saving" }));
  await waitFor(() =>
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "catera.save-intent",
    ),
  );
  expect(mockApi.command.mock.calls.map((call) => call[2])).toEqual([
    nonce,
    nonce,
  ]);
  screen.rerender(
    <NativeSavedProvider>
      <NativeSavedIntent />
      <Probe />
    </NativeSavedProvider>,
  );
  await act(async () => {});
  expect(mockApi.command).toHaveBeenCalledTimes(2);
});
test("native pager prevents fast flick skipping, cancels short drags and offers buttons", async () => {
  let handlers!: PanResponderCallbacks;
  const create = PanResponder.create;
  jest.spyOn(PanResponder, "create").mockImplementation((config) => {
    handlers = config;
    return create(config);
  });
  jest.spyOn(FlatList.prototype, "scrollToIndex").mockImplementation(() => {});
  const offers = Array.from(
    { length: 3 },
    (_, index) =>
      ({
        id: "package-" + index,
        name: "Lunch " + index,
        image: "",
        caterer: "Synthetic",
        days: index === 2 ? 10 : 5,
        price: index === 2 ? 65000 : 35000,
        meal: index === 2 ? "both" : "lunch",
        flexible: true,
        areas: [],
        menus: [],
        tags: [],
        tiers: [],
      }) as unknown as Offer,
  );
  const selected = jest.fn(),
    cannotFit = jest.fn();
  const screen = render(
    <NativePackagePager
      offers={offers}
      activeId=""
      onSelect={selected}
      onCannotFit={cannotFit}
      returnPath={(id) => "/discover?card=" + id}
    />,
  );
  fireEvent(screen.getByTestId("native-discovery-viewport"), "layout", {
    nativeEvent: { layout: { height: 500 } },
  });
  await act(async () => {});
  await act(async () => {
    handlers.onPanResponderGrant?.({} as never, {} as never);
    handlers.onPanResponderRelease?.(
      {} as never,
      { dy: -1000, vy: -3 } as never,
    );
  });
  expect(selected).toHaveBeenLastCalledWith("package-1");
  await act(async () => {
    handlers.onPanResponderGrant?.({} as never, {} as never);
    handlers.onPanResponderRelease?.({} as never, { dy: 8, vy: 1 } as never);
  });
  expect(selected).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(selected).toHaveBeenLastCalledWith("package-2");
  expect(
    screen.getByRole("button", { name: "Next" }).props.accessibilityState
      .disabled,
  ).toBe(true);
});
