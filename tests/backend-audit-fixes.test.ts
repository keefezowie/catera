import { afterEach, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { dishSaveSchema, isFoodImage, offerSchema, price, purchasePricing, type Offer } from "@catera/domain";
import { extractImportRows, type AssistantClient } from "../packages/backend/src/import-assistant";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@supabase/supabase-js");
  vi.resetModules();
});

const offer = { price: 75000, days: 1, trialPrice: null, tiers: [{ min: 1, percent: 0.41 }] } as unknown as Offer;

it("discounts by exact rounding, as SQL round() does, where floats fall short by Rp 1", () => {
  expect(purchasePricing(offer, 1).discount).toBe(308);
  expect(price(offer, 1).discount).toBe(308);
  expect(purchasePricing({ ...offer, tiers: [] }, 1).discount).toBe(0);
  // 0.5 rounds away from zero; just under stays down.
  expect(purchasePricing({ ...offer, price: 1000, tiers: [{ min: 1, percent: 0.05 }] }, 1).discount).toBe(1);
  expect(purchasePricing({ ...offer, price: 1000, tiers: [{ min: 1, percent: 0.04 }] }, 1).discount).toBe(0);
});

const project = "https://abc.supabase.co";
const own = `${project}/storage/v1/object/public/catera-v1-food/kitchen/user/1-a.jpg`;
it("accepts only photos that went through the upload pipeline once the project is known", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", project);
  const catalog = "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Rendang.jpg/330px-Rendang.jpg";
  for (const good of ["", "/assets/food/ayam-panggang.png", "/api/uploads?file=a-1.jpg#th=ab+/=", own, own + "#th=abc", catalog])
    expect(isFoodImage(good), good).toBe(true);
  for (const bad of [
    "https://evil.test/a.jpg",
    "https://evil.supabase.co/storage/v1/object/public/catera-v1-food/a.jpg",
    `${project}/storage/v1/object/public/other/a.jpg`,
    `${project}/storage/v1/object/public/catera-v1-food/../other/a.jpg`,
    `${own}?x=https://evil.test`,
    "/assets/food/../../x.png",
    "//evil.test/assets/food/a.png",
    "https://thumb.wikimedia.org.evil.test/wikipedia/commons/thumb/a/ab/x.jpg",
    "/api/uploads?file=../a.jpg",
  ])
    expect(isFoodImage(bad), bad).toBe(false);
  const details = { name: "Ayam", description: "", serving: "", image: "https://evil.test/a.jpg" };
  const dish = { catererId: "10000000-0000-4000-8000-000000000001", details };
  expect(dishSaveSchema.safeParse(dish).success).toBe(false);
  expect(dishSaveSchema.safeParse({ ...dish, details: { ...details, image: own } }).success).toBe(true);
});

it("refuses tier percents finer than the 2 decimals the shown price can match", () => {
  const base = { name: "", description: "", price: null, days: 1, meal: "lunch", weekdays: [], flexible: false, trialPrice: null, trialMax: null, capacity: {}, windows: { lunch: "11-13", dinner: "17-19" }, tags: [], image: "", menus: [], status: "draft" };
  expect(offerSchema.safeParse({ ...base, tiers: [{ min: 2, percent: 0.41 }] }).success).toBe(true);
  expect(offerSchema.safeParse({ ...base, tiers: [{ min: 2, percent: 7.125 }] }).success).toBe(false);
});

const row = (phone: string) => ({ name: "Andre", phone, addressLine: "Jalan Damai 5", area: "Setiabudi", city: "Jakarta", notes: "", packageId: "p", startDate: "2026-10-08", remainingDays: 5, portions: 1, needsReview: false, reason: "" });
const packages = [{ id: "p", name: "Rumahan", meal: "lunch", days: 20 }];
const dates = { today: "2026-10-07", earliest: "2026-10-08" };
const answering = (rows: unknown[]) => {
  const stream = vi.fn((_body: unknown, _options: { signal: AbortSignal }) => ({ finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ rows }) }] }) }));
  return { client: { messages: { stream } } as unknown as AssistantClient, stream };
};

it("flags a phone number the source never had, however either side writes it", async () => {
  const { client } = answering([row("+62 812-3456-7801"), row("081299999999")]);
  const { rows } = await extractImportRows({ text: "x", sheets: ["Andre,0812 3456 7801"] }, packages, { client, ...dates });
  expect(rows[0].needsReview).toBe(false);
  expect(rows[1].needsReview).toBe(true);
  expect(rows[1].reason).toMatch(/daftar asli/);
});

it("does not doubt a number that could have come from a photo", async () => {
  const { client } = answering([row("081299999999")]);
  const { rows } = await extractImportRows({ text: "x", images: [{ mediaType: "image/jpeg", data: "AAAA" }] }, packages, { client, ...dates });
  expect(rows[0].needsReview).toBe(false);
});

it("passes the caller's abort to the stream, and the real SDK stops on it", async () => {
  const { client, stream } = answering([]);
  const caller = new AbortController();
  await extractImportRows({ text: "x" }, packages, { client, ...dates, signal: caller.signal });
  const { signal } = stream.mock.calls[0][1];
  expect(signal.aborted).toBe(false);
  caller.abort();
  expect(signal.aborted).toBe(true);

  const hanging = (_url: unknown, init?: RequestInit) =>
    new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const real = new Anthropic({ apiKey: "synthetic", fetch: hanging as typeof fetch, maxRetries: 0 });
  const stop = new AbortController();
  const read = extractImportRows({ text: "x" }, packages, { client: real, ...dates, signal: stop.signal });
  stop.abort();
  await expect(read).rejects.toBeInstanceOf(Anthropic.APIUserAbortError);
});

it("hosted rpc bounds every call, shares only token-free clients and keeps the PostgREST code", async () => {
  const signals: AbortSignal[] = [];
  const created: unknown[] = [];
  let result: { data: unknown; error: unknown } = { data: 1, error: null };
  vi.doMock("@supabase/supabase-js", () => ({
    createClient: (_u: string, _k: string, options: { global: { headers: Record<string, string> } }) => {
      created.push(options.global.headers);
      return { rpc: () => ({ abortSignal: async (s: AbortSignal) => (signals.push(s), result) }) };
    },
  }));
  vi.stubEnv("CATERA_V1_DEMO", "false");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", project);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable");
  const { rpc } = await import("../packages/backend/src/database");
  await rpc(null, null, "catera_v1_read", {});
  await rpc(null, null, "catera_v1_read", {});
  expect(created).toHaveLength(1);
  await rpc("u", "user-a", "catera_v1_read", {});
  await rpc("u", "user-b", "catera_v1_read", {});
  expect(created.slice(1)).toEqual([{ Authorization: "Bearer user-a" }, { Authorization: "Bearer user-b" }]);
  expect(signals).toHaveLength(4);
  expect(signals.every((s) => s instanceof AbortSignal && !s.aborted)).toBe(true);
  result = { data: null, error: { message: "NOT_ALLOWED", code: "P0001", details: "row", hint: null } };
  await expect(rpc(null, null, "catera_v1_read", {})).rejects.toMatchObject({ message: "NOT_ALLOWED", code: "P0001", details: "row" });
});
