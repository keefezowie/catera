import { router, type useNavigationContainerRef } from "expo-router";
import { CATERER_TABS, type CatererTab } from "./roles";

const TABS: readonly string[] = CATERER_TABS;

/**
 * Where a tab's root lives when the tabs are not mounted yet (after Masuk or Daftar). "/" lands on Hari ini; the other
 * roots name their group, because a bare "/pelanggan" opened from Hari ini resolves inside Hari ini's own stack (the
 * router prefers the current group).
 */
const rootHref = (tab: CatererTab) => (tab === "index" ? "/" : groupHref(tab));

/** The array-group layout gets its own segment, `(menu)`; this is the tab it hosts. */
export function tabOfSegment(segment: string): CatererTab {
  const name = segment.replace(/^\((.*)\)$/, "$1");
  return TABS.includes(name) ? (name as CatererTab) : "index";
}

/** The tab a path is the root of ("/" and "/?date=…" are Hari ini), with its query as params; null for any other path. */
export function tabOfPath(path: string): { tab: CatererTab; params?: Record<string, string> } | null {
  const url = new URL(path, "https://catera.invalid");
  const name = url.pathname.replace(/^\/+|\/+$/g, "");
  const tab = name === "" ? "index" : TABS.includes(name) && name !== "index" ? (name as CatererTab) : null;
  if (!tab) return null;
  const params = Object.fromEntries(url.searchParams);
  return Object.keys(params).length ? { tab, params } : { tab };
}

/** A tab root named by its own group: the router cannot resolve it to another tab's copy in the shared folder. */
function groupHref(tab: CatererTab) {
  return tab === "index" ? "/(tabs)/(index)" : `/(tabs)/(${tab})/${tab}`;
}

/** The app path in an OS link: `catera-dapur://pelanggan`, `https://host/pelanggan`, Expo Go's `exp://host/--/menu`. */
function appPathOf(link: string) {
  const url = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(link);
  if (!url) return link;
  const [, scheme, rest] = url;
  if (rest.includes("/--/")) return rest.slice(rest.indexOf("/--/") + 3);
  // A web or Expo Go link names a host first; in an app-scheme link everything after `://` is the path.
  return /^(https?|exps?)$/i.test(scheme) ? rest.replace(/^[^/?#]*/, "") : `/${rest.replace(/^\/+/, "")}`;
}

/**
 * `+native-intent`: an OS link to a bare tab root (`/pelanggan`, `/menu`, `/usaha`, `/`) names that tab's own group.
 * Every tab's stack holds every tab root, and a cold start has no current tab for the router to prefer. Any other link
 * passes through unchanged.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const app = appPathOf(path);
    const root = tabOfPath(app);
    if (!root) return path;
    return `${groupHref(root.tab)}${/[?#].*$/.exec(app)?.[0] ?? ""}`;
  } catch {
    return path;
  }
}

/** A mounted navigator's state, as the container reports it once ready (keys are set). */
type Route = { key: string; name: string; state?: State };
type State = { key: string; index: number; routes: Route[] };
type Container = ReturnType<typeof useNavigationContainerRef>;

let container: Container | null = null;
/** A link that arrived before the tabs were mounted (a cold push tap, read while the session still loads). */
let pending: string | null = null;
/** Stops waiting for the tab bar's first state before a held link opens. */
let stopWaiting: (() => void) | null = null;
/** Nobody is signed in: a link that arrives now is dropped instead of held for whoever signs in next. */
let signedOut = false;

/**
 * The tabs layout registers the navigation container once a signed-in account has its tabs, so a tab change can
 * target each navigator by its key. A link that arrived before then, while the session loaded, opens now.
 */
export function registerNavigation(ref: Container) {
  stopWaiting?.();
  stopWaiting = null;
  container = ref;
  const waiting = pending;
  pending = null;
  if (!waiting) return;
  if (tabsInRoot()) return openLink(waiting);
  // The tab bar reports its first state just after this layout mounts; open the link once the container holds it.
  const stop = ref.addListener("state", () => {
    if (!tabsInRoot()) return;
    stop();
    stopWaiting = null;
    openLink(waiting);
  });
  stopWaiting = stop;
}

/** The tabs unmounting or changing account: forgets the container and drops a held link. */
export function releaseNavigation() {
  stopWaiting?.();
  stopWaiting = null;
  container = null;
  pending = null;
}

/**
 * The session as the root layout sees it. Signed out (after sign-out, or between two accounts), a held link is dropped
 * and new ones are not held, so a tap from one session never opens for whoever signs in next. While the session loads
 * (a cold start), links wait for the tabs.
 */
export function sessionChanged(state: "loading" | "signedIn" | "signedOut") {
  signedOut = state === "signedOut";
  if (signedOut) releaseNavigation();
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
 * Selects a tab, popped to its root, instead of pushing a second copy of it inside the current tab, then closes any
 * screen above the tabs (Impor, Aktifkan) so the tab shows. `params` reach the root screen (Hari ini's `date`). A tab this account may not
 * open (staff: Pelanggan and Usaha) is not in the bar, so nothing changes. With no tabs mounted yet (after signing in)
 * the root replaces the current screen.
 */
export function goToTab(tab: CatererTab, params?: Record<string, string>) {
  const found = tabsInRoot();
  if (!found) {
    const query = params ? `?${new URLSearchParams(params)}` : "";
    router.replace(`${rootHref(tab)}${query}` as never);
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
    // While the session loads, the link waits for the tabs. Signed out, it is dropped: signing in lands on Hari ini.
    if (!signedOut) pending = path;
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
