import { beforeAll, afterAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase } from "../packages/backend/src/database";
import { refreshDemoCatalogSQL } from "../packages/backend/src/seed";
let db: PGlite;
const upgrade = await readFile(
  "packages/backend/src/demo-slot-upgrade.sql",
  "utf8",
);
beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => {
  await db?.close();
});
it("normalizes every seeded package, purchase revision, dated recipe and library category", async () => {
  const result = await db.query<{ ok: boolean }>(`select
    not exists(select 1 from v1.packages p where not v1.valid_contents(p.offer,true))
    and not exists(select 1 from v1.content_revisions r,jsonb_array_elements(r.contents->'menus') m where m->>'contentModel' is distinct from 'slots' or jsonb_array_length(m->'items')<>0)
    and not exists(select 1 from v1.subscriptions s,jsonb_array_elements(s.snapshot->'offer'->'menus') m where m->>'contentModel' is distinct from 'slots' or jsonb_array_length(m->'items')<>0)
    and not exists(select 1 from v1.menus where not v1.valid_slot_menu(details,true,false))
    and exists(select 1 from v1.menus)
    and not exists(select 1 from v1.dishes d left join v1.dish_categories c on c.id=d.details->>'categoryId' where c.id is null or (c.caterer_id is not null and c.caterer_id<>d.caterer_id))
    and exists(select 1 from v1.dish_categories where name='Pelengkap' and caterer_id is not null) as ok`);
  expect(result.rows[0].ok).toBe(true);
});
async function state() {
  const r = await db.query(`select
    (select jsonb_agg(to_jsonb(p) order by id) from v1.packages p) packages,
    (select jsonb_agg(to_jsonb(r) order by package_id,revision) from v1.content_revisions r) revisions,
    (select jsonb_agg(to_jsonb(d) order by id) from v1.dishes d) dishes,
    (select jsonb_agg(to_jsonb(m) order by package_id,service_date,meal) from v1.menus m) menus,
    (select jsonb_agg(to_jsonb(s) order by id) from v1.subscriptions s) subscriptions`);
  return r.rows;
}
it("repeat conversion and catalog refresh leave normalized synthetic records unchanged", async () => {
  const before = await state();
  await db.transaction(async (tx) => {
    await tx.exec(refreshDemoCatalogSQL());
    await tx.query("select set_config('catera.demo','true',true)");
    await tx.exec(upgrade);
  });
  expect(await state()).toEqual(before);
});
it("refuses non-demo use without weakening immutable-history triggers", async () => {
  const before = await state();
  await expect(
    db.transaction(async (tx) => {
      await tx.query("select set_config('catera.demo','false',true)");
      await tx.exec(upgrade);
    }),
  ).rejects.toThrow("SYNTHETIC_DEMO_REQUIRED");
  expect(await state()).toEqual(before);
  await expect(
    db.exec("update v1.subscriptions set portions=portions+1"),
  ).rejects.toThrow("IMMUTABLE_TERMS");
  await expect(
    db.exec("update v1.content_revisions set contents='{}'"),
  ).rejects.toThrow("IMMUTABLE_HISTORY");
});
