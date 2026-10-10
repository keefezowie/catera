import { act, render, screen, within } from "@testing-library/react-native";
import { ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import * as Reanimated from "react-native-reanimated";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeMotion, nativeThemes } from "@catera/design-tokens";
import { PhotoRing } from "@catera/mobile-ui";
import type { CustomerState, Plate as PlateData } from "@catera/domain";
import { Jadwal } from "../src/schedule/Jadwal";
import { PlanDetailScreen } from "../src/plan/PlanDetail";
import { Plate } from "../src/today/Plate";
import { customerLink } from "../src/links";
import { delivery, subscription } from "./fixtures";

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
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
}));

// The jest environment reports a font scale of 2; these checks are for a 360dp phone at the default text size.
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 800, scale: 3, fontScale: 1 }),
}));

// Wednesday 7 October 2026, 10.00 in Jakarta. Only Date is frozen so async code keeps working. October 2026 starts on
// a Thursday and spans five weeks, so the loaded grid needs one empty week to reach six.
beforeAll(() => {
  jest.useFakeTimers({
    now: new Date("2026-10-07T03:00:00Z"),
    doNotFake: [
      "nextTick", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
      "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback",
      "performance", "hrtime",
    ],
  });
});
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
});

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
function runtimeWith(read: () => Promise<CustomerState>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    customer: jest.fn(read),
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  return runtime;
}
const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );

const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const soft = nativeThemes.light.sage;
const PHOTO = "https://images.example.test/rumahan.jpg";

const october: CustomerState = {
  subscriptions: [subscription({ starts_on: "2026-10-05", ends_on: "2026-10-16" })],
  deliveries: [delivery("d-7", "2026-10-07", { status: "delivered" }), delivery("d-8", "2026-10-08")],
  addresses: [],
  notifications: [],
  cases: [],
};

const plate: PlateData = {
  state: "scheduled",
  journey: { stage: "scheduled", cookingAt: null, departedAt: null, arrivedAt: null } as unknown as PlateData["journey"],
  deliveryId: "d-7",
  meal: "lunch",
  packageName: "Makan Siang Rumahan",
  catererName: "Dapur Contoh",
  window: "11.00–13.00",
  dishes: ["Ayam bakar madu", "Sayur asem"],
  image: PHOTO,
  addressLabel: "Kantor",
  departedAt: null,
  confirmedAt: null,
  reaction: null,
  issue: null,
  catererPhone: null,
  lead: "Ayam bakar madu",
  sides: ["Sayur asem"],
};

type Instance = ReturnType<typeof screen.UNSAFE_getByType>;
const images = () => screen.UNSAFE_queryAllByType(Image);
const onlyImage = () => screen.UNSAFE_getByType(Image);

/** The three photo surfaces this task moves to expo-image, each rendered on its own. */
const surfaces: { name: string; ground: string; photo: () => Instance; show: () => Promise<void> }[] = [
  {
    name: "PhotoRing",
    ground: "photo-ground",
    photo: onlyImage,
    show: async () => {
      render(<PhotoRing uri={PHOTO} size={60} ring="forest" accessibilityLabel="Ayam bakar" />);
    },
  },
  {
    name: "the plate",
    ground: "photo-ground",
    photo: onlyImage,
    show: async () => {
      renderWith(runtimeWith(async () => october), <Plate plate={plate} apiBase="https://api.example.test" />);
      await screen.findByTestId("plate-photo");
    },
  },
  {
    name: "the plan detail",
    // The plan's photo keeps its test id when it falls back to the ground.
    ground: "plan-photo",
    // The plan's next days below are PhotoRings with photos of their own; this is the hero's.
    photo: () => images().find((image) => image.props.testID === "plan-photo") as Instance,
    show: async () => {
      renderWith(runtimeWith(async () => october), <PlanDetailScreen />);
      await screen.findByTestId("plan-photo");
    },
  },
];

describe("photos", () => {
  it.each(surfaces)("photos fade in over 180ms and appear at once under reduced motion: $name", async ({ photo: find, show }) => {
    await show();
    const photo = find();
    expect(photo.props.source).toEqual({ uri: PHOTO });
    expect(photo.props.transition).toBe(nativeMotion.selection);
    expect(nativeMotion.selection).toBe(180);
    expect(photo.props.contentFit).toBe("cover");
    // While it loads, the photo's own ground is the soft colour.
    expect(flat(photo).backgroundColor).toBe(soft);
    screen.unmount();

    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    await show();
    expect(find().props.transition).toBe(0);
  });

  it.each(surfaces)("a photo that never loads keeps its soft ground and draws no broken image: $name", async ({ ground: groundId, photo: find, show }) => {
    await show();
    const before = images().length;
    const photo = find();
    const size = flat(photo);
    act(() => photo.props.onError({ error: "404" }));
    // The image is gone; what stays is a plain view of the same size on the soft colour, with nothing drawn in it.
    expect(images()).toHaveLength(before - 1);
    const ground = screen.getByTestId(groundId, { includeHiddenElements: true });
    expect(ground.props.source).toBeUndefined();
    expect(flat(ground)).toMatchObject({ ...size, backgroundColor: soft });
    expect(ground.children).toHaveLength(0);
  });
});

/** The height a frame declares: the weekday row, then the week rows, with the gaps between them. */
function frameHeight(frame: ReturnType<typeof screen.getByTestId>) {
  const gap = flat(frame).gap as number;
  const weekdays = within(frame).getByTestId("month-weekdays");
  const label = flat(within(weekdays).getByText("Sen"));
  const weekdayRow = (label.lineHeight as number) + 2 * (label.paddingVertical as number);
  const body = within(frame).getByTestId("month-weeks");
  const rows = within(body).getAllByTestId("month-week");
  const rowsHeight = rows.reduce((sum, row) => sum + (flat(row).height as number), 0);
  return { rows: rows.length, height: weekdayRow + gap + rowsHeight + (flat(body).gap as number) * (rows.length - 1) };
}

describe("Jadwal", () => {
  it("Jadwal keeps the month grid's height while it loads", async () => {
    let resolve: (state: CustomerState) => void = () => {};
    renderWith(runtimeWith(() => new Promise<CustomerState>((r) => (resolve = r))), <Jadwal />);
    const header = await screen.findByTestId("jadwal-header");
    const frame = within(header).getByTestId("month-frame");
    // "Memuat…" sits inside the frame, over its empty weeks, with no day drawn.
    expect(within(frame).getByText("Memuat…")).toBeTruthy();
    expect(within(frame).UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Rabu 7 Oktober/ })).toBeNull();
    const loading = frameHeight(frame);
    // The legend explains the cells and says nothing about this month, so it holds its place below the frame too.
    expect(within(header).getByText("Foto menu")).toBeTruthy();

    await act(async () => resolve(october));
    const grid = await within(screen.getByTestId("jadwal-header")).findByTestId("month-grid");
    expect(screen.queryByTestId("month-frame")).toBeNull();
    expect(screen.queryByText("Memuat…")).toBeNull();
    const loaded = frameHeight(grid);

    // Six week rows in both, fixed at the cell height: 28 + 2 + 6 x 52 + 5 x 2.
    expect(loading.rows).toBe(6);
    expect(loaded.rows).toBe(6);
    expect(loading.height).toBe(352);
    expect(loaded.height).toBe(loading.height);
    expect(within(screen.getByTestId("jadwal-header")).getByText("Foto menu")).toBeTruthy();
  });

  it("a month that could not be read keeps the same frame, with its message and Coba lagi inside it", async () => {
    const runtime = runtimeWith(async () => october);
    (runtime.api.customer as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("slow"), { code: "REQUEST_TIMEOUT" }));
    renderWith(runtime, <Jadwal />);
    const header = await screen.findByTestId("jadwal-header");
    const retry = await within(header).findByRole("button", { name: "Coba lagi" });
    const frame = within(header).getByTestId("month-frame");
    expect(within(frame).getByRole("button", { name: "Coba lagi" })).toBe(retry);
    expect(within(frame).getByText("Koneksi terlalu lama. Periksa koneksi dan coba lagi.")).toBeTruthy();
    expect(frameHeight(frame)).toEqual({ rows: 6, height: 352 });
    expect(screen.queryByTestId("month-grid")).toBeNull();
  });

  it("a four-week month is drawn at the same six-week height", async () => {
    // February 2027 starts on a Monday and has 28 days: four weeks of its own.
    jest.setSystemTime(new Date("2027-02-10T03:00:00Z"));
    try {
      renderWith(runtimeWith(async () => ({ ...october, deliveries: [] })), <Jadwal />);
      const grid = await screen.findByTestId("month-grid");
      expect(within(screen.getByTestId("jadwal-header")).getByText("Februari 2027")).toBeTruthy();
      expect(frameHeight(grid)).toEqual({ rows: 6, height: 352 });
    } finally {
      jest.setSystemTime(new Date("2026-10-07T03:00:00Z"));
    }
  });
});
