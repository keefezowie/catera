import { useEffect } from "react";
import { router, useNavigation, useRoute, type useNavigationContainerRef } from "expo-router";
import { withoutLinkTitle } from "@catera/mobile-ui";

/** The four tabs. Each keeps its own stack: `app/(tabs)/(index,jadwal,jelajah,akun)`. */
export type Tab = "index" | "jadwal" | "jelajah" | "akun";

const TABS: readonly Tab[] = ["index", "jadwal", "jelajah", "akun"];

/**
 * Where a tab's root lives when the tabs are not mounted (a cold Bayar, claim or story). "/" lands on Beranda, the first
 * tab; the other roots name their group, because a bare "/jadwal" opened from Beranda resolves inside Beranda's own
 * stack (the router prefers the current group).
 */
const ROOT_HREF: Record<Tab, string> = {
  index: "/",
  jadwal: "/(tabs)/(jadwal)/jadwal",
  jelajah: "/(tabs)/(jelajah)/jelajah",
  akun: "/(tabs)/(akun)/akun",
};

/**
 * Alamat and Bantuan opened from Beli or Bayar: the root-stack copies in `app/pembelian`, presented over the purchase,
 * so it stays underneath and no second tab bar opens. Close returns to it. They have their own path, not a group: a
 * group copy would share "/alamat" with the tab's screen, and a cold link to it would open the copy.
 */
export const FLOW_HREF = { alamat: "/pembelian/alamat", bantuan: "/pembelian/bantuan" } as const;

/** Old paths whose screen is a tab root. */
const LEGACY_ROOTS: Record<string, Tab> = { discover: "jelajah" };

/** First path segments of the screens that sit above the tabs in the root stack. */
const ROOT_STACK = new Set([
  "login",
  "register",
  "recover",
  "auth",
  "beli",
  "renew",
  "bayar",
  "checkout",
  "payment",
  "claim",
  "tomorrow",
  "pembelian",
]);

/** The array-group layout gets its own segment, `(jadwal)`; this is the tab it hosts. */
export function tabOfSegment(segment: string): Tab {
  const name = segment.replace(/^\((.*)\)$/, "$1");
  return (TABS as readonly string[]).includes(name) ? (name as Tab) : "index";
}

/** A path without its query and hash. */
const pathname = (path: string) => path.split(/[?#]/)[0];

/**
 * The tab a path is the root of ("/" is Beranda), or null for any other path. A query or hash does not change the
 * screen ("/jadwal?d=1" is still Jadwal); no tab root reads params, so selecting the tab drops them.
 */
export function tabOfPath(path: string): Tab | null {
  const name = pathname(path).replace(/^\/+|\/+$/g, "");
  if (name === "") return "index";
  return (TABS as readonly string[]).includes(name) && name !== "index" ? (name as Tab) : null;
}

/** A mounted navigator's state, as the container reports it once ready (keys are set). */
type Route = { key: string; name: string; state?: State };
type State = { key: string; index: number; routes: Route[] };
type Container = ReturnType<typeof useNavigationContainerRef>;

let container: Container | null = null;
/** A link that arrived before it had somewhere to open (a cold push tap, read while the session still loads). */
let pending: string | null = null;

/**
 * The root layout registers the navigation container, so a tab change can target each navigator by its key, and a
 * link that arrived while the app was still loading opens once it can. Returns the cleanup for the layout's effect.
 */
export function registerNavigation(ref: Container): () => void {
  container = ref;
  const flush = () => {
    const waiting = pending;
    if (!waiting || isLoading()) return;
    pending = null;
    openLink(waiting);
  };
  const stop = ref.addListener("state", flush);
  flush();
  return () => {
    stop();
    if (container === ref) container = null;
  };
}

/** The app's root stack, under the router's own `__root` route, once it is mounted. */
function appStack(): State | undefined {
  let root = container?.isReady() ? (container.getRootState() as unknown as State | undefined) : undefined;
  if (root?.routes.length === 1 && root.routes[0].name === "__root") root = root.routes[0].state;
  return root?.key ? root : undefined;
}

/**
 * True while a link has nowhere to open yet: the session is still loading (no stack), or the tabs are on screen but
 * have not reported their state. A screen above the tabs opened cold (Bayar, claim, login, the story) is not loading.
 */
function isLoading(): boolean {
  if (tabsInRoot()) return false;
  const root = appStack();
  return !root || root.routes[root.index]?.name === "(tabs)";
}

/** The app's root stack and the tabs route in it, when the tabs are mounted. */
function tabsInRoot(): { root: State; at: number; tabs: State } | null {
  const root = appStack();
  if (!root?.routes.some((r) => r.name === "(tabs)")) return null;
  const at = root.routes.findIndex((r) => r.name === "(tabs)");
  const tabs = root.routes[at].state;
  return tabs?.key ? { root, at, tabs } : null;
}

/** Drops the root-stack screens above the tabs (login, Beli, Bayar, claim, the story). */
function dismissAboveTabs(found: { root: State; at: number }) {
  const count = found.root.index - found.at;
  if (count > 0) container!.dispatch({ type: "POP", payload: { count }, target: found.root.key });
}

/**
 * Selects a tab, popped to its root, instead of pushing a second copy of it inside the current tab. Screens above the
 * tabs (Bayar after payment, login, claim) close first, so leaving them never lands back in Beli or Bayar. A screen
 * opened cold, with no tabs under it, is replaced by the tab.
 */
export function goToTab(tab: Tab) {
  const found = tabsInRoot();
  if (!found) {
    router.replace(ROOT_HREF[tab] as never);
    return;
  }
  const { tabs } = found;
  const group = `(${tab})`;
  // A tab not opened yet has a partial state with no key: it starts at its root when it mounts.
  const stack = tabs.routes.find((r) => r.name === group)?.state;
  if (stack?.key && stack.routes.length > 1) container!.dispatch({ type: "POP_TO_TOP", target: stack.key });
  if (tabs.routes[tabs.index]?.name !== group) container!.dispatch({ type: "JUMP_TO", payload: { name: group }, target: tabs.key });
  dismissAboveTabs(found);
}

/** Opens a screen that lives in the tabs in the selected tab, after closing the screens above the tabs, so it never
 * lands in a second tab bar above Beli or Bayar. Named with the tab's group, so it opens there even while they close. */
function openInTab(found: { root: State; at: number; tabs: State }, path: string) {
  dismissAboveTabs(found);
  const group = found.tabs.routes[found.tabs.index]?.name ?? "(index)";
  router.push(`/(tabs)/${group}${path.startsWith("/") ? path : `/${path}`}` as never);
}

/**
 * An OS link (a cold or warm deep link) to a tab root opens that tab. Without this, "/jadwal" opened cold resolves to the
 * first group that has a jadwal route, so Jadwal would open inside Beranda. /discover is Jelajah. Other paths pass
 * through without their `title`: anyone can craft an OS link, so only links the app builds may name a screen before its
 * record loads. A detail screen opened cold lands in Beranda, the first tab, with Beranda behind it.
 */
export function systemPath(link: string): string {
  const url = withoutLinkTitle(link);
  // exp://127.0.0.1:8084/--/jadwal names the path after a host (Expo Go adds "/--"); catera://jadwal has no host.
  const hosted = /^(exps?|https?):\/\/[^/?#]*/i;
  const path = (hosted.test(url) ? url.replace(hosted, "").replace(/^\/--(?=[/?#]|$)/, "") : url.replace(/^[a-z][\w+.-]*:\/\//i, "/"))
    .replace(/^\/*/, "/");
  const tab = tabOfPath(path) ?? LEGACY_ROOTS[pathname(path).slice(1).replace(/\/+$/, "")] ?? null;
  // "/" already opens Beranda: it is the first tab.
  return tab && tab !== "index" ? ROOT_HREF[tab] : url;
}

/**
 * Opens an app path from a link (a push or notification tap, a row that carries an href): a tab root selects its tab; a
 * screen above the tabs (Bayar, Beli, claim) opens over them; any other screen opens in the current tab. While the
 * session is still loading on a cold start the link waits. On a screen above the tabs opened cold, with no tabs under
 * it, a tapped link opens at once, the way `leaveFor` leaves such a screen: a tapped notification always responds.
 */
export function openLink(path: string) {
  const found = tabsInRoot();
  if (!found) {
    if (isLoading()) pending = path;
    else leaveFor(path);
    return;
  }
  const tab = tabOfPath(path);
  if (tab) return goToTab(tab);
  const section = path.replace(/^\/+/, "").split(/[/?#]/)[0];
  if (ROOT_STACK.has(section)) return router.push(path as never);
  openInTab(found, path);
}

/**
 * Leaves a finished screen above the tabs (login, the auth link, claim, Bayar after payment, a story, a renewal that can
 * no longer go ahead) for `path`. A tab root selects its tab. A screen that lives in the tabs opens in the current tab
 * once the screens above the tabs are gone; with no tabs under it (a cold link), it opens in Beranda with Beranda
 * behind it. Another screen above the tabs replaces this one.
 */
export function leaveFor(path: string) {
  const tab = tabOfPath(path);
  if (tab) return goToTab(tab);
  const section = path.replace(/^\/+/, "").split(/[/?#]/)[0];
  if (ROOT_STACK.has(section)) return router.replace(path as never);
  const found = tabsInRoot();
  if (!found) return router.replace(path as never, { withAnchor: true });
  openInTab(found, path);
}

/**
 * A legacy path whose screen is a tab root (/discover is Jelajah), opened from inside a tab. It selects the tab. The
 * redirect stays where it opened until that tab is shown again, then steps back: taking it out of a stack while the tab
 * bar hides that stack leaves the screen under it blank on Android.
 */
export function useRedirectToTab(tab: Tab) {
  const navigation = useNavigation();
  const { key } = useRoute();
  useEffect(() => goToTab(tab), [tab]);
  useEffect(() => {
    let left = false;
    const blur = navigation.addListener("blur", () => {
      left = true;
    });
    const focus = navigation.addListener("focus", () => {
      const stack = navigation.getState() as unknown as State | undefined;
      if (left && stack && stack.routes.findIndex((r) => r.key === key) > 0) navigation.goBack();
    });
    return () => {
      blur();
      focus();
    };
  }, [navigation, key]);
}
