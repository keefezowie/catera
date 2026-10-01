import { beforeAll, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import {
  savedPackageSchema,
  swipeTarget,
  type Offer,
  type SavedPackages,
} from "@catera/domain";
let db: PGlite;
const read = (actor: string | null = U.customer, params = {}) =>
  localRpc<SavedPackages>(db, actor, "catera_v1_read", [
    "saved-packages",
    params,
  ]);
const set = (
  saved: boolean,
  packageId = P[0],
  actor: string | null = U.customer,
  key = crypto.randomUUID(),
  extra = {},
) =>
  localRpc(db, actor, "catera_v1_command", [
    "savedPackage.set",
    { packageId, saved, ...extra },
    key,
  ]);
beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => {
  await db?.close();
});
it("requires an owner session and rejects caller-supplied owners", async () => {
  await expect(read(null)).rejects.toThrow("UNAUTHORIZED");
  await expect(set(true, P[0], null)).rejects.toThrow("UNAUTHORIZED");
  await expect(read(U.customer, { userId: U.owner })).rejects.toThrow(
    "INVALID_INPUT",
  );
  await expect(
    set(true, P[0], U.customer, crypto.randomUUID(), { userId: U.owner }),
  ).rejects.toThrow("INVALID_INPUT");
  expect(
    savedPackageSchema.safeParse({
      packageId: P[0],
      saved: true,
      userId: U.owner,
    }).success,
  ).toBe(false);
});
it("deduplicates saves, receipts retries and keeps financial and capacity tables unchanged", async () => {
  const counts = async () =>
    (
      await db.query(
        "select (select count(*) from v1.checkouts)::int checkouts, (select count(*) from v1.subscriptions)::int subscriptions, (select count(*) from v1.reservations)::int reservations",
      )
    ).rows;
  const before = await counts();
  const key = crypto.randomUUID();
  const result = await set(true, P[0], U.customer, key);
  expect(await set(true, P[0], U.customer, key)).toEqual(result);
  const at = (await read()).items[0].savedAt;
  await Promise.all([set(true), set(true), set(true)]);
  expect((await read()).items).toHaveLength(1);
  expect((await read()).items[0].savedAt).toBe(at);
  expect((await read(U.owner)).items).toHaveLength(0);
  await expect(set(false, P[0], U.customer, key)).rejects.toThrow("CONFLICT");
  expect(await counts()).toEqual(before);
});
it("pages independently of catalog, returns complete membership and uses current offers", async () => {
  await set(true, P[1]);
  await set(true, P[2]);
  const first = await read(U.customer, { limit: 1 });
  expect(first.items).toHaveLength(1);
  expect(first.packageIds).toHaveLength(3);
  const second = await read(U.customer, { limit: 1, cursor: first.nextCursor });
  expect(second.items[0].packageId).not.toBe(first.items[0].packageId);
  expect(second.packageIds).toEqual(first.packageIds);
  await db.query(
    "update v1.packages set offer=jsonb_set(offer,'{price}','888000') where id=$1",
    [P[0]],
  );
  expect(
    (await read()).items.find((x) => x.packageId === P[0])?.offer?.price,
  ).toBe(888000);
});
it("retains only identity for unavailable offers and still allows removal", async () => {
  await db.query("update v1.packages set status='suspended' where id=$1", [
    P[0],
  ]);
  const unavailable = (await read()).items.find((x) => x.packageId === P[0])!;
  expect(unavailable.offer).toBeNull();
  expect(Object.keys(unavailable.summary).sort()).toEqual([
    "caterer",
    "image",
    "name",
    "slug",
  ]);
  await expect(set(true)).rejects.toThrow("NOT_AVAILABLE");
  await set(false);
  expect((await read()).packageIds).not.toContain(P[0]);
  await db.query(
    "update v1.caterers set status='suspended' where id=(select caterer_id from v1.packages where id=$1)",
    [P[1]],
  );
  expect(
    (await read()).items.find((x) => x.packageId === P[1])?.offer,
  ).toBeNull();
  await expect(set(true, P[1])).rejects.toThrow("NOT_AVAILABLE");
  await set(false, P[1]);
});
it("retrieves every saved item beyond the public catalog limit and resolves its current detail", async () => {
  const inserted = await db.query<{ id: string }>(
    `insert into v1.packages(id,caterer_id,slug,offer,status)
     select gen_random_uuid(),p.caterer_id,'synthetic-saved-'||g,p.offer,'published'
     from (select p.* from v1.packages p join v1.caterers c on c.id=p.caterer_id
       where p.status='published' and c.status='approved' limit 1) p
     cross join generate_series(1,103) g returning id`,
  );
  for (const item of inserted.rows) await set(true, item.id);
  const catalog = await localRpc<{ items: Offer[] }>(
    db,
    null,
    "catera_v1_read",
    ["catalog", { limit: 100 }],
  );
  expect(catalog.items).toHaveLength(100);
  const outside = inserted.rows.find(
    (item) => !catalog.items.some((offer) => offer.id === item.id),
  )!;
  expect(outside).toBeTruthy();
  const first = await read();
  expect(first.items).toHaveLength(50);
  expect(first.packageIds).toHaveLength(104);
  const all = [...first.items];
  let cursor = first.nextCursor;
  while (cursor) {
    const page = await read(U.customer, { cursor });
    expect(page.packageIds).toEqual(first.packageIds);
    all.push(...page.items);
    cursor = page.nextCursor;
  }
  expect(new Set(all.map((item) => item.packageId)).size).toBe(104);
  expect(all.find((item) => item.packageId === outside.id)?.offer?.id).toBe(
    outside.id,
  );
  const detail = await localRpc<{ offer: Offer | null }>(
    db,
    null,
    "catera_v1_read",
    ["offer", { id: outside.id }],
  );
  expect(detail.offer?.id).toBe(outside.id);
  const suspended = await localRpc<{ offer: Offer | null }>(
    db,
    null,
    "catera_v1_read",
    ["offer", { id: P[0] }],
  );
  expect(suspended.offer).toBeNull();
  await expect(
    read(U.customer, {
      cursor: JSON.stringify({ at: "invalid-date", id: outside.id }),
    }),
  ).rejects.toThrow("INVALID_INPUT");
});
it("clamps short, slow, fast and edge swipes to at most one card", () => {
  expect(swipeTarget(2, 6, 8, 1)).toBe(2);
  expect(swipeTarget(2, 6, 44, 0.1)).toBe(2);
  expect(swipeTarget(2, 6, 65, 0.1)).toBe(3);
  expect(swipeTarget(2, 6, 900, 3)).toBe(3);
  expect(swipeTarget(2, 6, -18, -0.8)).toBe(1);
  expect(swipeTarget(0, 6, -120, -1)).toBe(0);
  expect(swipeTarget(5, 6, 800, 2)).toBe(5);
});
