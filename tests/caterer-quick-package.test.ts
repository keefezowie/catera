import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { offerSchema, type SellerOffer } from "@catera/domain";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { CATERER_IDS as K, DEMO_ACTORS as U } from "../packages/backend/src/seed";
import { emptyPackage, formFromOffer, quickOffer } from "../apps/caterer/src/business/package";

let db: PGlite;
beforeAll(async () => {
  db = await createDemoDatabase(true);
}, 120000);
afterAll(async () => db?.close());

it("saves a package made in the Catera Dapur editor", async () => {
  const offer = quickOffer({
    ...emptyPackage,
    name: "Rumahan Mobile",
    description: "Masakan rumahan harian dengan nasi, dua lauk dan sayur.",
    price: "28000",
    capacity: "30",
    image: "https://cdn.example.test/k/a.jpg",
  });
  expect(offerSchema.safeParse(offer).success).toBe(true);
  const valid = await db.query<{ ok: boolean }>("select v1.valid_offer($1::jsonb) as ok", [JSON.stringify(offer)]);
  expect(valid.rows[0].ok).toBe(true);
  const saved = await localRpc<{ id: string }>(db, U.owner, "catera_v1_command", [
    "package.save",
    { catererId: K[0], slug: "rumahan-mobile-t1", offer },
    crypto.randomUUID(),
  ]);
  expect(saved.id).toBeTruthy();
});

it("saves the macros the Dapur editor sends, a calorie range and a zero included", async () => {
  const offer = quickOffer({
    ...emptyPackage,
    name: "Rumahan Bergizi",
    description: "Masakan rumahan harian dengan nasi, dua lauk dan sayur.",
    price: "28000",
    capacity: "30",
    image: "https://cdn.example.test/k/b.jpg",
    nutrition: { range: true, caloriesKcal: ["580", "640"], proteinG: "32", carbsG: "", fatG: "0" },
  });
  expect(offer.nutrition).toEqual({ caloriesKcal: { min: 580, max: 640 }, proteinG: 32, fatG: 0 });
  expect(offerSchema.safeParse(offer).success).toBe(true);
  const valid = await db.query<{ ok: boolean }>("select v1.valid_offer($1::jsonb) as ok", [JSON.stringify(offer)]);
  expect(valid.rows[0].ok).toBe(true);
  const saved = await localRpc<{ id: string }>(db, U.owner, "catera_v1_command", [
    "package.save",
    { catererId: K[0], slug: "rumahan-bergizi-t1", offer },
    crypto.randomUUID(),
  ]);
  const stored = await db.query<{ nutrition: unknown }>("select offer->'nutrition' as nutrition from v1.packages where id=$1", [saved.id]);
  expect(stored.rows[0].nutrition).toEqual({ caloriesKcal: { min: 580, max: 640 }, proteinG: 32, fatG: 0 });
});

it("Salin jadi paket baru from the seeded Rantang Nusantara saves its four ranges unchanged", async () => {
  // The demo seed stores Rantang Nusantara with a range for every metric (two menus, packages/backend/src/seed.ts).
  const source = await db.query<{ offer: SellerOffer }>("select offer from v1.packages where offer->>'name'='Rantang Nusantara'");
  const ranges = {
    caloriesKcal: { min: 610, max: 640 },
    proteinG: { min: 29, max: 30 },
    carbsG: { min: 76, max: 82 },
    fatG: { min: 19, max: 21 },
  };
  expect(source.rows[0].offer.nutrition).toEqual(ranges);
  const offer = quickOffer({ ...formFromOffer(source.rows[0].offer), name: "Rantang Nusantara Salinan" });
  expect(offer.nutrition).toEqual(ranges);
  const valid = await db.query<{ ok: boolean }>("select v1.valid_offer($1::jsonb) as ok", [JSON.stringify(offer)]);
  expect(valid.rows[0].ok).toBe(true);
  const saved = await localRpc<{ id: string }>(db, U.owner, "catera_v1_command", [
    "package.save",
    { catererId: K[0], slug: "rantang-salinan-t1", offer },
    crypto.randomUUID(),
  ]);
  const stored = await db.query<{ nutrition: unknown }>("select offer->'nutrition' as nutrition from v1.packages where id=$1", [saved.id]);
  expect(stored.rows[0].nutrition).toEqual(ranges);
});
