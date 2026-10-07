export type CatererTab = "index" | "pelanggan" | "menu" | "usaha";

/** Owners run the whole business; helpers see today's lists and menus only. */
export function tabsForRole(role: string | undefined): CatererTab[] {
  if (role === "owner") return ["index", "pelanggan", "menu", "usaha"];
  if (role === "staff") return ["index", "menu"];
  return [];
}
