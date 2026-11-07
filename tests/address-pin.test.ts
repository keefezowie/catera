import { describe, expect, it } from "vitest";
import {
  addressPoint,
  addressSchema,
  areaAtPoint,
  areaCenter,
  areaOptions,
  deliveryRoute,
  pointFitsArea,
  routeMapsUrl,
  routeShareText,
  type SellerOperationsState,
} from "@catera/domain";

const BLOK_M = { lat: -6.2441, lng: 106.7992 }; // Jakarta Selatan
const MONAS = { lat: -6.1754, lng: 106.8272 }; // Jakarta Pusat
const DAGO = { lat: -6.885, lng: 107.6136 }; // Bandung
const BEKASI = { lat: -6.2383, lng: 107.0 }; // outside every service area
const SURABAYA = { lat: -7.2575, lng: 112.7521 };

describe("areaAtPoint", () => {
  it("names the area a pin falls in", () => {
    expect(areaAtPoint(BLOK_M)).toBe("Jakarta Selatan");
    expect(areaAtPoint(MONAS)).toBe("Jakarta Pusat");
    expect(areaAtPoint(DAGO)).toBe("Bandung");
  });
  it("names no area for a pin outside the service", () => {
    expect(areaAtPoint(BEKASI)).toBeNull();
    expect(areaAtPoint(SURABAYA)).toBeNull();
  });
  it("has a boundary for every area a customer can choose, and each area's centre opens the map inside the country", () => {
    for (const area of areaOptions) {
      const c = areaCenter(area);
      expect(c.lat).toBeLessThan(0);
      expect(pointFitsArea(c, area)).toBe(true);
    }
  });
});

describe("pointFitsArea", () => {
  it("refuses a chosen area the pin is far from", () => {
    expect(pointFitsArea(BEKASI, "Jakarta Selatan")).toBe(false);
    expect(pointFitsArea(DAGO, "Jakarta Pusat")).toBe(false);
  });
  it("accepts either neighbour near a shared border", () => {
    const border = { lat: -6.2285, lng: 106.81 }; // Near where Jakarta Selatan meets Jakarta Pusat.
    expect(pointFitsArea(border, "Jakarta Selatan")).toBe(true);
    expect(pointFitsArea(border, "Jakarta Pusat")).toBe(true);
  });
  it("cannot check an area with no boundary on file", () => {
    expect(pointFitsArea(BEKASI, "Bekasi")).toBe(true);
  });
});

describe("addressSchema", () => {
  const base = { label: "Rumah", line: "Jl. Contoh 12", area: "Jakarta Selatan", city: "Jakarta" };
  it("still saves without a pin, for older app builds", () => {
    expect(addressSchema.safeParse(base).success).toBe(true);
  });
  it("keeps a pin that agrees with the area", () => {
    const parsed = addressSchema.parse({ ...base, ...BLOK_M });
    expect(addressPoint(parsed)).toEqual(BLOK_M);
  });
  it("refuses half a pin, a pin outside Indonesia and a pin outside the chosen area", () => {
    expect(addressSchema.safeParse({ ...base, lat: BLOK_M.lat }).success).toBe(false);
    expect(addressSchema.safeParse({ ...base, lat: 51.5, lng: -0.1 }).success).toBe(false);
    expect(addressSchema.safeParse({ ...base, ...BEKASI }).success).toBe(false);
  });
});

describe("driver links", () => {
  const delivery = (id: string, name: string, address: Record<string, unknown>) => ({
    id,
    version: 1,
    customer: { name },
    address: { id: `a-${id}`, label: "Rumah", line: "Jl. Contoh 12", area: "Jakarta Selatan", city: "Jakarta", instructions: "", version: 1, ...address },
    offer: { name: "Paket", meal: "lunch" },
    portions: 1,
    meals: [{ meal: "lunch", status: "scheduled" }],
    status: "scheduled",
  });
  const state = (...deliveries: ReturnType<typeof delivery>[]) => ({ deliveries }) as unknown as SellerOperationsState;

  it("goes to the customer's pin, and marks the stop as pinned", () => {
    const [stop] = deliveryRoute(state(delivery("1", "Rina", BLOK_M)), "lunch");
    expect(stop.pinned).toBe(true);
    expect(stop.mapsUrl).toBe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("-6.2441,106.7992")}`);
  });
  it("falls back to the written address on a delivery with no pin", () => {
    const [stop] = deliveryRoute(state(delivery("1", "Rina", {})), "lunch");
    expect(stop.pinned).toBe(false);
    expect(stop.mapsUrl).toContain(encodeURIComponent("Jl. Contoh 12, Jakarta Selatan, Jakarta"));
  });
  it("carries pins into the route link and the text sent to the driver, next to stops without one", () => {
    const stops = deliveryRoute(state(delivery("1", "Andi", BLOK_M), delivery("2", "Budi", {})), "lunch");
    const route = routeMapsUrl(stops)!;
    expect(route.url).toContain(encodeURIComponent("-6.2441,106.7992"));
    expect(route.url).toContain(encodeURIComponent("Jl. Contoh 12"));
    const text = routeShareText(stops, { date: "2026-11-09", meal: "lunch", caterer: "Dapur" }, "id").join("\n");
    expect(text).toContain(encodeURIComponent("-6.2441,106.7992"));
    // The written address stays beside the link: the pin says where, the words say which door.
    expect(text).toContain("Jl. Contoh 12");
  });
});
