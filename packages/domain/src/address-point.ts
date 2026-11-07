import { AREA_RINGS } from "./area-bounds";

export type GeoPoint = { lat: number; lng: number };

/** The pin of an address, when it has one: older and imported addresses only have their written lines. */
export function addressPoint(address: { lat?: number | null; lng?: number | null } | null | undefined): GeoPoint | null {
  const lat = address?.lat;
  const lng = address?.lng;
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** Six decimals is about 11 cm, and matches the database column, so a saved pin reads back unchanged. */
export const roundCoordinate = (n: number) => Math.round(n * 1e6) / 1e6;

/** How far outside an area's edge a pin still counts as inside it: the rings are simplified, and borders run through streets. */
const EDGE_MARGIN_METERS = 1500;

function inRing(ring: number[], { lat, lng }: GeoPoint) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Metres from a point to a ring's nearest edge, on a flat projection: good enough at this scale near the equator. */
function metersToRing(ring: number[], { lat, lng }: GeoPoint) {
  const mx = 111320 * Math.cos((lat * Math.PI) / 180);
  const my = 110574;
  let best = Infinity;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const ax = (ring[j] - lng) * mx;
    const ay = (ring[j + 1] - lat) * my;
    const bx = (ring[i] - lng) * mx;
    const by = (ring[i + 1] - lat) * my;
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** The service area a pin falls in; a pin just outside every area takes the nearest within the margin; else null. */
export function areaAtPoint(point: GeoPoint): string | null {
  let nearest: string | null = null;
  let nearestMeters = EDGE_MARGIN_METERS;
  for (const [area, rings] of Object.entries(AREA_RINGS)) {
    for (const ring of rings) {
      if (inRing(ring, point)) return area;
      const meters = metersToRing(ring, point);
      if (meters <= nearestMeters) {
        nearest = area;
        nearestMeters = meters;
      }
    }
  }
  return nearest;
}

/**
 * Whether a pin agrees with an address's chosen area. Near a border both neighbours fit. An area with no boundary on
 * file (an older free-typed one) cannot be checked, so it fits: coverage at checkout still compares the area's name.
 */
export function pointFitsArea(point: GeoPoint, area: string): boolean {
  const rings = AREA_RINGS[area];
  if (!rings) return true;
  return rings.some((ring) => inRing(ring, point) || metersToRing(ring, point) <= EDGE_MARGIN_METERS);
}

/** Where the map opens for a chosen area, and for no area at all: the middle of that area, or central Jakarta. */
export function areaCenter(area?: string | null): GeoPoint {
  const ring = (area && AREA_RINGS[area]?.[0]) || AREA_RINGS["Jakarta Pusat"][0];
  let lat = 0;
  let lng = 0;
  for (let i = 0; i < ring.length; i += 2) {
    lng += ring[i];
    lat += ring[i + 1];
  }
  const n = ring.length / 2;
  return { lat: roundCoordinate(lat / n), lng: roundCoordinate(lng / n) };
}

/** The city a new address starts with once its pin names the area; the customer can still change it. */
export const AREA_CITY: Record<string, string> = {
  "Jakarta Selatan": "Jakarta",
  "Jakarta Pusat": "Jakarta",
  "Jakarta Barat": "Jakarta",
  "Jakarta Timur": "Jakarta",
  "Jakarta Utara": "Jakarta",
  "Tangerang Selatan": "Tangerang Selatan",
  Bandung: "Bandung",
};
