import { z } from "zod";
import { session } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/request-origin";

const body = z.union([
  z.object({ query: z.string().trim().min(3).max(120), sessionToken: z.string().min(8).max(64) }).strict(),
  z.object({ placeId: z.string().regex(/^[A-Za-z0-9_-]{1,512}$/), sessionToken: z.string().min(8).max(64) }).strict(),
]);

const codes: Record<string, number> = { UNAUTHORIZED: 401, INVALID_INPUT: 400, PLACES_DISABLED: 503, PLACES_UNAVAILABLE: 503 };
const fail = (code: string) => Response.json({ error: { code } }, { status: codes[code] ?? 503, headers: { "Cache-Control": "no-store" } });
const ok = (data: unknown) => Response.json(data, { headers: { "Cache-Control": "no-store" } });

type Autocomplete = {
  suggestions?: { placePrediction?: { placeId?: string; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }[];
};
type Details = { location?: { latitude?: number; longitude?: number } };

/**
 * Signed-in customers only: address search for the map pin. The key stays on the server and its quota in Google Cloud is
 * the spending limit. A search only moves the map; the customer's own confirmed point is what gets saved.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const s = await session(request);
    if (!s.actor) return fail("UNAUTHORIZED");
    const key = process.env.GOOGLE_MAPS_SERVER_KEY;
    if (!key) return fail("PLACES_DISABLED");
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("INVALID_INPUT");
    const headers = { "Content-Type": "application/json", "X-Goog-Api-Key": key };
    if ("query" in parsed.data) {
      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { ...headers, "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat" },
        body: JSON.stringify({
          input: parsed.data.query,
          sessionToken: parsed.data.sessionToken,
          includedRegionCodes: ["id"],
          languageCode: "id",
          regionCode: "id",
        }),
      });
      if (!response.ok) return fail("PLACES_UNAVAILABLE");
      const data = (await response.json()) as Autocomplete;
      return ok({
        suggestions: (data.suggestions ?? []).flatMap((item) => {
          const place = item.placePrediction;
          return place?.placeId
            ? [{ id: place.placeId, title: place.structuredFormat?.mainText?.text ?? "", detail: place.structuredFormat?.secondaryText?.text ?? "" }]
            : [];
        }),
      });
    }
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(parsed.data.placeId)}?sessionToken=${encodeURIComponent(parsed.data.sessionToken)}`,
      { headers: { ...headers, "X-Goog-FieldMask": "location" } },
    );
    if (!response.ok) return fail("PLACES_UNAVAILABLE");
    const { location } = (await response.json()) as Details;
    if (typeof location?.latitude !== "number" || typeof location.longitude !== "number") return fail("PLACES_UNAVAILABLE");
    return ok({ location: { lat: location.latitude, lng: location.longitude } });
  } catch (e) {
    console.error("places failed", { name: e instanceof Error ? e.name : "unknown" });
    return fail("PLACES_UNAVAILABLE");
  }
}
