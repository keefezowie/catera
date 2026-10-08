import type { Locale } from "./index";
import type { SellerDelivery, SellerOperationsState } from "./seller-operations";

/** Kitchen views shared by the caterer app and the web caterer workspace. */
export type KitchenMeal = "lunch" | "dinner";

export type CookingRecap = {
  total: number;
  byPackage: { packageId: string; name: string; portions: number }[];
  byDish: { name: string; category: string; count: number }[];
};

export type Stop = {
  n: number;
  deliveryId: string;
  version: number;
  name: string;
  addressLine: string;
  area: string;
  note: string;
  portions: number;
  packageName: string;
  mapsUrl: string;
};

export type MenuShareDay = {
  date: string;
  lines: { category: string; dishes: string[] }[];
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SHARE_PART_LIMIT = 1800;

const dayNames = {
  id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
const monthNames = {
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** Calendar date (YYYY-MM-DD) in Asia/Jakarta, which has no daylight saving. */
export function jakartaDay(now: Date, offsetDays = 0): string {
  return new Date(now.getTime() + JAKARTA_OFFSET_MS + offsetDays * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * The first day an imported customer can start: orders close at 17.00 Jakarta the day before
 * (the default caterer cutoff), so tomorrow until then and the day after once it has passed.
 */
export function earliestImportStart(now: Date): string {
  const hour = new Date(now.getTime() + JAKARTA_OFFSET_MS).getUTCHours();
  return jakartaDay(now, hour >= 17 ? 2 : 1);
}

export function shortDate(date: string, locale: Locale) {
  const d = new Date(`${date}T00:00:00Z`);
  const day = dayNames[locale][d.getUTCDay()];
  const month = monthNames[locale][d.getUTCMonth()];
  return `${day} ${d.getUTCDate()} ${month}`;
}

function servesMeal(delivery: SellerDelivery, meal: KitchenMeal) {
  if (delivery.status === "cancelled") return false;
  return delivery.meals.some((m) => m.meal === meal && m.status !== "cancelled");
}

export function cookingRecap(state: SellerOperationsState, meal: KitchenMeal): CookingRecap {
  const active = state.deliveries.filter((d) => servesMeal(d, meal));
  const packages = new Map<string, { packageId: string; name: string; portions: number }>();
  for (const d of active) {
    const entry = packages.get(d.offer.id) ?? { packageId: d.offer.id, name: d.offer.name, portions: 0 };
    entry.portions += d.portions;
    packages.set(d.offer.id, entry);
  }

  const dishes = new Map<string, { name: string; category: string; count: number }>();
  const add = (name: string, category: string, count: number) => {
    const key = `${category}\u0000${name}`;
    const entry = dishes.get(key) ?? { name, category, count: 0 };
    entry.count += count;
    dishes.set(key, entry);
  };
  for (const pkg of packages.values()) {
    const offer = active.find((d) => d.offer.id === pkg.packageId)!.offer;
    const dated = state.datedMenus?.find(
      (m) => m.package_id === pkg.packageId && m.service_date === state.operationalDate && m.meal === meal,
    );
    const composition =
      dated?.details.composition ?? offer.menus.find((m) => m.meal === meal)?.composition ?? [];
    const groupName = (groupId?: string) =>
      composition.find((g) => g.id === groupId)?.name ?? "";
    if (dated?.details.items?.length) {
      for (const item of dated.details.items) add(item.name, groupName(item.groupId), pkg.portions);
    } else {
      for (const group of composition)
        add(`${group.name} ×${group.slots}`, group.name, pkg.portions * group.slots);
    }
  }

  return {
    total: [...packages.values()].reduce((sum, p) => sum + p.portions, 0),
    byPackage: [...packages.values()],
    byDish: [...dishes.values()],
  };
}

function mapsUrl(line: string, area: string, city: string) {
  const query = [line, area, city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function deliveryRoute(state: SellerOperationsState, meal: KitchenMeal): Stop[] {
  return state.deliveries
    .filter((d) => servesMeal(d, meal))
    .sort(
      (a, b) =>
        a.address.area.localeCompare(b.address.area, "id") ||
        a.customer.name.localeCompare(b.customer.name, "id"),
    )
    .map((d, i) => ({
      n: i + 1,
      deliveryId: d.id,
      version: d.version,
      name: d.customer.name,
      addressLine: d.address.line,
      area: d.address.area,
      note: d.address.instructions,
      portions: d.portions,
      packageName: d.offer.name,
      mapsUrl: mapsUrl(d.address.line, d.address.area, d.address.city),
    }));
}

function routeHeader(
  stops: Stop[],
  meta: { date: string; meal: KitchenMeal },
  locale: Locale,
  part: number,
) {
  const portions = stops.reduce((sum, s) => sum + s.portions, 0);
  const date = shortDate(meta.date, locale);
  const suffix = part > 1 ? (locale === "en" ? ` (part ${part})` : ` (bagian ${part})`) : "";
  return locale === "en"
    ? `*${meta.meal === "lunch" ? "Lunch" : "Dinner"} run · ${date}*${suffix} (${stops.length} stops, ${portions} portions)`
    : `*Antar ${meta.meal === "lunch" ? "siang" : "malam"} · ${date}*${suffix} (${stops.length} alamat, ${portions} porsi)`;
}

function stopBlock(stop: Stop, locale: Locale) {
  const lines = [
    `${stop.n}. ${stop.name}, ${stop.portions} ${locale === "en" ? "portions" : "porsi"}`,
    [stop.addressLine, stop.area].filter(Boolean).join(", "),
  ];
  if (stop.note) lines.push(`${locale === "en" ? "Note" : "Catatan"}: ${stop.note}`);
  lines.push(stop.mapsUrl);
  return lines.join("\n");
}

/** WhatsApp-ready route text, split into parts short enough for a wa.me link. */
export function routeShareText(
  stops: Stop[],
  meta: { date: string; meal: KitchenMeal; caterer: string },
  locale: Locale,
): string[] {
  const parts: string[] = [];
  let current = routeHeader(stops, meta, locale, 1);
  for (const stop of stops) {
    const block = stopBlock(stop, locale);
    if (current.length + 2 + block.length > SHARE_PART_LIMIT) {
      parts.push(current);
      current = routeHeader(stops, meta, locale, parts.length + 1);
    }
    current += `\n\n${block}`;
  }
  parts.push(current);
  return parts;
}

export function menuShareText(
  days: MenuShareDay[],
  meta: { caterer: string; packageName: string },
  locale: Locale,
): string {
  const header = `*Menu ${meta.caterer} · ${meta.packageName}*`;
  const body = days.map((day) =>
    [
      `*${shortDate(day.date, locale)}*`,
      ...day.lines.map((line) => `${line.category}: ${line.dishes.join(", ")}`),
    ].join("\n"),
  );
  return [header, ...body].join("\n\n");
}

/** A wa.me link; Indonesian numbers starting with 0 become 62. */
export function whatsappUrl(text: string, phone?: string): string {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
