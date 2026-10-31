import * as SecureStore from "expo-secure-store";

/** A favourite lauk picked in the first-run onboarding. Kept on this phone only. */
export type LaukPref = "ayam" | "ikan" | "daging" | "sayur" | "pedas" | "tanpa-santan";

/** Every lauk, in the order the picker shows them. */
export const LAUK_PREFS: readonly LaukPref[] = ["ayam", "ikan", "daging", "sayur", "pedas", "tanpa-santan"];

/** The picker takes up to three. */
export const MAX_LAUK = 3;

/** Same naming as the area key (`catera.area`): one plain key on the phone. */
export const LAUK_KEY = "catera.lauk";

/**
 * Whether Jelajah really sorts by these picks (spec ruling 5). The lauk step only promises the sorting while this is
 * true; otherwise it says "Kami ingat pilihanmu." Flip it when Jelajah's keyword sort lands.
 */
export const LAUK_SORTS_JELAJAH = true;

const known = (value: unknown): value is LaukPref => LAUK_PREFS.includes(value as LaukPref);

/** The kept picks, in the order they were chosen; [] when none were kept or the stored value is unreadable. */
export async function readLaukPrefs(): Promise<LaukPref[]> {
  try {
    const raw = await SecureStore.getItemAsync(LAUK_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? [...new Set(parsed.filter(known))].slice(0, MAX_LAUK) : [];
  } catch {
    return [];
  }
}

/** Keeps the picks (at most three, unknown values dropped). A failed write is silent: the picks are a nicety. */
export async function saveLaukPrefs(prefs: readonly LaukPref[]): Promise<void> {
  const clean = [...new Set(prefs.filter(known))].slice(0, MAX_LAUK);
  await SecureStore.setItemAsync(LAUK_KEY, JSON.stringify(clean)).catch(() => undefined);
}

/** Adds or removes one pick. A fourth pick is refused: the list comes back unchanged. */
export function toggleLauk(list: readonly LaukPref[], pref: LaukPref): LaukPref[] {
  if (list.includes(pref)) return list.filter((p) => p !== pref);
  return list.length >= MAX_LAUK ? [...list] : [...list, pref];
}

/** The lauk's name as the picker and the loader print it. */
export function laukName(pref: LaukPref, t: (id: string, en: string) => string): string {
  switch (pref) {
    case "ayam":
      return t("Ayam", "Chicken");
    case "ikan":
      return t("Ikan", "Fish");
    case "daging":
      return t("Daging", "Meat");
    case "sayur":
      return t("Sayur", "Vegetables");
    case "pedas":
      return t("Pedas", "Spicy");
    case "tanpa-santan":
      return t("Tanpa santan", "No coconut milk");
  }
}
