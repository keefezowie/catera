import { useEffect } from "react";
import { router, useNavigation, useRoute, type useNavigationContainerRef } from "expo-router";
import { nativeMotion } from "@catera/design-tokens";
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
export const FLOW_HREF = {
  alamat: "/pembelian/alamat",
  bantuan: "/pembelian/bantuan",
  /** The address form sheet over the purchase (the tabs have `/alamat-form`). */
  alamatForm: "/pembelian/alamat-form",
  /** The help form sheet over the purchase (the tabs have `/bantuan-form`). */
  bantuanForm: "/pembelian/bantuan-form",
} as const;

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

/**
 * A sheet route a link can reach, and the page it opens over, never alone:
 * - Ada masalah (`/masalah/{id}`) and Ubah hari (`/ubah-hari/{id}`) sit over the Hari of their delivery (`/hari/{id}`).
 * - Pengaturan's choice sheets (`/pengaturan/bahasa`, `/pengaturan/tampilan`) sit over Pengaturan.
 * - The address form (`/alamat-form`) sits over Alamat; the help form (`/bantuan-form`) over Bantuan; the request to
 *   delete the account (`/hapus-akun`) over Data akun.
 * - The review (`/ulasan/{id}`) sits over Beranda ("/"), and the area choice (`/area`) over Jelajah ("/jelajah"): a tab
 *   root, which is selected rather than pushed.
 * Null for any other path. A query stays with the sheet, never the parent.
 */
export function sheetParent(path: string): string | null {
  const at = pathname(path);
  const day = /^\/(?:masalah|ubah-hari)\/([^/?#]+)\/?$/.exec(at);
  if (day) return `/hari/${day[1]}`;
  if (/^\/pengaturan\/(bahasa|tampilan)\/?$/.test(at)) return "/pengaturan";
  if (/^\/alamat-form\/?$/.test(at)) return "/alamat";
  if (/^\/bantuan-form\/?$/.test(at)) return "/bantuan";
  if (/^\/hapus-akun\/?$/.test(at)) return "/data-akun";
  if (/^\/ulasan\/[^/?#]+\/?$/.test(at)) return "/";
  if (/^\/area\/?$/.test(at)) return "/jelajah";
  return null;
}

/**
 * The form sheets that live in the root stack (`app/hari`, `app/masalah`, `app/ubah-hari`, `app/ulasan`,
 * `app/alamat-form`, `app/bantuan-form`, `app/hapus-akun`), not in a tab's stack. A tab-stack sheet is drawn inside the
 * tab host on Android, where the dimming view takes TalkBack's first focus and the tab bar covers the form (the day
 * sheet's actions sat under it). Their URLs did not change.
 */
export function isRootSheet(path: string): boolean {
  return /^\/(?:(?:hari|masalah|ubah-hari|ulasan)\/[^/?#]+|alamat-form|bantuan-form|hapus-akun)\/?$/.test(pathname(path));
}

/**
 * The day sheet (`/hari/{id}`): a root-stack form sheet that opens over the screen in front, in any tab. Opened cold it
 * has no tab under it, so Beranda opens first (`coldParent`).
 */
export const isDaySheet = (path: string) => /^\/hari\/[^/?#]+\/?$/.test(pathname(path));

/** Where a sheet route opens from when no tabs are mounted yet: its parent page, or Beranda for the day sheet. */
const coldParent = (path: string) => sheetParent(path) ?? (isDaySheet(path) ? "/" : null);

/** The array-group layout gets its own segment, `(jadwal)`; this is the tab it hosts. */
export function tabOfSegment(segment: string): Tab {
  const name = segment.replace(/^\((.*)\)$/, "$1");
  return (TABS as readonly string[]).includes(name) ? (name as Tab) : "index";
}

/** Where a sheet's parent opens from outside the tabs: a tab root by its group (`ROOT_HREF`), any other page as is. */
const parentHref = (parent: string) => {
  const tab = tabOfPath(parent);
  // A day sheet has no tab of its own to open as a parent: Beranda is opened and the sheets open over it.
  return tab ? ROOT_HREF[tab] : isDaySheet(parent) ? ROOT_HREF.index : parent;
};

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
/** Counts the navigation state changes, so a push can tell whether the router has shown the one before it yet. */
let stateTick = 0;
/** The last sheet `pushSheet` pushed, and the state count when it did. */
let lastSheet: { href: string; tick: number; at: number } | null = null;

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
  const stop = ref.addListener("state", () => {
    stateTick += 1;
    flush();
  });
  flush();
  return () => {
    stop();
    waiting?.();
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
 *
 * `everyTab` pops every tab to its root, not only this one: Pengaturan's Keluar uses it, so nothing the last account had
 * open stays stacked (Akun reopens on its sign-in prompt, not on a signed-out Pengaturan). Otherwise the other tabs keep
 * their place.
 */
export function goToTab(tab: Tab, { everyTab = false }: { everyTab?: boolean } = {}) {
  const found = tabsInRoot();
  if (!found) {
    router.replace(ROOT_HREF[tab] as never);
    return;
  }
  const { tabs } = found;
  const group = `(${tab})`;
  // A tab not opened yet has a partial state with no key: it starts at its root when it mounts.
  for (const route of tabs.routes) {
    if (!everyTab && route.name !== group) continue;
    const stack = route.state;
    if (stack?.key && stack.routes.length > 1) container!.dispatch({ type: "POP_TO_TOP", target: stack.key });
  }
  if (tabs.routes[tabs.index]?.name !== group) container!.dispatch({ type: "JUMP_TO", payload: { name: group }, target: tabs.key });
  dismissAboveTabs(found);
}

/** Whether the top of a tab's stack is the page `parent` names (`/hari/{id}`). A tab not mounted yet reads as empty. */
function onTop(found: { tabs: State }, group: string, parent: string): boolean {
  const routes = found.tabs.routes.find((r) => r.name === group)?.state?.routes ?? [];
  const top = routes.at(-1) as (Route & { params?: { id?: unknown } }) | undefined;
  // A page with no id is named by its path (`/pengaturan`, `/pengaturan/bahasa`).
  const bare = parent.replace(/^\/+|\/+$/g, "");
  if (top?.name === bare) return true;
  const [section, id, ...more] = bare.split("/");
  if (id === undefined || more.length) return false;
  let wanted = id;
  try {
    wanted = decodeURIComponent(id);
  } catch {
    // A malformed escape names the id as written.
  }
  return top?.name === `${section}/[id]` && top.params?.id === wanted;
}

/** Opens a screen that lives in the tabs in the selected tab, after closing the screens above the tabs, so it never
 * lands in a second tab bar above Beli or Bayar. Named with the tab's group, so it opens there even while they close.
 * A sheet route opens over its parent page (`sheetParent`), which opens first unless it is already on top. A choice
 * sheet of the tab already on top is replaced with the link's params, so signing in never stacks a second page and sheet
 * over the first; a root form sheet (`isRootSheet`) closes with the screens above the tabs and opens again. */
function openInTab(found: { root: State; at: number; tabs: State }, path: string) {
  dismissAboveTabs(found);
  // A form with typed text holds its own removal (`useUnsavedGuard`): the pop did not happen and the discard question is
  // up. The link waits for that answer instead of opening its page behind the sheet.
  const after = tabsInRoot();
  if (after && after.root.index > after.at) return openWhenClear(path);
  // The day is a sheet over whatever is in front, in any tab; the screens above the tabs have just closed.
  if (isDaySheet(path)) return router.push(path as never);
  const group = found.tabs.routes[found.tabs.index]?.name ?? "(index)";
  const inTab = (href: string) => `/(tabs)/${group}${href.startsWith("/") ? href : `/${href}`}` as never;
  const parent = sheetParent(path);
  // A sheet over a tab root (the review over Beranda, the area over Jelajah) opens in that tab, at its root.
  const parentTab = parent ? tabOfPath(parent) : null;
  if (parentTab) {
    goToTab(parentTab);
    return router.push((isRootSheet(path) ? path : `/(tabs)/(${parentTab})${path.startsWith("/") ? path : `/${path}`}`) as never);
  }
  // A form sheet lives in the root stack: its parent page opens in the tab first, the sheet above the tabs. One that
  // was already open (Ada masalah that sent the person to Masuk) went with the screens above the tabs just now.
  if (parent && isRootSheet(path)) {
    // Ada masalah and Ubah hari sit over the day sheet, itself a root sheet: it closed with the screens above the tabs and
    // opens again under them. Any other parent page opens in the tab.
    if (isDaySheet(parent)) router.push(parent as never);
    else if (!onTop(found, group, parent)) router.push(inTab(parent));
    return router.push(path as never);
  }
  if (parent && onTop(found, group, pathname(path))) return router.replace(inTab(path));
  if (parent && !onTop(found, group, parent)) router.push(inTab(parent));
  router.push(inTab(path));
}

/** How long a link waits for a held sheet to go once the discard question has closed (the iOS sheet slides away first). */
export const LINK_WAIT_MS = 1000;
/** The longest a link waits for a held sheet, whatever the navigation does meanwhile. */
export const LINK_WAIT_LIMIT_MS = 60_000;

/** The link waiting for a held sheet to go: one at a time, a newer link replaces it. */
let waiting: (() => void) | null = null;

/**
 * Opens `path` once nothing is above the tabs. It gives up when the held sheet is kept instead (the discard question came
 * and went, and the sheet is still up), so a link never opens later, out of the blue, when that sheet finally closes.
 */
function openWhenClear(path: string) {
  waiting?.();
  const ref = container;
  if (!ref) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // However it ends, a link never waits for ever: a sheet that stays up is the person's to close.
  const hard = setTimeout(() => give(), LINK_WAIT_LIMIT_MS);
  const stop = ref.addListener("state", () => {
    const found = tabsInRoot();
    if (!found) return give();
    const top = found.root.routes[found.root.index]?.name;
    if (found.root.index === found.at) {
      give();
      return openInTab(found, path);
    }
    // The question is up (`konfirmasi`). Once it is gone with the sheet still there, either the person kept writing, or
    // they discarded and the sheet is about to go (on iOS it goes after the confirm has slid away): wait for that.
    clearTimeout(timer);
    timer = top === "konfirmasi" ? undefined : setTimeout(give, LINK_WAIT_MS);
  });
  function give() {
    clearTimeout(timer);
    clearTimeout(hard);
    stop();
    if (waiting === give) waiting = null;
  }
  waiting = give;
}

/**
 * Closes the sheet the person is on and opens `path` in the tab beneath it, the way a link would (Ada masalah offering
 * Bantuan). A tab-less `router.push` would resolve in whichever tab group declares the path first. If the sheet holds its
 * own closing for unsaved text, the page opens after the person discards.
 */
export function closeSheetFor(path: string) {
  // One step: `openLink` pops the screens above the tabs itself. A `router.back()` before it would still be pending
  // when it reads the stack, and pop the page under the sheet as well.
  openLink(path);
}

/** Whether a sheet's parent page is the one in front now, so a return from Masuk can open the sheet over it again. */
function parentOpen(found: { tabs: State }, path: string): boolean {
  const parent = sheetParent(path);
  if (!parent) return true;
  // The day sheet is a root route: it is "open" while it is anywhere in the root stack (Masuk sits above it).
  if (isDaySheet(parent)) {
    const raw = pathname(parent).split("/")[2] ?? "";
    let id = raw;
    try {
      id = decodeURIComponent(raw);
    } catch {
      // A malformed escape names the id as written, as in `onTop`.
    }
    return !!appStack()?.routes.some((r) => r.name === "hari/[id]" && (r as Route & { params?: { id?: unknown } }).params?.id === id);
  }
  const group = found.tabs.routes[found.tabs.index]?.name ?? "(index)";
  const tab = tabOfPath(parent);
  return tab ? group === `(${tab})` : onTop(found, group, parent);
}

/** The root-stack sheet on top now, if it is the one `href` names (same route, same id and query). */
function sameSheetOnTop(href: string): boolean {
  const root = appStack();
  const top = root?.routes[root.index] as (Route & { params?: Record<string, unknown> }) | undefined;
  if (!top) return false;
  const [path, query = ""] = href.split("?");
  const [section, ...rest] = path.replace(/^\/+|\/+$/g, "").split("/");
  if (top.name !== (rest.length ? `${section}/[id]` : section)) return false;
  const wanted: Record<string, string> = Object.fromEntries(new URLSearchParams(query));
  if (rest.length) {
    try {
      wanted.id = decodeURIComponent(rest.join("/"));
    } catch {
      wanted.id = rest.join("/");
    }
  }
  return Object.entries(wanted).every(([key, value]) => String(top.params?.[key]) === value);
}

/** Pushes a root-stack form sheet unless that same sheet is already on top, so a double tap opens one. */
export function pushSheet(href: string) {
  // The same sheet again before the router has shown the first push (a double tap in one frame) is the same tap.
  if (container && lastSheet?.href === href && lastSheet.tick === stateTick && Date.now() - lastSheet.at < nativeMotion.content) return;
  if (sameSheetOnTop(href)) return;
  router.push(href as never);
  // Remembered only once the push went through, so a push that threw cannot block the next tap.
  lastSheet = { href, tick: stateTick, at: Date.now() };
}

/**
 * An OS link (a cold or warm deep link) to a tab root opens that tab. Without this, "/jadwal" opened cold resolves to the
 * first group that has a jadwal route, so Jadwal would open inside Beranda. /discover is Jelajah. Other paths pass
 * through without their `title`: anyone can craft an OS link, so only links the app builds may name a screen before its
 * record loads. A detail screen opened cold lands in Beranda, the first tab, with Beranda behind it. A sheet route opened
 * cold (`initial`) opens its parent page instead, and the sheet waits until the tabs are up to open over it.
 */
export function systemPath(link: string, initial = false): string {
  const url = withoutLinkTitle(link);
  // exp://127.0.0.1:8084/--/jadwal names the path after a host (Expo Go adds "/--"); catera://jadwal has no host.
  const hosted = /^(exps?|https?):\/\/[^/?#]*/i;
  const path = (hosted.test(url) ? url.replace(hosted, "").replace(/^\/--(?=[/?#]|$)/, "") : url.replace(/^[a-z][\w+.-]*:\/\//i, "/"))
    .replace(/^\/*/, "/");
  const tab = tabOfPath(path) ?? LEGACY_ROOTS[pathname(path).slice(1).replace(/\/+$/, "")] ?? null;
  // "/" already opens Beranda: it is the first tab.
  if (tab) return tab !== "index" ? ROOT_HREF[tab] : url;
  const parent = initial ? coldParent(path) : null;
  if (parent) {
    pending = path;
    return parentHref(parent);
  }
  return url;
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
  if (found) {
    // Back from Masuk: a form sheet opens again only over the page that opened it, never a new page over Beranda.
    // Masuk (and whatever sheet asked for it) still close: only the re-push is skipped.
    if (isRootSheet(path) && !parentOpen(found, path)) return dismissAboveTabs(found);
    return openInTab(found, path);
  }
  // With no tabs under it, a sheet route opens its parent page in Beranda and then itself, once the tabs are up.
  const parent = coldParent(path);
  if (parent) pending = path;
  router.replace((parent ? parentHref(parent) : path) as never, { withAnchor: true });
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
