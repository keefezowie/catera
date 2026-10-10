import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createElement } from "react";
import { Text } from "react-native";
import { router, Stack, useNavigationContainerRef } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { goToTab, leaveFor, openLink, systemPath, tabOfPath } from "../src/nav";
import { customerLink } from "../src/links";

// expo-router's testing library swaps in Reanimated's own jest mock, which has no useReducedMotion (setup.cjs adds it).
Object.assign(require("react-native-reanimated"), { useReducedMotion: () => false });

/**
 * The real route tree in `app/` with the real tabs layout, the real stack inside each tab and `+native-intent`. The
 * screens behind the routes are stand-ins (their own suites cover them), except the buttons under test: the paid
 * footer on Bayar and the empty Beranda. The root layout is a bare stack: the app's own adds fonts, theme and session
 * providers around the same routes. The tree is loaded from the files themselves (the in-memory form is the one that
 * keeps `+native-intent` working in the test router).
 */

const mockStub = (name: string) => () => createElement(Text, { testID: "screen" }, name);

jest.mock("@catera/mobile-core", () => ({
  useMobile: () => ({ t: (id: string) => id, locale: "id", actor: null, ready: true, demo: false, runtime: { apiBase: "" } }),
  useTrack: () => () => undefined,
  useData: () => ({ data: { items: [] }, loading: false, error: "", reload: async () => undefined }),
}));
/** Beranda without a package: the real empty home, with its Jelajah paket button. */
jest.mock("../src/today/Beranda", () => ({
  Beranda: () => require("react").createElement(jest.requireActual("../src/today/EmptyHome").EmptyHome),
}));
jest.mock("../src/schedule/Jadwal", () => ({ Jadwal: mockStub("Jadwal") }));
jest.mock("../src/discover/Jelajah", () => ({ Jelajah: mockStub("Jelajah") }));
jest.mock("../src/account/Akun", () => ({ Akun: mockStub("Akun") }));
jest.mock("../src/account/Addresses", () => ({ Addresses: mockStub("Alamat") }));
jest.mock("../src/help/ReportList", () => ({ ReportList: mockStub("Bantuan") }));
jest.mock("../src/discover/SavedList", () => ({ SavedList: mockStub("Disimpan") }));
jest.mock("../src/schedule/DayScreen", () => ({ DayScreen: mockStub("Hari") }));
jest.mock("../src/help/ReportProblem", () => ({ ReportProblem: mockStub("Ada masalah") }));
jest.mock("../src/account/Notifications", () => ({ NotificationsScreen: mockStub("Notifikasi") }));
jest.mock("../src/discover/PackageDetail", () => ({ PackageDetail: mockStub("Paket") }));
jest.mock("../src/account/Payments", () => ({ Payments: mockStub("Riwayat pembayaran") }));
jest.mock("../src/schedule/ChooseMenu", () => ({ ChooseMenu: mockStub("Pilih menu") }));
jest.mock("../src/plan/PlanDetail", () => ({ PlanDetailScreen: mockStub("Paket langganan") }));
jest.mock("../src/account/Masuk", () => ({ Masuk: mockStub("Masuk") }));
jest.mock("../src/account/Register", () => ({ Register: mockStub("Daftar") }));
jest.mock("../src/account/Recover", () => ({ Recover: mockStub("Pemulihan") }));
jest.mock("../src/account/AuthCallback", () => ({ AuthCallback: mockStub("Verifikasi") }));
jest.mock("../src/buy/BuyScreen", () => ({ BuyScreen: mockStub("Beli") }));
jest.mock("../src/claim/ClaimScreen", () => ({ ClaimScreen: mockStub("Klaim") }));
jest.mock("../src/tomorrow/TomorrowStory", () => ({ TomorrowStoryScreen: mockStub("Cerita") }));
/** Bayar after payment: the real paid footer, for a plan whose menus the customer picks. */
jest.mock("../src/buy/PaymentScreen", () => ({
  PaymentScreen: () =>
    require("react").createElement(jest.requireActual("../src/buy/PaidOutcome").PaidActions, {
      summary: { subscriptionId: "s1", offerName: "", caterer: "", image: "", firstDate: "", dates: [], more: 0, menuChoice: true },
    }),
}));

type Nav = { key?: string; name: string; params?: Record<string, unknown>; state?: { key?: string; index?: number; routes: Nav[] } };

let state: () => { routes: Nav[] } = () => ({ routes: [] });

const APP = join(__dirname, "..", "app");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));

let container: ReturnType<typeof useNavigationContainerRef>;
function Root() {
  container = useNavigationContainerRef();
  return <Stack screenOptions={{ headerShown: false }} />;
}

function appRoutes() {
  const routes: Record<string, unknown> = {};
  for (const file of files(APP)) {
    const key = relative(APP, file).split(sep).join("/").replace(/\.tsx?$/, "");
    routes[key] = key === "_layout" ? Root : require(file);
  }
  return routes;
}

function mount(initialUrl = "/") {
  // A cold start has no route behind it, but the test router keeps the last render's route between renders, and the
  // router places a path in the group of the route it is on.
  const { storeRef } = require("expo-router/build/global-state/store");
  if (storeRef.current) storeRef.current.routeInfo = undefined;
  const result = renderRouter(appRoutes() as never, { initialUrl });
  state = () => result.getRouterState() as unknown as { routes: Nav[] };
  return result;
}

/** The app's root stack (the router wraps it in its own __root route). */
function rootStack() {
  const top = state();
  return top.routes[0]?.name === "__root" && top.routes[0].state ? top.routes[0].state : top;
}
const root = () => rootStack().routes.map((r) => r.name);
const tabsState = () => rootStack().routes.find((r) => r.name === "(tabs)")?.state;
/** The selected tab: "(index)", "(jadwal)", "(jelajah)" or "(akun)". */
const tab = () => {
  const tabs = tabsState();
  return tabs ? tabs.routes[tabs.index ?? 0].name : undefined;
};
/** One tab's stack by route name ([] before the tab has a stack). */
const stack = (group: string) => tabsState()?.routes.find((r) => r.name === group)?.state?.routes.map((r) => r.name) ?? [];
const TABS = ["(index)", "(jadwal)", "(jelajah)", "(akun)"];
const ROOTS = ["index", "jadwal", "jelajah", "akun"];
/** No tab holds another tab's root and there is one tabs navigator: a tab root link never pushes a second copy. */
function expectNoSecondRoot() {
  TABS.forEach((group, i) => expect(stack(group).filter((name) => ROOTS.includes(name) && name !== ROOTS[i])).toEqual([]));
  expect(root().filter((name) => name === "(tabs)")).toHaveLength(1);
}

const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }));
/** A tap on a tab in the bar: the tab is selected and keeps its stack. */
const tapTab = (group: string) => act(() => container.dispatch({ type: "JUMP_TO", payload: { name: group }, target: tabsState()!.key } as never));

describe("each tab keeps its own stack", () => {
  it("a cold link to a plan opens it inside Beranda with Back to Beranda", () => {
    for (const [href, route] of [
      ["/subscriptions/s1", "subscriptions/[id]"],
      ["/hari/d1", "hari/[id]"],
      ["/pilih-menu/s1", "pilih-menu/[id]"],
    ]) {
      const app = mount(customerLink(href));
      expect(root()).toEqual(["(tabs)"]);
      expect(tab()).toBe("(index)");
      expect(stack("(index)")).toEqual(["index", route]);
      act(() => router.back());
      expect(app.getPathname()).toBe("/");
      expect(stack("(index)")).toEqual(["index"]);
      app.unmount();
    }
  });

  it("a push tap on a cold start opens the screen inside Beranda with Back to Beranda", () => {
    for (const [href, route] of [
      ["/subscriptions/s1", "subscriptions/[id]"],
      ["/deliveries/d1", "hari/[id]"],
      ["/subscriptions/s1/menu?date=2026-10-12&meal=lunch", "pilih-menu/[id]"],
    ]) {
      const app = mount("/");
      // What MobileProvider does with a tapped push: customerLink maps it, openLink opens it.
      act(() => openLink(customerLink(href)));
      expect(root()).toEqual(["(tabs)"]);
      expect(tab()).toBe("(index)");
      expect(stack("(index)")).toEqual(["index", route]);
      act(() => router.back());
      expect(stack("(index)")).toEqual(["index"]);
      app.unmount();
    }
  });

  it("a push tap that arrives before the tabs exist opens once they do", () => {
    // A cold Bayar with no tabs under it: the tapped push waits instead of being dropped or opening over Bayar.
    mount("/bayar/c1");
    act(() => openLink(customerLink("/subscriptions/s1")));
    expect(root()).toEqual(["bayar/[id]"]);
    press("Ke Beranda");
    expect(root()).toEqual(["(tabs)"]);
    expect(tab()).toBe("(index)");
    expect(stack("(index)")).toEqual(["index", "subscriptions/[id]"]);
  });

  it("a push tap while Bayar is open opens the screen in the tab, never in a second tab bar", () => {
    mount("/");
    act(() => goToTab("akun"));
    act(() => router.push("/bayar/c1"));
    act(() => openLink(customerLink("/deliveries/d1")));
    expect(root()).toEqual(["(tabs)"]);
    expect(stack("(akun)")).toEqual(["akun", "hari/[id]"]);
    // A link to a screen above the tabs still opens over them.
    act(() => openLink(customerLink("/payment/c2")));
    expect(root()).toEqual(["(tabs)", "bayar/[id]"]);
  });

  it("a tap while another tab is open opens the screen in that tab, and each tab keeps its place", () => {
    mount("/");
    act(() => goToTab("jadwal"));
    act(() => openLink(customerLink("/deliveries/d1")));
    expect(tab()).toBe("(jadwal)");
    expect(stack("(jadwal)")).toEqual(["jadwal", "hari/[id]"]);
    act(() => goToTab("akun"));
    act(() => router.push("/alamat"));
    expect(stack("(akun)")).toEqual(["akun", "alamat"]);
    // Tapping the Jadwal tab: the day is still open there, and Akun keeps Alamat.
    tapTab("(jadwal)");
    expect(tab()).toBe("(jadwal)");
    expect(stack("(jadwal)")).toEqual(["jadwal", "hari/[id]"]);
    expect(stack("(akun)")).toEqual(["akun", "alamat"]);
    expect(stack("(index)")).toEqual(["index"]);
  });

  it("an OS link to a tab root opens that tab", () => {
    for (const [href, group] of [
      ["/jadwal", "(jadwal)"],
      ["/jelajah", "(jelajah)"],
      ["/akun", "(akun)"],
      ["/", "(index)"],
    ]) {
      const app = mount(href);
      expect(tab()).toBe(group);
      expectNoSecondRoot();
      app.unmount();
    }
  });
});

describe("links to tab roots select the tab", () => {
  it("Lihat jadwal after payment selects the Jadwal tab", () => {
    mount("/");
    act(() => goToTab("jadwal"));
    act(() => router.push("/hari/d1"));
    act(() => goToTab("jelajah"));
    act(() => router.push("/paket/p1"));
    act(() => router.push("/beli/p1"));
    act(() => router.replace("/bayar/c1"));
    expect(root()).toEqual(["(tabs)", "bayar/[id]"]);
    press("Lihat jadwal");
    // Bayar is gone, Jadwal is selected at its root, and Jelajah keeps the package page.
    expect(root()).toEqual(["(tabs)"]);
    expect(tab()).toBe("(jadwal)");
    expect(stack("(jadwal)")).toEqual(["jadwal"]);
    expect(stack("(jelajah)")).toEqual(["jelajah", "paket/[id]"]);
    expectNoSecondRoot();
  });

  it("Lihat jadwal or Ke Beranda on a Bayar opened cold opens that tab, never an empty stack", () => {
    const jadwal = mount("/bayar/c1");
    expect(root()).toEqual(["bayar/[id]"]);
    press("Lihat jadwal");
    expect(root()).toEqual(["(tabs)"]);
    expect(tab()).toBe("(jadwal)");
    expect(stack("(jadwal)")).toEqual(["jadwal"]);
    jadwal.unmount();
    mount("/bayar/c1");
    press("Ke Beranda");
    expect(root()).toEqual(["(tabs)"]);
    expect(tab()).toBe("(index)");
    expect(stack("(index)")).toEqual(["index"]);
  });

  it("Ke Beranda and Pilih menu after payment leave Bayar for the tabs", () => {
    mount("/");
    act(() => goToTab("jelajah"));
    act(() => router.push("/paket/p1"));
    act(() => router.push("/bayar/c1"));
    press("Ke Beranda");
    expect(root()).toEqual(["(tabs)"]);
    expect(tab()).toBe("(index)");

    act(() => goToTab("jelajah"));
    act(() => router.push("/paket/p1"));
    act(() => router.push("/bayar/c1"));
    press("Pilih menu");
    // Pilih menu opens in the tab that started the purchase, above the package page; Bayar is gone.
    expect(root()).toEqual(["(tabs)"]);
    expect(tab()).toBe("(jelajah)");
    expect(stack("(jelajah)")).toEqual(["jelajah", "paket/[id]", "pilih-menu/[id]"]);
    act(() => router.back());
    expect(stack("(jelajah)")).toEqual(["jelajah", "paket/[id]"]);
  });

  it("Jelajah paket from an empty home selects Jelajah", () => {
    mount("/");
    act(() => goToTab("jelajah"));
    act(() => router.push("/paket/p1"));
    act(() => goToTab("index"));
    press("Jelajah paket");
    expect(tab()).toBe("(jelajah)");
    expect(stack("(jelajah)")).toEqual(["jelajah"]);
    expect(stack("(index)")).toEqual(["index"]);
    expectNoSecondRoot();
  });

  it("a link to /calendar or another tab root selects that tab from anywhere", () => {
    mount("/");
    act(() => router.push("/subscriptions/s1"));
    act(() => openLink(customerLink("/calendar")));
    expect(tab()).toBe("(jadwal)");
    expect(stack("(index)")).toEqual(["index", "subscriptions/[id]"]);
    act(() => router.push("/bayar/c1"));
    act(() => openLink(customerLink("/#packages")));
    expect(root()).toEqual(["(tabs)"]);
    expect(tab()).toBe("(jelajah)");
    act(() => openLink(customerLink("/account")));
    expect(tab()).toBe("(akun)");
    act(() => openLink(customerLink("/today")));
    expect(tab()).toBe("(index)");
    // Beranda is back at its root; the other tabs were never given a second root.
    expect(stack("(index)")).toEqual(["index"]);
    expectNoSecondRoot();
  });
});

describe("legacy paths and the screens above the tabs", () => {
  it("every legacy path still lands on its screen", () => {
    for (const [href, route] of [
      ["/saved", "disimpan"],
      ["/addresses", "alamat"],
      ["/package/p1", "paket/[id]"],
      ["/subscriptions/s1/menu?date=2026-10-12&meal=lunch", "pilih-menu/[id]"],
    ]) {
      const cold = mount(href);
      expect(tab()).toBe("(index)");
      expect(stack("(index)")).toEqual(["index", route]);
      cold.unmount();
      // Opened while Jadwal is open, it lands in Jadwal.
      const warm = mount("/");
      act(() => goToTab("jadwal"));
      act(() => router.push(href));
      expect(stack("(jadwal)")).toEqual(["jadwal", route]);
      warm.unmount();
    }
    const menu = mount("/subscriptions/s1/menu?date=2026-10-12&meal=lunch");
    const chosen = tabsState()?.routes.find((r) => r.name === "(index)")?.state?.routes[1];
    expect(chosen?.params).toMatchObject({ id: "s1", date: "2026-10-12", meal: "lunch" });
    menu.unmount();

    // /discover is Jelajah. An OS link opens the tab directly and leaves Beranda alone.
    const cold = mount("/discover");
    expect(tab()).toBe("(jelajah)");
    expect(stack("(jelajah)")).toEqual(["jelajah"]);
    expect(stack("(index)")).not.toContain("discover");
    cold.unmount();
    // Opened inside a tab, it selects Jelajah, and steps back out of that tab once the tab is shown again.
    mount("/");
    act(() => goToTab("jadwal"));
    act(() => router.push("/hari/d1"));
    act(() => router.push("/discover"));
    expect(tab()).toBe("(jelajah)");
    tapTab("(jadwal)");
    expect(stack("(jadwal)")).toEqual(["jadwal", "hari/[id]"]);
    expectNoSecondRoot();
  });

  it("login, Beli, Bayar, claim and the story open above the tabs", () => {
    mount("/");
    act(() => goToTab("jelajah"));
    for (const [href, route] of [
      ["/login", "login"],
      ["/beli/p1", "beli/[id]"],
      ["/renew/s1", "renew/[id]"],
      ["/bayar/c1", "bayar/[id]"],
      ["/claim/t1", "claim/[token]"],
      ["/tomorrow?part=0", "tomorrow"],
    ]) {
      act(() => router.push(href));
      expect(root()).toEqual(["(tabs)", route]);
      act(() => router.back());
      expect(root()).toEqual(["(tabs)"]);
      expect(tab()).toBe("(jelajah)");
    }
  });

  it("signing in returns to the tab or the screen that asked for it", () => {
    // Signed out on Jadwal: SignInFirst opens Masuk with next=/jadwal.
    const jadwal = mount("/");
    act(() => goToTab("jadwal"));
    act(() => router.push({ pathname: "/login", params: { next: "/jadwal" } }));
    expect(root()).toEqual(["(tabs)", "login"]);
    act(() => leaveFor("/jadwal"));
    expect(root()).toEqual(["(tabs)"]);
    expect(tab()).toBe("(jadwal)");
    expect(stack("(jadwal)")).toEqual(["jadwal"]);
    jadwal.unmount();

    // A plan link that needed an account: it opens in the current tab once Masuk is gone.
    const akun = mount("/");
    act(() => goToTab("akun"));
    act(() => router.push("/login"));
    act(() => leaveFor("/subscriptions/s1"));
    expect(root()).toEqual(["(tabs)"]);
    expect(stack("(akun)")).toEqual(["akun", "subscriptions/[id]"]);
    akun.unmount();

    // Masuk opened cold: the plan opens in Beranda with Beranda behind it.
    mount("/login");
    act(() => leaveFor("/subscriptions/s1"));
    expect(root()).toEqual(["(tabs)"]);
    expect(stack("(index)")).toEqual(["index", "subscriptions/[id]"]);
  });
});

describe("paths", () => {
  it("names the tab a path is the root of", () => {
    expect(["/", "/jadwal", "/jelajah", "/akun", "/jadwal/", "/index", "/jadwal?x=1", "/hari/d1"].map(tabOfPath)).toEqual([
      "index",
      "jadwal",
      "jelajah",
      "akun",
      "jadwal",
      null,
      null,
      null,
    ]);
  });

  it("points OS links to a tab root at that tab and leaves every other link alone", () => {
    expect(systemPath("exp://127.0.0.1:8084/--/jadwal")).toBe("/(tabs)/(jadwal)/jadwal");
    expect(systemPath("catera://jelajah")).toBe("/(tabs)/(jelajah)/jelajah");
    expect(systemPath("/akun")).toBe("/(tabs)/(akun)/akun");
    expect(systemPath("exp://127.0.0.1:8084/--/discover")).toBe("/(tabs)/(jelajah)/jelajah");
    for (const url of ["exp://127.0.0.1:8084", "exp://127.0.0.1:8084/--/subscriptions/s1", "catera://hari/d1", "/", "/jadwal?d=1"])
      expect(systemPath(url)).toBe(url);
  });
});
