import { parsedWindowStart } from "./windows";
import type { DeliveryIssue, DeliveryMeal, Locale } from "./index";
import { mealJourney, type Journey, type JourneyStage } from "./journey";
import { destinationKey, type SellerDelivery, type SellerOperationsState } from "./seller-operations";

/** Kitchen views shared by the caterer app and the web caterer workspace. */
export type KitchenMeal = "lunch" | "dinner";

export type CookingRecap = {
  total: number;
  byPackage: { packageId: string; name: string; portions: number }[];
  /** `image` is the dish photo the caterer attached, or "" when there is none. */
  byDish: { name: string; category: string; count: number; image: string }[];
  /** Menu slots nobody has filled yet, per package and category. They are not dishes: do not list them as such. */
  unfilled: { packageId: string; packageName: string; group: string; slots: number; portions: number }[];
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

  const dishes = new Map<string, CookingRecap["byDish"][number]>();
  const add = (name: string, category: string, count: number, image: string) => {
    const key = `${category}\u0000${name}`;
    const entry = dishes.get(key) ?? { name, category, count: 0, image: "" };
    entry.count += count;
    entry.image ||= image;
    dishes.set(key, entry);
  };
  const unfilled: CookingRecap["unfilled"] = [];
  for (const pkg of packages.values()) {
    const offer = active.find((d) => d.offer.id === pkg.packageId)!.offer;
    const dated = state.datedMenus?.find(
      (m) => m.package_id === pkg.packageId && m.service_date === state.operationalDate && m.meal === meal,
    );
    const composition =
      dated?.details.composition ?? offer.menus.find((m) => m.meal === meal)?.composition ?? [];
    const groupName = (groupId?: string) =>
      composition.find((g) => g.id === groupId)?.name ?? "";
    const items = dated?.details.items ?? [];
    for (const item of items) add(item.name, groupName(item.groupId), pkg.portions, item.image ?? "");
    for (const group of composition) {
      const missing = group.slots - items.filter((i) => i.groupId === group.id).length;
      if (missing > 0)
        unfilled.push({
          packageId: pkg.packageId,
          packageName: pkg.name,
          group: group.name,
          slots: missing,
          portions: pkg.portions * missing,
        });
    }
  }

  return {
    total: [...packages.values()].reduce((sum, p) => sum + p.portions, 0),
    byPackage: [...packages.values()],
    byDish: [...dishes.values()],
    unfilled,
  };
}

/**
 * When the meal's first delivery window opens ("HH.MM", Jakarta), across the day's active deliveries of that meal;
 * null when there are none. Only a window the caterer actually set counts (`parsedWindowStart`): the 11.00 and 17.00
 * fallbacks that order rows are not shown as if they were the caterer's hours.
 */
export function sessionStart(state: SellerOperationsState, meal: KitchenMeal): string | null {
  const starts = state.deliveries
    .filter((d) => servesMeal(d, meal))
    .map((d) => parsedWindowStart(d.offer, meal))
    .filter((minutes): minutes is number => minutes !== null);
  if (!starts.length) return null;
  const first = Math.min(...starts);
  return `${String(Math.floor(first / 60)).padStart(2, "0")}.${String(first % 60).padStart(2, "0")}`;
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

/** The most stops one Google Maps directions link takes: ten, the last being the destination. */
const MAPS_STOP_LIMIT = 10;
const KITCHEN_MEALS: KitchenMeal[] = ["lunch", "dinner"];
const STAGES: JourneyStage[] = ["scheduled", "preparing", "out_for_delivery", "delivered"];

/** The directions link for the first ten stops, in route order; null for none. `count` is how many it opens. */
export function routeMapsUrl(stops: Stop[]): { url: string; count: number } | null {
  // Each address is the one the stop's own search link carries (line, area, city); without it, line and area.
  // A stop with no address at all cannot be routed to, so it takes no place among the ten.
  const queries = stops
    .map(
      (stop) =>
        /[?&]query=([^&]*)/.exec(stop.mapsUrl)?.[1] ||
        encodeURIComponent([stop.addressLine, stop.area].filter(Boolean).join(", ")),
    )
    .filter(Boolean)
    .slice(0, MAPS_STOP_LIMIT);
  if (!queries.length) return null;
  const waypoints = queries.slice(0, -1);
  const url =
    `https://www.google.com/maps/dir/?api=1&destination=${queries[queries.length - 1]}` +
    (waypoints.length ? `&waypoints=${waypoints.join("%7C")}` : "");
  return { url, count: queries.length };
}

export type KitchenSession = {
  meal: KitchenMeal;
  /** The session's stage is its least advanced active row; times are the earliest of those rows. */
  journey: Journey;
  portions: number;
  addresses: number;
  /** "Mulai masak": today only, while any active row is still scheduled. */
  canCook: boolean;
  /** "Berangkat antar": today only, once no active row is scheduled and some row is preparing. */
  canDepart: boolean;
  recap: CookingRecap;
  stops: Stop[];
};

const mealOf = (d: SellerDelivery, meal: KitchenMeal): DeliveryMeal | undefined =>
  d.meals.find((m) => m.meal === meal);

/** The earliest (or latest) readable timestamp, or null when none is. */
function pickTime(values: (string | null)[], order: "earliest" | "latest"): string | null {
  let best: string | null = null;
  let bestAt = 0;
  for (const value of values) {
    const at = value ? Date.parse(value) : Number.NaN;
    if (Number.isNaN(at)) continue;
    if (best === null || (order === "earliest" ? at < bestAt : at > bestAt)) {
      best = value;
      bestAt = at;
    }
  }
  return best;
}

/**
 * One meal of the day as the kitchen runs it. Rows marked "Gagal diantar" or cancelled are left
 * out; null when no active row remains.
 */
export function kitchenSession(state: SellerOperationsState, meal: KitchenMeal, now: Date): KitchenSession | null {
  const active = state.deliveries.filter((d) => servesMeal(d, meal) && mealOf(d, meal)?.status !== "issue");
  const rows = active.map((d) => ({ d, journey: mealJourney(mealOf(d, meal)!) }));
  if (!rows.length) return null;
  // The count card and the checklist read the same rows as the portions and addresses above them.
  const activeState = { ...state, deliveries: active };
  const journeys = rows.map((r) => r.journey);
  const stage = journeys.reduce<JourneyStage>(
    (least, j) => (STAGES.indexOf(j.stage) < STAGES.indexOf(least) ? j.stage : least),
    "delivered",
  );
  const arrivedBy = journeys.map((j) => j.arrivedBy);
  const today = state.operationalDate === jakartaDay(now);
  const scheduled = journeys.some((j) => j.stage === "scheduled");
  return {
    meal,
    journey: {
      stage,
      cookingAt: pickTime(journeys.map((j) => j.cookingAt), "earliest"),
      departedAt: pickTime(journeys.map((j) => j.departedAt), "earliest"),
      arrivedAt: stage === "delivered" ? pickTime(journeys.map((j) => j.arrivedAt), "latest") : null,
      arrivedBy:
        stage !== "delivered"
          ? null
          : arrivedBy.every((by) => by === "auto")
            ? "auto"
            : (arrivedBy.find((by) => by && by !== "auto") ?? null),
      issue: false,
    },
    portions: rows.reduce((sum, r) => sum + r.d.portions, 0),
    addresses: new Set(rows.map((r) => destinationKey(r.d.address))).size,
    canCook: today && scheduled,
    canDepart: today && !scheduled && journeys.some((j) => j.stage === "preparing"),
    recap: cookingRecap(activeState, meal),
    stops: deliveryRoute(activeState, meal),
  };
}

/**
 * Whether the day is finished: it is today, it has a non-cancelled row, every one is delivered or
 * marked "Gagal diantar" (a final outcome for the kitchen), and no report for that date is still
 * open. A day shown for another date is never done.
 */
export function kitchenDayDone(state: SellerOperationsState, issues: DeliveryIssue[], now: Date): boolean {
  if (state.operationalDate !== jakartaDay(now)) return false;
  const statuses = KITCHEN_MEALS.flatMap((meal) =>
    state.deliveries.filter((d) => servesMeal(d, meal)).map((d) => mealOf(d, meal)!.status),
  );
  if (!statuses.length || statuses.some((status) => status !== "delivered" && status !== "issue")) return false;
  return !issues.some((i) => i.service_date === state.operationalDate && i.status !== "resolved");
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
