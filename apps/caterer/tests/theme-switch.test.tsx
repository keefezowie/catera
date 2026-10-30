import { act, screen, within } from "@testing-library/react-native";
import { render } from "./render-dapur";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import { nativeThemes } from "@catera/design-tokens";
import { TodayScreen } from "../src/today/TodayScreen";
import { canvasDay } from "./fixtures";

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
jest.mock("../src/nav", () => ({ openLink: jest.fn(), goToTab: jest.fn() }));
jest.mock("../src/today/offline", () => ({
  cacheSession: jest.fn(() => 0),
  saveCachedDay: jest.fn(async () => undefined),
  loadCachedDay: jest.fn(async () => null),
}));

const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };

function runtimeWith(day: () => Promise<unknown>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: owner, demo: false })),
    sellerOperations: jest.fn(day),
    sellerAttention: jest.fn(async () => ({ items: [], total: 0, nextCursor: null, timezone: "Asia/Jakarta" })),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as ReactNative.StyleProp<ReactNative.TextStyle>);

afterEach(() => jest.restoreAllMocks());

/**
 * Gate 2026-10-30 #10: a light-to-dark switch with Hari ini open left "Urutan antar" and "Per paket" empty on Android.
 * Both are clipped `ListCard`s (overflow hidden, radius 16). In light the card carries a 1px border; the dark edge used to
 * drop the `borderWidth` key instead of setting 0, so the update reset it to "undefined" and Android clipped the card's
 * children to an empty padding box: the card's own fill changed, everything inside it (text, badges, icons) vanished.
 * The unclipped Daftar masak card switched fine. The card must say `borderWidth: 0` in dark, and its rows must take the
 * dark inks, after a switch while mounted.
 */
it("re-themes Urutan antar and Per paket when the system turns dark while Hari ini is open", async () => {
  let scheme: "light" | "dark" = "light";
  jest.spyOn(ReactNative, "useColorScheme").mockImplementation(() => scheme);
  const day = canvasDay();
  const runtime = runtimeWith(async () => day);
  const ui = () => (
    <ThemeProvider storageKey="t.theme">
      <MoodProvider>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <TodayScreen />
        </MobileProvider>
      </MoodProvider>
    </ThemeProvider>
  );
  const view = render(ui());
  await screen.findByTestId("stop-1-title");
  const perPackage = () => within(screen.getByTestId("per-package"));
  const packageRow = () => perPackage().getAllByTestId(/^per-package-/)[0];

  // Mounted in light: the light inks and the light card edge.
  expect(flat(screen.getByTestId("stop-1-title")).color).toBe(nativeThemes.light.charcoal);
  for (const card of screen.getAllByTestId("list-card")) expect(flat(card)).toMatchObject({ borderWidth: 1 });

  scheme = "dark";
  view.rerender(ui());
  await act(async () => {});

  const light = nativeThemes.light;
  const dark = nativeThemes.dark;
  // Urutan antar: the title in charcoal, the meta line in muted, the number in charcoal, all dark.
  expect(flat(screen.getByTestId("stop-1-title")).color).toBe(dark.charcoal);
  expect(flat(screen.getByTestId("stop-1-meta")).color).toBe(dark.muted);
  expect(flat(within(screen.getByTestId("stop-1-badge")).getByText("1")).color).toBe(dark.charcoal);
  // Per paket: the label in muted, the value in charcoal, both dark.
  const [label, value] = within(packageRow()).getAllByText(/./);
  expect(flat(label).color).toBe(dark.muted);
  expect(flat(value).color).toBe(dark.charcoal);
  expect(dark.charcoal).not.toBe(light.charcoal);
  // Both clipped cards: the dark fill and an explicit zero border, never a border key that just disappears.
  const cards = [
    within(screen.getByTestId("delivery-order")).getByTestId("list-card"),
    perPackage().getByTestId("list-card"),
  ];
  for (const card of cards) {
    const style = flat(card);
    expect(style.backgroundColor).toBe(dark.surface);
    expect(style.overflow).toBe("hidden");
    expect(style).toHaveProperty("borderWidth", 0);
  }

  // And back: light restores the 1px edge.
  scheme = "light";
  view.rerender(ui());
  await act(async () => {});
  expect(flat(screen.getByTestId("stop-1-title")).color).toBe(light.charcoal);
  for (const card of screen.getAllByTestId("list-card")) expect(flat(card)).toMatchObject({ borderWidth: 1 });
});
