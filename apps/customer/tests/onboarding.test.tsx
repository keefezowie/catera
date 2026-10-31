import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { BackHandler, Linking, StyleSheet } from "react-native";
import * as ReactNative from "react-native";
import * as Reanimated from "react-native-reanimated";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { customerLink } from "../src/links";
import { finishOnboarding, isLinkLaunch, onboardingKey, onboardingNeeded, openedFromLink, useFirstRunGate } from "../src/onboarding/gate";
import { LAUK_KEY, readLaukPrefs, saveLaukPrefs, toggleLauk } from "../src/onboarding/prefs";
import { AreaPick, AreaStep, LaukStep, Mencari, MENCARI_MS, Welcome } from "../src/onboarding/Onboarding";
import { FoodBand } from "../src/onboarding/FoodBand";
import { AREA_KEY } from "../src/discover/area";

/** Whether the screen under test is the focused one: useFocusEffect runs only while it is. */
let mockFocused = true;
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = require("react");
    const focused = mockFocused;
    useEffect(() => (focused ? effect() : undefined), [effect, focused]);
  },
}));
const mockGoToTab = jest.fn();
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), goToTab: (...a: unknown[]) => mockGoToTab(...a) }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const hidden = { includeHiddenElements: true };
let runtime: MobileRuntime;

/** Every hardware-back listener registered, newest last; `pressBack` runs them newest first, as Android does. */
let backListeners: (() => boolean | null | undefined)[] = [];
const pressBack = () => {
  for (const fn of [...backListeners].reverse()) if (fn()) return true;
  return false;
};

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  mockFocused = true;
  backListeners = [];
  jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_: string, fn: () => boolean) => {
    backListeners.push(fn);
    return { remove: () => (backListeners = backListeners.filter((l) => l !== fn)) };
  }) as never);
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: null, demo: false })) } as unknown as MobileRuntime["api"];
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const renderWith = async (ui: React.ReactElement) => {
  const view = render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );
  await act(async () => {});
  return view;
};

describe("lauk prefs", () => {
  it("toggles, and refuses a fourth pick", () => {
    expect(toggleLauk([], "ayam")).toEqual(["ayam"]);
    expect(toggleLauk(["ayam"], "ayam")).toEqual([]);
    expect(toggleLauk(["ayam", "ikan", "sayur"], "pedas")).toEqual(["ayam", "ikan", "sayur"]);
  });

  it("round-trips through the phone and drops unknown or extra values", async () => {
    expect(await readLaukPrefs()).toEqual([]);
    await saveLaukPrefs(["pedas", "ayam"]);
    expect(await readLaukPrefs()).toEqual(["pedas", "ayam"]);
    store.set(LAUK_KEY, JSON.stringify(["ayam", "nasi", "ayam", "ikan", "sayur", "pedas"]));
    expect(await readLaukPrefs()).toEqual(["ayam", "ikan", "sayur"]);
    store.set(LAUK_KEY, "{not json");
    expect(await readLaukPrefs()).toEqual([]);
  });
});

describe("first-run gate", () => {
  it("is needed on a fresh install and never after it is finished", async () => {
    expect(await onboardingNeeded(runtime, null)).toBe(true);
    await finishOnboarding(runtime);
    expect(store.get(onboardingKey(runtime))).toBe("1");
    expect(await onboardingNeeded(runtime, null)).toBe(false);
  });

  it("is never shown to someone already signed in, and remembers that", async () => {
    expect(await onboardingNeeded(runtime, { id: "u1" } as never)).toBe(false);
    expect(await onboardingNeeded(runtime, null)).toBe(false);
  });

  it("waits when the app was opened from a link", async () => {
    jest.spyOn(Linking, "getInitialURL").mockResolvedValueOnce(null);
    expect(await openedFromLink()).toBe(false);
    jest.spyOn(Linking, "getInitialURL").mockResolvedValueOnce("catera://");
    expect(await openedFromLink()).toBe(false);
    jest.spyOn(Linking, "getInitialURL").mockResolvedValueOnce("catera://claim/abc");
    expect(await openedFromLink()).toBe(true);
  });

  it("treats a development build's launch URL and Expo Go's bare URL as plain launches", () => {
    expect(isLinkLaunch("exp+catera://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081")).toBe(false);
    expect(isLinkLaunch("exp://10.0.2.2:8081")).toBe(false);
    expect(isLinkLaunch("exp://10.0.2.2:8081/--/")).toBe(false);
    expect(isLinkLaunch("exp://10.0.2.2:8081/--/claim/abc")).toBe(true);
    expect(isLinkLaunch("catera:///auth/callback?code=x")).toBe(true);
  });

  function Gate({ ready }: { ready: boolean }) {
    useFirstRunGate({ ready, runtime, actor: null });
    return null;
  }

  it("the hook opens /mulai once ready on a fresh install, and never once it is done", async () => {
    jest.spyOn(Linking, "getInitialURL").mockResolvedValue(null);
    const view = render(<Gate ready={false} />);
    await act(async () => {});
    expect(router.push).not.toHaveBeenCalled();
    view.rerender(<Gate ready />);
    await act(async () => {});
    expect(router.push).toHaveBeenCalledWith("/mulai");
    view.rerender(<Gate ready />);
    await act(async () => {});
    expect(router.push).toHaveBeenCalledTimes(1);
    view.unmount();
    (router.push as jest.Mock).mockClear();
    await finishOnboarding(runtime);
    render(<Gate ready />);
    await act(async () => {});
    expect(router.push).not.toHaveBeenCalled();
  });

  it("the hook leaves a launch from a link alone", async () => {
    jest.spyOn(Linking, "getInitialURL").mockResolvedValue("catera://claim/abc");
    render(<Gate ready />);
    await act(async () => {});
    expect(router.push).not.toHaveBeenCalled();
    expect(store.get(onboardingKey(runtime))).toBeUndefined();
  });
});

describe("Android back inside onboarding", () => {
  it("on the welcome screen, back skips onboarding like Lewati", async () => {
    await renderWith(<Welcome />);
    expect(pressBack()).toBe(true);
    await act(async () => {});
    expect(store.get("catera.onboarding.done")).toBe("1");
    expect(mockGoToTab).toHaveBeenCalledWith("index");
  });

  it.each([
    ["area", () => <AreaStep />],
    ["lauk", () => <LaukStep />],
    ["area-pilih", () => <AreaPick />],
    ["mencari", () => <Mencari />],
  ])("on %s, back is left to the stack (one step back) and never skips", async (_, step) => {
    jest.useFakeTimers();
    // Welcome stays mounted under the step, but it is no longer focused.
    mockFocused = false;
    await renderWith(
      <>
        <Welcome />
        {step()}
      </>,
    );
    expect(pressBack()).toBe(false);
    await act(async () => {});
    expect(store.get("catera.onboarding.done")).toBeUndefined();
    expect(mockGoToTab).not.toHaveBeenCalled();
  });
});

describe("onboarding screens", () => {
  it("welcome: Cari katering opens the area step; Lewati marks it done and lands on Beranda", async () => {
    await renderWith(<Welcome />);
    expect(screen.getByRole("header", { name: "Masakan rumahan, diantar tiap hari" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Cari katering" }));
    expect(router.push).toHaveBeenCalledWith("/mulai/area");
    fireEvent.press(screen.getByRole("button", { name: "Lewati" }));
    await act(async () => {});
    expect(store.get("catera.onboarding.done")).toBe("1");
    expect(mockGoToTab).toHaveBeenCalledWith("index");
  });

  it("area: step 1 of 2; with no area it offers Pilih area, with one it shows it and continues", async () => {
    const view = await renderWith(<AreaStep />);
    expect(screen.getByTestId("step-bar").props.accessibilityLabel).toBe("Langkah 1 dari 2");
    fireEvent.press(screen.getByRole("button", { name: "Pilih area" }));
    expect(router.push).toHaveBeenCalledWith("/mulai/area-pilih");
    view.unmount();
    store.set(AREA_KEY, "Jakarta Selatan");
    await renderWith(<AreaStep />);
    expect(screen.getByTestId("area-chosen")).toHaveTextContent("Jakarta Selatan");
    fireEvent.press(screen.getByRole("button", { name: "Lanjut" }));
    expect(router.push).toHaveBeenCalledWith("/mulai/lauk");
  });

  it("lauk: step 2 of 2; three picks at most, kept on the phone, then the loader", async () => {
    await renderWith(<LaukStep />);
    expect(screen.getByTestId("step-bar").props.accessibilityLabel).toBe("Langkah 2 dari 2");
    // Nothing picked: the action waits, and no plate looks disabled.
    expect(screen.getByRole("button", { name: "Lanjut" })).toBeDisabled();
    const artOpacity = (pref: string) => StyleSheet.flatten(screen.getByTestId("lauk-" + pref + "-art", hidden).props.style).opacity;
    expect(artOpacity("ayam")).toBe(1);
    for (const name of ["Ayam", "Sayur", "Pedas", "Ikan"]) fireEvent.press(screen.getByRole("checkbox", { name }));
    expect(screen.getByRole("checkbox", { name: "Ikan" }).props.accessibilityState).toMatchObject({ checked: false, disabled: true });
    // The limit line sits in the pinned footer, above the action.
    expect(artOpacity("ikan")).toBe(0.45);
    expect(artOpacity("ayam")).toBe(1);
    expect(screen.getByTestId("lauk-full")).toBeTruthy();
    expect(within(screen.getByTestId("lauk-footer")).getByTestId("lauk-full")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Lanjut · 3 dipilih" }));
    await act(async () => {});
    expect(JSON.parse(store.get(LAUK_KEY)!)).toEqual(["ayam", "sayur", "pedas"]);
    expect(router.push).toHaveBeenCalledWith("/mulai/mencari");
    // The sorting promise only appears when Jelajah sorts (LAUK_SORTS_JELAJAH).
    expect(screen.getByText("Pilih sampai 3. Paket di Jelajah kami urutkan dari pilihanmu.")).toBeTruthy();
  });

  it("mencari: echoes the picks and the area, then marks done and opens Jelajah", async () => {
    jest.useFakeTimers();
    store.set(LAUK_KEY, JSON.stringify(["ayam", "sayur", "pedas"]));
    store.set(AREA_KEY, "Jakarta Selatan");
    await renderWith(<Mencari />);
    expect(screen.getByTestId("mencari-line")).toHaveTextContent("Ayam, sayur, pedas. Antar ke Jakarta Selatan.");
    expect(screen.getAllByTestId("polish-art", hidden)).toHaveLength(3);
    await act(async () => {
      jest.advanceTimersByTime(MENCARI_MS);
    });
    expect(store.get("catera.onboarding.done")).toBe("1");
    expect(mockGoToTab).toHaveBeenCalledWith("jelajah");
  });
});

describe("onboarding area sheet", () => {
  it("offers only the areas the catalog delivers to", async () => {
    runtime.api = {
      ...runtime.api,
      catalog: jest.fn(async () => ({ items: [{ areas: ["Jakarta Selatan"] }, { areas: ["Bandung", "Jakarta Selatan"] }] })),
    } as unknown as MobileRuntime["api"];
    await renderWith(<AreaPick />);
    expect(screen.getAllByRole("radio").map((r) => r.props.accessibilityLabel)).toEqual(["Jakarta Selatan", "Bandung"]);
  });

  it("offers every area when the catalog cannot be read", async () => {
    runtime.api = {
      ...runtime.api,
      catalog: jest.fn(async () => {
        throw new Error("offline");
      }),
    } as unknown as MobileRuntime["api"];
    await renderWith(<AreaPick />);
    expect(screen.getAllByRole("radio")).toHaveLength(7);
  });
});

describe("Masuk food band", () => {
  it("draws five decorative tokens, hidden from a screen reader", async () => {
    const view = await renderWith(<FoodBand />);
    fireEvent(screen.getByTestId("food-band", hidden), "layout", { nativeEvent: { layout: { width: 350, height: 0 } } });
    expect(screen.getAllByTestId("polish-art", hidden)).toHaveLength(5);
    expect(screen.queryAllByTestId("polish-art")).toHaveLength(0);
    view.unmount();
  });
});
