import { beforeAll, afterAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
  PACKAGE_IDS as P,
  ADDRESS_ID,
} from "../packages/backend/src/seed";
let db: PGlite;
const read = (
  actor: string | null,
  resource = "seller-import-options",
  id = K[0],
) => localRpc<any>(db, actor, "catera_v1_read", [resource, { id }]);
beforeAll(async () => {
  db = await createDemoDatabase(true);
  await db.query(
    "insert into v1.relationships values($1,$2,'legacy') on conflict do nothing",
    [U.customer, K[0]],
  );
});
afterAll(async () => db?.close());
it("denies anonymous, customers, staff and other tenants", async () => {
  for (const actor of [null, U.customer, U.staff])
    await expect(read(actor)).rejects.toThrow(
      actor ? "FORBIDDEN" : "UNAUTHORIZED",
    );
  await expect(read(U.owner, "seller-import-options", K[1])).rejects.toThrow(
    "FORBIDDEN",
  );
});
it("returns only related customers, their addresses and published packages", async () => {
  const options = await read(U.owner);
  expect(
    options.customers.some(
      (c: any) =>
        c.id === U.customer &&
        c.addresses.some((a: any) => a.id === ADDRESS_ID),
    ),
  ).toBe(true);
  for (const c of options.customers) {
    expect(
      (
        await db.query(
          "select 1 from v1.relationships where user_id=$1 and caterer_id=$2",
          [c.id, K[0]],
        )
      ).rows,
    ).toHaveLength(1);
    for (const a of c.addresses) {
      expect(a.user_id).toBeUndefined();
      expect(
        (
          await db.query(
            "select 1 from v1.addresses where id=$1 and user_id=$2",
            [a.id, c.id],
          )
        ).rows,
      ).toHaveLength(1);
    }
  }
  expect(options.packages.some((p: any) => p.id === P[0])).toBe(true);
  for (const p of options.packages) {
    expect(Array.isArray(p.areas)).toBe(true);
    expect(p.days).toBeGreaterThan(0);
    expect(
      (
        await db.query(
          "select 1 from v1.packages where id=$1 and caterer_id=$2 and status='published'",
          [p.id, K[0]],
        )
      ).rows,
    ).toHaveLength(1);
  }
  await db.query("update v1.packages set status='draft' where id=$1", [P[0]]);
  expect((await read(U.owner)).packages.some((p: any) => p.id === P[0])).toBe(
    false,
  );
  await db.query(
    "delete from v1.relationships where user_id=$1 and caterer_id=$2",
    [U.customer, K[0]],
  );
  expect(
    (await read(U.owner)).customers.some((c: any) => c.id === U.customer),
  ).toBe(false);
});
it("keeps admin reads protected and joins display names after authorization", async () => {
  await expect(read(U.owner, "admin")).rejects.toThrow("FORBIDDEN");
  await db.query(
    "insert into v1.audit(actor_id,action,details) values($1,'usability.test','{}')",
    [U.owner],
  );
  const result = await read(U.platform_admin, "admin");
  const entry = result.audit.find((e: any) => e.action === "usability.test");
  expect(entry.actorName).toBeTruthy();
  expect(entry.actor_id).toBe(U.owner);
});
