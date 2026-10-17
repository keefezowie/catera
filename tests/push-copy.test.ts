import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase } from "../packages/backend/src/database";

/**
 * The live function sources, not the migration text: every push body is read back from the database after the push copy
 * migration (G18), so a body that survived in a function an older migration re-created shows here.
 */
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
beforeAll(async () => {
  db = await createDemoDatabase(true);
}, 120000);
afterAll(async () => {
  await db?.close();
});

const sources = async (needle: string) =>
  (
    await db.query<{ name: string }>(
      "select n.nspname||'.'||p.proname as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','v1') and p.prokind='f' and p.prosrc like $1 order by 1",
      [`%${needle}%`],
    )
  ).rows.map((r) => r.name);

it("no push body speaks to \"Anda\" or about a \"katerer\" any more", async () => {
  for (const needle of [
    "Paket Anda sudah aktif",
    "Status pengantaran Anda",
    "permintaan Anda",
    "Besok ada makanan untuk Anda",
    "pengantaran Anda diperbarui",
    "Katerer menandai",
    "Pesan baru dari katerer",
    "tanpa jeda",
    "komunikasikan kepada pelanggan",
    "Tinjau dan tanggapi",
  ]) {
    expect(await sources(needle), needle).toEqual([]);
  }
});

it("the choice-menu pushes name the day instead of printing an ISO date", async () => {
  expect(await sources("r.service_date||' · '")).toEqual([]);
  expect((await sources("v1.push_day(r.service_date)")).length).toBeGreaterThan(0);
  const day = await db.query<{ d: string }>("select v1.push_day(date '2026-10-13') d");
  expect(day.rows[0].d).toBe("Selasa 13 Okt");
});

it("the new bodies are the live ones", async () => {
  expect((await sources("Paketmu sudah aktif")).length).toBeGreaterThan(0);
  expect((await sources("Pesanan baru: ")).length).toBeGreaterThan(0);
  expect((await sources("Perpanjang kalau mau lanjut")).length).toBeGreaterThan(0);
});
