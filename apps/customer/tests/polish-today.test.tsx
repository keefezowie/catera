import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { ToastProvider } from "@catera/mobile-ui";
import { router } from "expo-router";
import { PushPrimerRoute, PushPrimerTrigger, PUSH_PRIMER_HREF } from "../src/buy/PushPrimer";
import { hasPraise, praiseIn, PRAISE, withPraise } from "../src/today/praise";
import { dayArt } from "../src/today/UpcomingDays";
import { SelamatMakanCard } from "../src/today/SelamatMakan";
import { markReview } from "../src/today/reviewMark";

// The session is a stand-in: the screens here read only t, the storage keys, the actor and enablePush.
const mockEnablePush = jest.fn(async () => undefined);
jest.mock("../../../packages/mobile-core/src/provider", () => ({
  ...jest.requireActual("../../../packages/mobile-core/src/provider"),
  useMobile: () => ({
    t: (id: string) => id,
    locale: "id",
    actor: { id: "u-c1", role: "customer", name: "Rani Contoh" },
    runtime: { storageKey: (k: string) => `catera.${k}` },
    enablePush: mockEnablePush,
  }),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined", canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[synthetic-phone]" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "2.4.1", extra: { eas: { projectId: "synthetic-project" } } } },
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

const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;
const permissions = Notifications.getPermissionsAsync as jest.Mock;
const request = Notifications.requestPermissionsAsync as jest.Mock;

const wrapPrimer = (ui: React.ReactElement) => render(<ToastProvider os="android">{ui}</ToastProvider>);
/** Lets the session read, the actor and the primer's phone reads all answer. */
const settle = async () => {
  for (let i = 0; i < 8; i += 1) await act(async () => {});
};

beforeEach(() => {
  jest.clearAllMocks();
  store().clear();
  permissions.mockResolvedValue({ status: "undetermined", canAskAgain: true });
});

describe("the push primer", () => {
  it("stays away when not eligible, or when the phone already answered", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
    try {
      for (const [eligible, permission] of [
        [false, { status: "undetermined", canAskAgain: true }],
        [true, { status: "granted" }],
        [true, { status: "denied", canAskAgain: false }],
      ] as const) {
        permissions.mockResolvedValue(permission);
        wrapPrimer(<PushPrimerTrigger eligible={eligible} />);
        await settle();
        await act(async () => void jest.advanceTimersByTime(1000));
        screen.unmount();
      }
      expect(router.push).not.toHaveBeenCalled();
      expect(store().has("catera.push.primer")).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it("opens once as a native sheet after the first paid plan when the phone was never asked", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
    try {
      wrapPrimer(<PushPrimerTrigger eligible />);
      await waitFor(() => expect(store().get("catera.push.primer")).toBe("shown"));
      // The paid moment settles first; then the sheet route opens.
      expect(router.push).not.toHaveBeenCalled();
      await act(async () => void jest.advanceTimersByTime(1000));
      expect(router.push).toHaveBeenCalledWith(PUSH_PRIMER_HREF);
      // The phone remembers it: a second paid moment opens nothing.
      (router.push as jest.Mock).mockClear();
      store().set("catera.push.primer", "shown");
      wrapPrimer(<PushPrimerTrigger eligible />);
      await settle();
      await act(async () => void jest.advanceTimersByTime(1000));
      expect(router.push).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("the sheet says cooking, on the way and arrived, never promos; Nanti saja closes it without asking the phone", async () => {
    wrapPrimer(<PushPrimerRoute />);
    await settle();
    expect(screen.getByRole("header", { name: "Tahu kapan makananmu jalan" })).toBeTruthy();
    expect(screen.getByText(/dimasak, diantar dan sampai/)).toBeTruthy();
    expect(screen.queryByText(/promo/i)).toBeNull();
    // It scrolls when a large font outgrows the fit sheet.
    expect(screen.getByTestId("sheet-fit-body")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Nanti saja" }));
    expect(router.back).toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("Nyalakan notifikasi closes the sheet, asks the phone and registers it as Pengaturan's switch does", async () => {
    wrapPrimer(<PushPrimerRoute />);
    await settle();
    fireEvent.press(screen.getByRole("button", { name: "Nyalakan notifikasi" }));
    await settle();
    expect(router.back).toHaveBeenCalled();
    expect(request).toHaveBeenCalled();
    expect(mockEnablePush).toHaveBeenCalledWith("Pengantaran & bantuan");
    expect(store().get("catera.push.u-c1")).toBe("on");
  });
});

describe("quick praise in the review", () => {
  it("a chip adds its phrase to the words and takes it out again", () => {
    expect(withPraise("", "Masih hangat")).toBe("Masih hangat.");
    expect(withPraise("Sambalnya pas.", "Porsi pas")).toBe("Sambalnya pas. Porsi pas.");
    expect(hasPraise("Sambalnya pas. Porsi pas.", "Porsi pas")).toBe(true);
    expect(withPraise("Sambalnya pas. Porsi pas. Masih hangat.", "Porsi pas")).toBe("Sambalnya pas. Masih hangat.");
    expect(hasPraise("Porsi pas sekali", "Porsi pas")).toBe(false);
  });

  it("reads a phrase in any case, with or without its full stop, and never adds it twice", () => {
    expect(hasPraise("porsi pas, nasinya hangat", "Porsi pas")).toBe(true);
    expect(hasPraise("Enak. masih hangat", "Masih hangat")).toBe(true);
    expect(withPraise("Enak. masih hangat", "Masih hangat")).toBe("Enak.");
    expect(praiseIn("Still warm. Porsi pas.")).toEqual(["Masih hangat", "Porsi pas"]);
    expect(PRAISE.find((p) => p.id === "Tepat waktu")?.art).toBe("spot-rantang-sampai");
  });

  it("never pushes the words past 1000 characters", () => {
    const full = "a".repeat(995);
    expect(withPraise(full, "Masih hangat")).toBeNull();
    expect(withPraise("a".repeat(980), "Porsi pas")).toHaveLength(991);
  });
});

describe("Berikutnya pictures", () => {
  it("a day with no dish photo gets the picture for why", () => {
    expect(dayArt({ lead: null, pickable: true })).toBe("spot-plate-empty-pencil");
    expect(dayArt({ lead: null, pickable: false })).toBe("spot-rantang-clock");
    expect(dayArt({ lead: "Ayam panggang", pickable: false })).toBe("spot-rantang-open");
  });
});

describe("the art track on the hero", () => {
  const { MoodProvider, RantangTrack, ThemeProvider } = jest.requireActual("@catera/mobile-ui") as typeof import("@catera/mobile-ui");
  const wrapTrack = (stage: "preparing" | "issue", caption?: string) =>
    render(
      <ThemeProvider storageKey="polish-track">
        <MoodProvider now={() => new Date("2026-10-09T03:00:00Z")}>
          <RantangTrack size="art" stage={stage} caption={caption} />
        </MoodProvider>
      </ThemeProvider>,
    );

  it("draws each stop as its picture, under a headline over the caption's time", async () => {
    wrapTrack("preparing", "Dimasak 09.10");
    await act(async () => {});
    expect(screen.getByTestId("rantang-track-headline").props.children).toBe("Lagi dimasak");
    expect(screen.getByText("Dimasak 09.10")).toBeTruthy();
    expect(screen.getAllByTestId(/^rantang-track-stop-\d-art$/, { includeHiddenElements: true })).toHaveLength(4);
    // The ring marks the stop; no marker rides above the pictures.
    expect(screen.queryByTestId("rantang-track-marker", { includeHiddenElements: true })).toBeNull();
    // The disc is opaque, so the rail never shows through the picture.
    const disc = StyleSheet.flatten(screen.getByTestId("rantang-track-stop-1-disc", { includeHiddenElements: true }).props.style);
    expect(String(disc.backgroundColor)).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("says the stage once: a caption without a time stays in the accessibility value only", async () => {
    wrapTrack("preparing", "Dimasak");
    await act(async () => {});
    expect(screen.getByText("Lagi dimasak")).toBeTruthy();
    expect(screen.queryByTestId("rantang-track-caption")).toBeNull();
    expect(screen.getByTestId("rantang-track").props.accessibilityValue.text).toBe("Dimasak");
  });

  it("a failed meal says Gagal diantar once", async () => {
    wrapTrack("issue");
    await act(async () => {});
    expect(screen.getAllByText("Gagal diantar")).toHaveLength(1);
  });
});

describe("Selamat makan on the delivered slot", () => {
  const card = () =>
    wrapPrimer(<SelamatMakanCard subscriptionId="s-1" ink="#2E2E2E" quiet="#555B54" edge="#BDBAAE" />);

  it("offers the review with the moment art and opens the sheet only on tap", async () => {
    card();
    await settle();
    // The track headline already says "Selamat makan" (re-gate N1): the card only asks for the review.
    expect(screen.queryByText("Selamat makan")).toBeNull();
    expect(screen.getByText("Ulas paketnya untuk pelanggan lain")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Tulis ulasan" }));
    expect(router.push).toHaveBeenCalledWith("/ulasan/s-1");
  });

  it("stays away once the review was given or put off, and leaves when the sheet marks it", async () => {
    store().set("catera.review.s-1", "done");
    card();
    await settle();
    expect(screen.queryByTestId("selamat-makan")).toBeNull();
    screen.unmount();
    store().clear();
    card();
    await settle();
    expect(screen.getByTestId("selamat-makan")).toBeTruthy();
    act(() => markReview("catera.review.s-1", "dismissed"));
    expect(screen.queryByTestId("selamat-makan")).toBeNull();
  });
});
