/** Dapur's tabs in bar order. Each is a route group with its own stack: `app/(tabs)/(index,pelanggan,menu,usaha)`. */
export const CATERER_TABS = ["index", "pelanggan", "menu", "usaha"] as const;

export type CatererTab = (typeof CATERER_TABS)[number];

/** Owners run the whole business; helpers see today's lists and menus only. */
export function tabsForRole(role: string | undefined): CatererTab[] {
  if (role === "owner") return [...CATERER_TABS];
  if (role === "staff") return ["index", "menu"];
  return [];
}

/**
 * The tab each pushed screen belongs to. An account opens the screen only when its role has that tab, from a tap, a
 * link or a notification: a helper (staff) has no Pelanggan or Usaha, so no customer, package, team, money, Aktifkan or
 * Impor screen either.
 */
export const SCREEN_TAB = {
  "laporan/[id]": "index",
  "menu/[date]": "menu",
  "pelanggan/[id]": "pelanggan",
  "paket/[id]": "usaha",
  "paket/baru": "usaha",
  tim: "usaha",
  uang: "usaha",
  aktifkan: "usaha",
  impor: "pelanggan",
} as const satisfies Record<string, CatererTab>;
