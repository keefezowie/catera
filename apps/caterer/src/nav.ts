import { router, type useNavigationContainerRef } from "expo-router";
import type { CatererTab } from "./roles";

/** Each tab keeps its own stack: `app/(tabs)/(index,pelanggan,menu,usaha)`. */
const TABS: readonly CatererTab[] = ["index", "pelanggan", "menu", "usaha"];

/**
 * Where a tab's root lives when the tabs are not mounted yet (after Masuk or Daftar). "/" lands on Hari ini; the other
 * roots name their group, because a bare "/pelanggan" opened from Hari ini resolves inside Hari ini's own stack (the
 * router prefers the current group).
 */
const ROOT_HREF: Record<CatererTab, string> = {
  index: "/",
  pelanggan: "/(tabs)/(pelanggan)/pelanggan",
  menu: "/(tabs)/(menu)/menu",
  usaha: "/(tabs)/(usaha)/usaha",
};

/** The array-group layout gets its own segment, `(menu)`; this is the tab it hosts. */
export function tabOfSegment(segment: string): CatererTab {
  const name = segment.replace(/^\((.*)\)$/, "$1");
  return (TABS as readonly string[]).includes(name) ? (name as CatererTab) : "index";
}

/** The tab a path is the root of ("/" and "/?date=…" are Hari ini), with its query as params; null for any other path. */
export function tabOfPath(path: string): { tab: CatererTab; params?: Record<string, string> } | null {
  const url = new URL(path, "https://catera.invalid");
  const name = url.pathname.replace(/^\/+|\/+$/g, "");
  const tab = name === "" ? "index" : (TABS as readonly string[]).includes(name) && name !== "index" ? (name as CatererTab) : null;
  if (!tab) return null;
  const params = Object.fromEntries(url.searchParams);
  return Object.keys(params).length ? { tab, params } : { tab };
}

/** A mounted navigator's state, as the container reports it once ready (keys are set). */
type Route = { key: string; name: string; state?: State };
type State = { key: string; index: number; routes: Route[] };
type Container = ReturnType<typeof useNavigationContainerRef>;

let container: Container | null = null;
/** A link that arrived before the tabs were mounted (a cold push tap, read while the session still loads). */
let pending: string | null = null;

/**
 * The tabs layout registers the navigation container once a signed-in account has its tabs, so a tab change can
 * target each navigator by its key. A link that arrived before then opens now.
 */
export function registerNavigation(ref: Container | null) {
  container = ref;
  const waiting = pending;
  pending = null;
  if (!ref || !waiting) return;
  if (tabsInRoot()) return openLink(waiting);
  // The tab bar reports its first state just after this layout mounts; open the link once the container holds it.
  const stop = ref.addListener("state", () => {
    if (!tabsInRoot()) return;
    stop();
    openLink(waiting);
  });
}

/** The app's root stack (under the router's own `__root` route) and the tabs route in it, when the tabs are mounted. */
function tabsInRoot(): { root: State; at: number; tabs: State } | null {
  let root = container?.isReady() ? (container.getRootState() as unknown as State | undefined) : undefined;
  while (root && !root.routes.some((r) => r.name === "(tabs)")) root = root.routes[root.index]?.state;
  if (!root) return null;
  const at = root.routes.findIndex((r) => r.name === "(tabs)");
  const tabs = at === -1 ? undefined : root.routes[at].state;
  return tabs ? { root, at, tabs } : null;
}

/** Drops the root-stack screens above the tabs (Aktifkan, Impor). */
function dismissAboveTabs(found: { root: State; at: number }) {
  const count = found.root.index - found.at;
  if (count > 0) container!.dispatch({ type: "POP", payload: { count }, target: found.root.key });
}

/**
 * Selects a tab, popped to its root, instead of pushing a second copy of it inside the current tab. Screens above the
 * tabs (Impor, Aktifkan) close first. `params` reach the root screen (Hari ini's `date`). A tab this account may not
 * open (staff: Pelanggan and Usaha) is not in the bar, so nothing changes. With no tabs mounted yet (after signing in)
 * the root replaces the current screen.
 */
export function goToTab(tab: CatererTab, params?: Record<string, string>) {
  const found = tabsInRoot();
  if (!found) {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    router.replace(`${ROOT_HREF[tab]}${query}` as never);
    return;
  }
  const { tabs } = found;
  const group = `(${tab})`;
  const route = tabs.routes.find((r) => r.name === group);
  if (!route) return;
  const stack = route.state;
  if (stack && stack.routes.length > 1) container!.dispatch({ type: "POP_TO_TOP", target: stack.key });
  if (params && stack) container!.dispatch({ type: "SET_PARAMS", payload: { params }, source: stack.routes[0].key, target: stack.key });
  if (tabs.routes[tabs.index]?.name !== group || (params && !stack))
    container!.dispatch({
      type: "JUMP_TO",
      payload: { name: group, ...(params && !stack ? { params: { screen: tab, params } } : {}) },
      target: tabs.key,
    });
  dismissAboveTabs(found);
}

/** First path segments of the screens that sit above the tabs in the root stack. */
const ROOT_STACK = new Set(["aktifkan", "impor", "masuk", "daftar"]);

/**
 * Opens an app path from a link (a notification tap, an attention card): a tab root selects its tab; a screen above the
 * tabs (Aktifkan, Impor) opens over them; any other screen opens in the current tab, after closing a screen above the
 * tabs so it never lands in a second tab bar.
 */
export function openLink(path: string) {
  const found = tabsInRoot();
  if (!found) {
    // Before the tabs exist (the session is still loading, or nobody is signed in) the link waits for them.
    pending = path;
    return;
  }
  const root = tabOfPath(path);
  if (root) return goToTab(root.tab, root.params);
  const section = path.replace(/^\/+/, "").split(/[/?#]/)[0];
  if (ROOT_STACK.has(section)) return router.push(path as never);
  // Named with the focused tab's group, so the screen opens in that tab even while a screen above the tabs is closing.
  dismissAboveTabs(found);
  const group = found.tabs.routes[found.tabs.index]?.name ?? "(index)";
  router.push(`/(tabs)/${group}${path.startsWith("/") ? path : `/${path}`}` as never);
}
