import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.fn();
vi.mock("@/lib/auth", () => ({ session: (...args: unknown[]) => session(...args) }));
vi.mock("@/lib/request-origin", () => ({ assertSameOrigin: () => undefined }));

const { POST } = await import("../apps/web/src/app/api/places/route");
const call = (body: unknown) => POST(new Request("https://catera.test/api/places", { method: "POST", body: JSON.stringify(body) }));
const google = vi.fn();

beforeEach(() => {
  session.mockReset().mockResolvedValue({ actor: { id: "u", role: "customer" }, token: "t", id: "u" });
  google.mockReset();
  vi.stubGlobal("fetch", google);
  process.env.GOOGLE_MAPS_SERVER_KEY = "server-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_MAPS_SERVER_KEY;
});

const search = { query: "Senopati", sessionToken: "session-token" };

describe("/api/places", () => {
  it("is for signed-in people, and asks Google nothing for anyone else", async () => {
    session.mockResolvedValue({ actor: null, token: null, id: null });
    expect((await call(search)).status).toBe(401);
    expect(google).not.toHaveBeenCalled();
  });
  it("answers disabled with no key, so the app offers dragging instead", async () => {
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
    const r = await call(search);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: { code: "PLACES_DISABLED" } });
  });
  it("refuses short queries and unknown fields without spending a call", async () => {
    expect((await call({ query: "ab", sessionToken: "session-token" })).status).toBe(400);
    expect((await call({ ...search, extra: 1 })).status).toBe(400);
    expect(google).not.toHaveBeenCalled();
  });
  it("searches Indonesia only, keeps the key in a header, and returns just the suggestion text", async () => {
    google.mockResolvedValue(
      Response.json({
        suggestions: [{ placePrediction: { placeId: "p1", structuredFormat: { mainText: { text: "Jl. Senopati" }, secondaryText: { text: "Jakarta Selatan" } } } }, {}],
      }),
    );
    const r = await call(search);
    expect(await r.json()).toEqual({ suggestions: [{ id: "p1", title: "Jl. Senopati", detail: "Jakarta Selatan" }] });
    const [url, init] = google.mock.calls[0];
    expect(String(url)).not.toContain("server-key");
    expect(init.headers["X-Goog-Api-Key"]).toBe("server-key");
    expect(JSON.parse(init.body)).toMatchObject({ includedRegionCodes: ["id"], sessionToken: "session-token" });
  });
  it("returns a pick's location, in the app's shape", async () => {
    google.mockResolvedValue(Response.json({ location: { latitude: -6.2, longitude: 106.8 } }));
    const r = await call({ placeId: "p1", sessionToken: "session-token" });
    expect(await r.json()).toEqual({ location: { lat: -6.2, lng: 106.8 } });
    expect(google.mock.calls[0][1].headers["X-Goog-FieldMask"]).toBe("location");
  });
  it("answers unavailable when Google refuses, for example over quota", async () => {
    google.mockResolvedValue(new Response("{}", { status: 429 }));
    const r = await call(search);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: { code: "PLACES_UNAVAILABLE" } });
  });
});
