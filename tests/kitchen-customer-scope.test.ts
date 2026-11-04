import { beforeAll, afterAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
  PACKAGE_IDS as P,
  ADDRESS_ID,
} from "../packages/backend/src/seed";

// Security audit 2026-11-04, M1: opening a checkout is not giving a kitchen your address book.
let db: PGlite;
const stranger = "00000000-0000-4000-8000-00000000a001";
const strangerAddress = "00000000-0000-4000-8000-00000000a002";
const privateAddress = "00000000-0000-4000-8000-00000000a003";
const options = () =>
  localRpc<any>(db, U.owner, "catera_v1_read", [
    "seller-import-options",
    { id: K[0] },
  ]);
const preview = (row: Record<string, unknown>) =>
  localRpc<any>(db, U.owner, "catera_v1_command", [
    "import.preview",
    {
      catererId: K[0],
      rows: [
        {
          packageId: P[0],
          portions: 1,
          remainingDays: 1,
          startDate: "2027-01-04",
          externalReference: "scope-" + crypto.randomUUID().slice(0, 8),
          ...row,
        },
      ],
    },
    crypto.randomUUID(),
  ]);
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => "",
    (e: unknown) => (e instanceof Error ? e.message : String(e)),
  );

beforeAll(async () => {
  db = await createDemoDatabase(true);
  // Someone who opened a checkout with the kitchen and left: a relationship row, nothing given.
  await db.query("insert into v1.profiles(id,name) values($1,'Calon Pelanggan')", [stranger]);
  await db.query("insert into v1.relationships values($1,$2,'marketplace')", [stranger, K[0]]);
  await db.query(
    "insert into v1.addresses(id,user_id,label,line,area,city) values($1,$2,'Rumah','Jalan Rahasia 1','Kebayoran','Jakarta')",
    [strangerAddress, stranger],
  );
  // A real customer's second address that no delivery of this kitchen ever went to.
  await db.query(
    "insert into v1.addresses(id,user_id,label,line,area,city) values($1,$2,'Kantor','Gedung Lain 9','Kuningan','Jakarta')",
    [privateAddress, U.customer],
  );
});
afterAll(async () => db?.close());

it("lists only the kitchen's customers, with only the addresses they gave it", async () => {
  const { customers } = await options();
  expect(customers.some((c: any) => c.id === stranger)).toBe(false);
  const customer = customers.find((c: any) => c.id === U.customer);
  expect(customer).toBeTruthy();
  const ids = customer.addresses.map((a: any) => a.id);
  expect(ids).toContain(ADDRESS_ID);
  expect(ids).not.toContain(privateAddress);
  for (const c of customers)
    for (const a of c.addresses)
      expect(
        (
          await db.query(
            `select 1 from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id
             join v1.packages p on p.id=s.package_id
             where s.user_id=$1 and p.caterer_id=$2 and d.address->>'id'=$3`,
            [c.id, K[0], a.id],
          )
        ).rows.length,
      ).toBeGreaterThan(0);
});

it("refuses an import naming an abandoned-checkout account or an address never given", async () => {
  expect(await failure(preview({ customerId: stranger }))).toContain("FORBIDDEN");
  expect(
    await failure(preview({ customerId: stranger, addressId: strangerAddress })),
  ).toContain("FORBIDDEN");
  expect(
    await failure(preview({ customerId: U.customer, addressId: privateAddress })),
  ).toContain("FORBIDDEN");
  // The kitchen's own customer at an address they did give it is not refused for scope.
  expect(
    await failure(preview({ customerId: U.customer, addressId: ADDRESS_ID })),
  ).not.toContain("FORBIDDEN");
});

it("keeps a customer the kitchen created with a phone number, once they claim it", async () => {
  await db.query(
    "insert into v1.customer_records(caterer_id,user_id,name,phone,address,origin) values($1,$2,'Calon Pelanggan','+6281200000001','{}','seller')",
    [K[0], stranger],
  );
  const { customers } = await options();
  const claimed = customers.find((c: any) => c.id === stranger);
  expect(claimed).toBeTruthy();
  // Still none of their saved addresses: the kitchen typed its own copy on the record.
  expect(claimed.addresses).toEqual([]);
});
