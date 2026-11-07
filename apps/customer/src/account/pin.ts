import type { GeoPoint } from "@catera/domain";
import type { MobileRuntime } from "@catera/mobile-core";

/**
 * Pins need a Google Maps key baked into the build. Without one the map would draw blank, so the address form and Beli
 * behave as they did before pins: nothing asks for one.
 */
export const mapsEnabled = () => !!process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

/** The point the map screen hands back to the form that opened it, keyed by that form's draft; read once. */
const picked = new Map<string, GeoPoint>();
export const putPin = (key: string, point: GeoPoint) => void picked.set(key, point);
export function takePin(key: string): GeoPoint | null {
  const point = picked.get(key) ?? null;
  picked.delete(key);
  return point;
}

export type PlaceSuggestion = { id: string; title: string; detail: string };

async function places<T>(runtime: MobileRuntime, body: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const token = await runtime.token();
  const response = await fetch(`${runtime.apiBase}/api/places`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: "omit",
    signal,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("PLACES_UNAVAILABLE");
  return response.json() as Promise<T>;
}

export const searchPlaces = (runtime: MobileRuntime, query: string, sessionToken: string, signal?: AbortSignal) =>
  places<{ suggestions: PlaceSuggestion[] }>(runtime, { query, sessionToken }, signal).then((r) => r.suggestions);

export const placeLocation = (runtime: MobileRuntime, placeId: string, sessionToken: string) =>
  places<{ location: GeoPoint }>(runtime, { placeId, sessionToken }).then((r) => r.location);
