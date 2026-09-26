import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID,
  CATERER_IDS as C,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay } from "@catera/domain";

let db: PGlite;
const read = (actor: string | null, resource: string, params: object = {}) =>
  localRpc<any>(db, actor, "catera_v1_read", [resource, params]);
const cmd = (actor: string, action: string, payload: object) =>
  localRpc<any>(db, actor, "catera_v1_command", [
    action,
    payload,
    crypto.randomUUID(),
  ]);

beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());

it("isolates customer actions and returns a stable priority order", async () => {
  const checkout = await cmd(U.customer, "checkout.create", {
    acceptedTerms: true,
    packageId: P[2],
    addressId: ADDRESS_ID,
    portions: 1,
    startDate: addDays(localDay(), 100),
    trial: false,
  });
  const other = crypto.randomUUID();
  await db.query(
    "insert into v1.profiles(id,name) values($1,'Other action customer')",
    [other],
  );
  const foreign = (
    await db.query<any>(
      "insert into v1.checkouts(user_id,package_id,address_id,quote,state,expires_at,payment_mode) select $1,package_id,address_id,quote,'pending',now()+interval '20 minutes',payment_mode from v1.checkouts where id=$2 returning id",
      [other, checkout.id],
    )
  ).rows[0].id;

  const own = await read(U.customer, "customer-actions", { limit: 20 });
  const theirs = await read(other, "customer-actions", { limit: 20 });
  expect(
    own.items.some((action: any) => action.id === "payment-" + checkout.id),
  ).toBe(true);
  expect(
    own.items.some((action: any) => action.id === "payment-" + foreign),
  ).toBe(false);
  expect(theirs.items.map((action: any) => action.id)).toContain(
    "payment-" + foreign,
  );
  expect(own.items).toEqual(
    [...own.items].sort(
      (left: any, right: any) =>
        left.priority - right.priority ||
        String(left.dueAt ?? left.serviceDate ?? "9999").localeCompare(
          String(right.dueAt ?? right.serviceDate ?? "9999"),
        ) ||
        left.id.localeCompare(right.id),
    ),
  );
  await expect(read(null, "customer-actions", { limit: 20 })).rejects.toThrow(
    "UNAUTHORIZED",
  );
});

it("filters seller attention by structured date and denies other tenants", async () => {
  const delivery = (
    await db.query<any>(
      "select d.id,d.service_date::text date from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where p.caterer_id=$1 and s.user_id=$2 order by d.service_date,id limit 1",
      [C[0], U.customer],
    )
  ).rows[0];
  const support = (
    await db.query<any>(
      "insert into v1.support_cases(user_id,caterer_id,delivery_id,subject,description) values($1,$2,$3,'Selected date fixture','Structured seller attention fixture') returning id",
      [U.customer, C[0], delivery.id],
    )
  ).rows[0];
  const selected = await read(U.owner, "seller-attention", {
    id: C[0],
    scope: "selected",
    date: delivery.date,
    limit: 20,
  });
  expect(selected.items).toContainEqual(
    expect.objectContaining({
      id: "case-" + support.id,
      serviceDate: delivery.date,
      destination: "/seller/support?case=" + support.id,
    }),
  );
  expect(
    (
      await read(U.owner, "seller-attention", {
        id: C[0],
        scope: "selected",
        date: addDays(delivery.date, 200),
        limit: 20,
      })
    ).items.some((entry: any) => entry.id === "case-" + support.id),
  ).toBe(false);
  await expect(
    read(U.owner, "seller-attention", { id: C[1], scope: "all", limit: 20 }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    read(U.customer, "seller-attention", { id: C[0], scope: "all", limit: 20 }),
  ).rejects.toThrow("FORBIDDEN");
});

it("reaches more than 100 seller exceptions exactly once with keyset pagination", async () => {
  const inserted: string[] = [];
  for (let index = 0; index < 105; index++) {
    const row = (
      await db.query<any>(
        "insert into v1.support_cases(user_id,caterer_id,subject,description,created_at) values($1,$2,$3,'Pagination fixture',now()+$4::int*interval '1 second') returning id",
        [U.customer, C[0], `Attention pagination ${index}`, index],
      )
    ).rows[0];
    inserted.push("case-" + row.id);
  }

  const seen: string[] = [];
  let cursor: any = null;
  let total = 0;
  do {
    const page = await read(U.staff, "seller-attention", {
      id: C[0],
      scope: "all",
      limit: 37,
      ...(cursor
        ? {
            cursorPriority: cursor.priority,
            cursorAt: cursor.at,
            cursorId: cursor.id,
          }
        : {}),
    });
    total = page.total;
    seen.push(...page.items.map((entry: any) => entry.id));
    cursor = page.nextCursor;
  } while (cursor);

  expect(seen).toHaveLength(total);
  expect(new Set(seen).size).toBe(total);
  for (const id of inserted) expect(seen).toContain(id);
});
